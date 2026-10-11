import { SignJWT, jwtVerify } from "jose";
import type { Env } from "./index";
import { rateLimit, signedInResponse, upsertContactUser } from "./claim";

/**
 * Owner-run discount vouchers, and the one-click owner link that gets an owner to them.
 *
 * The voucher campaign email carries {{offer_url}}: a signed link bound to one listing slug and
 * the exact address the email was sent to (worker/campaigns.ts mints it per recipient). Opening
 * it and pressing one button claims the listing — or signs the existing owner back in — and lands
 * on /my-listing with the voucher form open. Receiving mail at the on-file address is the same
 * proof of control the 6-digit claim code gives (worker/claim.ts), so the code step is skipped.
 * The link page needs a button press rather than acting on GET, so mail scanners that prefetch
 * links don't claim anything. The token carries no openId, so it can never pass as a session
 * cookie in getWorkerUser, and a session cookie (no `purpose`) is never accepted here.
 */

const LINK_PURPOSE = "owner-link";
const LINK_TTL_SECONDS = 60 * 60 * 24 * 45;

const MAX = { title: 80, details: 400, terms: 300, code: 24 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "Live right now" — the same rule for the listing page, place cards and the reveal endpoint. */
const LIVE = "active = 1 AND (starts_on IS NULL OR starts_on <= date('now')) AND (ends_on IS NULL OR ends_on >= date('now'))";

function secret(env: Env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function ownerLinkToken(env: Env, slug: string, email: string): Promise<string> {
  return new SignJWT({ purpose: LINK_PURPOSE, slug, email: email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS)
    .sign(secret(env));
}

export async function ownerLinkUrl(env: Env, slug: string, email: string): Promise<string> {
  return `${env.SITE_URL}/my-listing/start?t=${await ownerLinkToken(env, slug, email)}`;
}

async function readOwnerLink(env: Env, token: string): Promise<{ slug: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(env), { algorithms: ["HS256"] });
    if (payload.purpose !== LINK_PURPOSE || typeof payload.slug !== "string" || typeof payload.email !== "string") return null;
    return { slug: payload.slug, email: payload.email };
  } catch {
    return null;
  }
}

/** POST /api/owner/link { token } — claim (or re-enter) the listing the emailed link was minted for. */
export async function handleOwnerLink(request: Request, env: Env) {
  const body = await request.json<{ token?: string }>().catch(() => ({}) as { token?: string });
  const link = body.token ? await readOwnerLink(env, body.token) : null;
  if (!link) return Response.json({ error: "This link has expired or isn't valid. Use \"Claim this listing\" on your listing page to get a login code instead." }, { status: 400 });

  const listing = await env.DB.prepare("SELECT id, slug, name, owner_id AS ownerId, contact_email AS contactEmail FROM qh_listings WHERE slug = ? LIMIT 1")
    .bind(link.slug)
    .first<{ id: number; slug: string; name: string; ownerId: number | null; contactEmail: string | null }>();
  if (!listing) return Response.json({ error: "That listing isn't in the directory any more." }, { status: 404 });

  // The address must still be on file for this listing — a link minted before the owner changed
  // their contact email stops working rather than handing the listing to the old address.
  const legacy = await env.DB.prepare("SELECT email FROM listings WHERE slug = ? LIMIT 1").bind(link.slug).first<{ email: string | null }>();
  // Sign in as the address exactly as it's stored, so an owner who claimed earlier by code
  // (worker/claim.ts keys the account on the stored address) lands on that same account.
  const address = [listing.contactEmail, legacy?.email].map(value => value?.trim()).find(value => value && value.toLowerCase() === link.email);
  if (!address) return Response.json({ error: "This link was sent to an address that's no longer on file for this listing." }, { status: 403 });

  const user = await upsertContactUser(env, "email", address, listing.name);
  if (!user) return Response.json({ error: "Something went wrong signing you in." }, { status: 500 });

  if (listing.ownerId && listing.ownerId !== user.id) {
    return Response.json({ error: "This listing has already been claimed by someone else. Reply to our email and we'll sort it out." }, { status: 409 });
  }
  if (!listing.ownerId) {
    const claimed = await env.DB.prepare("UPDATE qh_listings SET owner_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id IS NULL").bind(user.id, listing.id).run();
    if (!claimed.meta.changes) return Response.json({ error: "This listing was just claimed by someone else." }, { status: 409 });
  }

  return signedInResponse(env, user.openId, listing.name, { success: true, listingSlug: listing.slug, listingName: listing.name });
}

type OfferRow = { title: string; details: string | null; terms: string | null; code: string; startsOn: string | null; endsOn: string | null; active: number; revealCount: number };

const OFFER_COLUMNS = "title, details, terms, code, starts_on AS startsOn, ends_on AS endsOn, active, reveal_count AS revealCount";

async function ownedSlug(env: Env, userId: number): Promise<string | null> {
  const row = await env.DB.prepare("SELECT slug FROM qh_listings WHERE owner_id = ? LIMIT 1").bind(userId).first<{ slug: string }>();
  return row?.slug ?? null;
}

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return `TM4U-${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("")}`;
}

/** GET /api/owner/offer — the signed-in owner's voucher, or null if they haven't made one. */
export async function handleGetOwnerOffer(env: Env, userId: number) {
  const slug = await ownedSlug(env, userId);
  if (!slug) return Response.json({ error: "You haven't claimed a listing yet." }, { status: 404 });
  const offer = await env.DB.prepare(`SELECT ${OFFER_COLUMNS} FROM listing_offers WHERE listing_slug = ? LIMIT 1`).bind(slug).first<OfferRow>();
  return Response.json({ offer: offer ? { ...offer, active: Boolean(offer.active) } : null });
}

export type OfferInput = { title?: unknown; details?: unknown; terms?: unknown; code?: unknown; startsOn?: unknown; endsOn?: unknown; active?: unknown };

/** Pure validation, exported for tests. Returns the cleaned offer or the first problem found. */
export function validateOffer(input: OfferInput): { ok: true; offer: { title: string; details: string | null; terms: string | null; code: string | null; startsOn: string | null; endsOn: string | null; active: boolean } } | { ok: false; error: string } {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const title = text(input.title);
  const details = text(input.details);
  const terms = text(input.terms);
  const code = text(input.code).toUpperCase();
  const startsOn = text(input.startsOn);
  const endsOn = text(input.endsOn);
  if (!title) return { ok: false, error: "Give your voucher a headline, e.g. \"15% off your first visit\"." };
  if (title.length > MAX.title) return { ok: false, error: `Keep the headline under ${MAX.title} characters.` };
  if (details.length > MAX.details) return { ok: false, error: `Keep the message under ${MAX.details} characters.` };
  if (terms.length > MAX.terms) return { ok: false, error: `Keep the conditions under ${MAX.terms} characters.` };
  if (code && !/^[A-Z0-9-]{3,24}$/.test(code)) return { ok: false, error: "Codes can use letters, numbers and dashes (3–24 characters)." };
  if (startsOn && !DATE_RE.test(startsOn)) return { ok: false, error: "Start date isn't a valid date." };
  if (endsOn && !DATE_RE.test(endsOn)) return { ok: false, error: "End date isn't a valid date." };
  if (startsOn && endsOn && endsOn < startsOn) return { ok: false, error: "The end date is before the start date." };
  return { ok: true, offer: { title, details: details || null, terms: terms || null, code: code || null, startsOn: startsOn || null, endsOn: endsOn || null, active: input.active !== false } };
}

/** POST /api/owner/offer — create or replace the signed-in owner's voucher. */
export async function handleSaveOwnerOffer(request: Request, env: Env, userId: number) {
  const slug = await ownedSlug(env, userId);
  if (!slug) return Response.json({ error: "You haven't claimed a listing yet." }, { status: 404 });
  const result = validateOffer(await request.json<OfferInput>().catch(() => ({})));
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  const { offer } = result;
  await env.DB.prepare(
    `INSERT INTO listing_offers (listing_slug, title, details, terms, code, starts_on, ends_on, active, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(listing_slug) DO UPDATE SET title = excluded.title, details = excluded.details, terms = excluded.terms,
       code = COALESCE(?, listing_offers.code), starts_on = excluded.starts_on, ends_on = excluded.ends_on,
       active = excluded.active, owner_user_id = excluded.owner_user_id, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(slug, offer.title, offer.details, offer.terms, offer.code ?? generateCode(), offer.startsOn, offer.endsOn, offer.active ? 1 : 0, userId, offer.code)
    .run();
  return handleGetOwnerOffer(env, userId);
}

/** The public face of a live offer — everything except the code, which the reveal endpoint hands out. */
export async function getLiveOffer(env: Env, slug: string) {
  try {
    return await env.DB.prepare(`SELECT title, details, terms, starts_on AS startsOn, ends_on AS endsOn FROM listing_offers WHERE listing_slug = ? AND ${LIVE} LIMIT 1`)
      .bind(slug)
      .first<{ title: string; details: string | null; terms: string | null; startsOn: string | null; endsOn: string | null }>();
  } catch {
    // Table not migrated yet in this environment — a listing page must still render.
    return null;
  }
}

/** slug → headline for every live offer, for the "Voucher" tag on place cards. The table is small (one row per opted-in listing). */
export async function liveOfferTitles(env: Env): Promise<Map<string, string>> {
  try {
    const { results } = await env.DB.prepare(`SELECT listing_slug AS slug, title FROM listing_offers WHERE ${LIVE}`).all<{ slug: string; title: string }>();
    return new Map(results.map(row => [row.slug, row.title]));
  } catch {
    return new Map();
  }
}

/** POST /api/offers/reveal { slug } — a customer pressed "Get voucher". Counted at most 3×/hour per visitor per listing. */
export async function handleRevealOffer(request: Request, env: Env) {
  const body = await request.json<{ slug?: string }>().catch(() => ({}) as { slug?: string });
  if (!body.slug) return Response.json({ error: "slug is required" }, { status: 400 });
  const offer = await env.DB.prepare(`SELECT id, code FROM listing_offers WHERE listing_slug = ? AND ${LIVE} LIMIT 1`).bind(body.slug).first<{ id: number; code: string }>();
  if (!offer) return Response.json({ error: "This offer has ended." }, { status: 404 });
  const visitor = request.headers.get("CF-Connecting-IP") ?? "anonymous";
  const counted = await rateLimit(env, `offer-reveal:${body.slug}:${visitor}`, 3, 60 * 60 * 1000);
  if (counted.ok) await env.DB.prepare("UPDATE listing_offers SET reveal_count = reveal_count + 1 WHERE id = ?").bind(offer.id).run();
  return Response.json({ code: offer.code });
}
