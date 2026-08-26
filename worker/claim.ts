import { SignJWT } from "jose";
import type { Env } from "./index";
import { sendTransactionalEmail } from "./email";
import { sendSms } from "./sms";

/**
 * Self-service ownership claim — free for any unclaimed listing, not just
 * premium ones (premium is a separate upsell once you're logged in, not a
 * gate on claiming) — "give them login to update their own listing, keep it
 * simple, sms or email code" (no passwords, no separate signup). A claim
 * only ever sends a code to the contact channel already on file for that
 * listing (qh_listings.contact_email, or the legacy `listings.phone` row
 * joined by slug — see campaigns.ts for why phone lives there and not on
 * qh_listings) — never to an address the caller types in — so completing
 * the flow is proof the claimant actually controls that channel, not just
 * that they know a listing's slug.
 */

const COOKIE_NAME = "app_session_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const OTP_TTL_MINUTES = 10;

type ListingRow = { id: number; slug: string; name: string; owner_id: number | null; contact_email: string | null };

function secret(env: Env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

function generateCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

function maskAddress(channel: "email" | "sms", address: string): string {
  if (channel === "sms") return address.replace(/\d(?=\d{2})/g, "•");
  const [user, domain] = address.split("@");
  if (!domain) return "••••";
  return `${user.slice(0, 1)}${"•".repeat(Math.max(1, user.length - 1))}@${domain}`;
}

async function findListing(env: Env, slug: string): Promise<ListingRow | null> {
  return env.DB.prepare("SELECT id, slug, name, owner_id, contact_email FROM qh_listings WHERE slug = ? LIMIT 1").bind(slug).first<ListingRow>();
}

/** Legacy `listings` carries phone; qh_listings doesn't — joined by slug, same as resolveAudience in campaigns.ts. */
async function legacyPhone(env: Env, slug: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT phone FROM listings WHERE slug = ? AND phone IS NOT NULL AND phone != '' LIMIT 1").bind(slug).first<{ phone: string }>();
  return row?.phone ?? null;
}

async function rateLimit(env: Env, key: string, limit: number, windowMs: number) {
  const id = env.FORM_LIMITER.idFromName(key);
  return env.FORM_LIMITER.get(id).allow(limit, windowMs);
}

export async function handleClaimStart(request: Request, env: Env) {
  const body = await request.json<{ listingSlug?: string; channel?: string }>().catch(() => ({}) as { listingSlug?: string; channel?: string });
  const channel = body.channel === "sms" ? "sms" : body.channel === "email" ? "email" : null;
  if (!body.listingSlug || !channel) return Response.json({ error: "listingSlug and channel ('email' or 'sms') are required." }, { status: 400 });

  const listing = await findListing(env, body.listingSlug);
  if (!listing) return Response.json({ error: "That listing isn't in the directory." }, { status: 404 });
  if (listing.owner_id) return Response.json({ error: "This listing has already been claimed. Contact us if that's wrong." }, { status: 409 });

  const address = channel === "email" ? listing.contact_email : await legacyPhone(env, listing.slug);
  if (!address) {
    return Response.json(
      { error: channel === "email" ? "No email is on file for this listing yet." : "No phone number is on file for this listing yet — try email instead." },
      { status: 400 },
    );
  }

  const limited = await rateLimit(env, `claim-start:${listing.slug}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return Response.json({ error: "Too many code requests for this listing — try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO qh_otp_codes (channel, address, code, listing_id, expires_at) VALUES (?, ?, ?, ?, ?)").bind(channel, address, code, listing.id, expiresAt).run();

  if (channel === "email") {
    await sendTransactionalEmail(env, {
      to: address,
      subject: `Your code to claim ${listing.name} on Thai Massage For U`,
      html: `<p>Someone requested a login code to claim <strong>${listing.name}</strong> on Thai Massage For U.</p><p style="font-size:28px;letter-spacing:4px;font-weight:700">${code}</p><p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore it.</p>`,
    });
  } else {
    if (!env.TWILIO_ACCOUNT_SID) return Response.json({ error: "SMS isn't set up yet on this site — please use email instead." }, { status: 503 });
    await sendSms(env, { to: address, body: `Thai Massage For U: your code to claim "${listing.name}" is ${code}. Expires in ${OTP_TTL_MINUTES} minutes.` });
  }

  return Response.json({ sent: true, channel, maskedAddress: maskAddress(channel, address) });
}

export async function handleClaimVerify(request: Request, env: Env) {
  const body = await request.json<{ listingSlug?: string; channel?: string; code?: string }>().catch(() => ({}) as { listingSlug?: string; channel?: string; code?: string });
  const channel = body.channel === "sms" ? "sms" : body.channel === "email" ? "email" : null;
  if (!body.listingSlug || !channel || !body.code) return Response.json({ error: "listingSlug, channel and code are required." }, { status: 400 });

  const listing = await findListing(env, body.listingSlug);
  if (!listing) return Response.json({ error: "That listing isn't in the directory." }, { status: 404 });
  if (listing.owner_id) return Response.json({ error: "This listing has already been claimed." }, { status: 409 });

  const limited = await rateLimit(env, `claim-verify:${listing.slug}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return Response.json({ error: "Too many attempts — try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const otp = await env.DB.prepare("SELECT id, address FROM qh_otp_codes WHERE listing_id = ? AND channel = ? AND code = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1")
    .bind(listing.id, channel, body.code.trim())
    .first<{ id: number; address: string }>();
  if (!otp) return Response.json({ error: "That code is incorrect or has expired." }, { status: 400 });

  await env.DB.prepare("UPDATE qh_otp_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(otp.id).run();

  const openId = `otp:${channel}:${otp.address}`;
  await env.DB.prepare(
    `INSERT INTO qh_users (open_id, name, email, login_method, role, last_signed_in)
     VALUES (?, ?, ?, ?, 'user', CURRENT_TIMESTAMP)
     ON CONFLICT(open_id) DO UPDATE SET last_signed_in = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(openId, listing.name, channel === "email" ? otp.address : null, `otp-${channel}`)
    .run();
  const user = await env.DB.prepare("SELECT id FROM qh_users WHERE open_id = ? LIMIT 1").bind(openId).first<{ id: number }>();
  if (!user) return Response.json({ error: "Something went wrong creating your account." }, { status: 500 });

  // Guarded by owner_id IS NULL so two concurrent verifies on the same listing can't both win.
  const claimed = await env.DB.prepare("UPDATE qh_listings SET owner_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id IS NULL").bind(user.id, listing.id).run();
  if (!claimed.meta.changes) return Response.json({ error: "This listing was just claimed by someone else." }, { status: 409 });

  const session = await new SignJWT({ openId, appId: env.APP_ID ?? "local", name: listing.name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS)
    .sign(secret(env));

  const headers = new Headers({ "content-type": "application/json" });
  headers.append("Set-Cookie", `${COOKIE_NAME}=${session}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; Secure; HttpOnly; SameSite=Lax`);
  return new Response(JSON.stringify({ success: true, listingSlug: listing.slug }), { status: 200, headers });
}

export type OwnerListing = {
  id: number;
  slug: string;
  name: string;
  descriptor: string | null;
  description: string | null;
  neighbourhood: string | null;
  address: string | null;
  bookingUrl: string | null;
  contactEmail: string | null;
  imageUrl: string | null;
};

export async function handleGetOwnerListing(env: Env, userId: number) {
  const listing = await env.DB.prepare(
    "SELECT id, slug, name, descriptor, description, neighbourhood, address, booking_url AS bookingUrl, contact_email AS contactEmail, image_url AS imageUrl FROM qh_listings WHERE owner_id = ? LIMIT 1",
  )
    .bind(userId)
    .first<OwnerListing>();
  if (!listing) return Response.json({ error: "You haven't claimed a listing yet." }, { status: 404 });
  return Response.json({ listing });
}

export async function handleUpdateOwnerListing(request: Request, env: Env, userId: number) {
  const body = await request
    .json<{ descriptor?: string; description?: string; neighbourhood?: string; address?: string; bookingUrl?: string; contactEmail?: string; imageUrl?: string }>()
    .catch(() => ({}) as Record<string, string>);
  const result = await env.DB.prepare(
    `UPDATE qh_listings SET
      descriptor = COALESCE(?, descriptor),
      description = COALESCE(?, description),
      neighbourhood = COALESCE(?, neighbourhood),
      address = COALESCE(?, address),
      booking_url = COALESCE(?, booking_url),
      contact_email = COALESCE(?, contact_email),
      image_url = COALESCE(?, image_url),
      updated_at = CURRENT_TIMESTAMP
     WHERE owner_id = ?`,
  )
    .bind(body.descriptor ?? null, body.description ?? null, body.neighbourhood ?? null, body.address ?? null, body.bookingUrl ?? null, body.contactEmail ?? null, body.imageUrl ?? null, userId)
    .run();
  if (!result.meta.changes) return Response.json({ error: "You haven't claimed a listing yet." }, { status: 404 });
  return Response.json({ success: true });
}

/** Looks up a listing by name so an owner can find and claim it from a general page (home,
 * a country page) that doesn't already know which listing is theirs. Shows already-claimed
 * matches too (flagged, not hidden) so a real result isn't mistaken for "we don't have you". */
export async function handleClaimSearch(request: Request, env: Env) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const country = (url.searchParams.get("country") ?? "").trim().toLowerCase();
  if (q.length < 2) return Response.json({ results: [] });

  const query = country
    ? env.DB.prepare(
        `SELECT ql.slug, ql.name, qc.slug AS citySlug, qc.country_code AS countryCode, ql.owner_id AS ownerId
         FROM qh_listings ql JOIN qh_cities qc ON qc.id = ql.city_id
         WHERE ql.name LIKE ? AND qc.country_code = ? ORDER BY ql.name LIMIT 15`,
      ).bind(`%${q}%`, country)
    : env.DB.prepare(
        `SELECT ql.slug, ql.name, qc.slug AS citySlug, qc.country_code AS countryCode, ql.owner_id AS ownerId
         FROM qh_listings ql JOIN qh_cities qc ON qc.id = ql.city_id
         WHERE ql.name LIKE ? ORDER BY ql.name LIMIT 15`,
      ).bind(`%${q}%`);

  const { results } = await query.all<{ slug: string; name: string; citySlug: string; countryCode: string; ownerId: number | null }>();
  return Response.json({ results: results.map(r => ({ slug: r.slug, name: r.name, citySlug: r.citySlug, countryCode: r.countryCode, claimed: Boolean(r.ownerId) })) });
}
