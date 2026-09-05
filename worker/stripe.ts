import Stripe from "stripe";
import { PREMIUM_TIERS } from "../shared/pricing";
import type { Env } from "./index";

// Introductory launch pricing — cheap enough to remove hesitation on a
// first cold ask, before any studio has evidence the placement earns its
// keep. Revisit once the first cohort has seen real leads land.
//
// The amounts live in shared/pricing.ts so the marketing page, the listing-page
// buy button and this Stripe line item cannot quote different numbers.
export const PREMIUM_TIER = {
  city: { amount: PREMIUM_TIERS.city.amountCents, interval: PREMIUM_TIERS.city.interval, label: "TMFU Premium City Listing", description: "Featured city placement on Thai Massage For U (TMFU), billed weekly. Launch pricing." },
  country: { amount: PREMIUM_TIERS.country.amountCents, interval: PREMIUM_TIERS.country.interval, label: "TMFU Premium Country Listing", description: "Country-level discoverability and priority placement on Thai Massage For U (TMFU), billed monthly. Launch pricing." },
} as const;

/**
 * Placement is decided by `listings.premium` — that is the column every public
 * ORDER BY reads. The subscription row in qh_premium_subscriptions is the
 * billing record; before this, only that row was written, so a studio could pay
 * and see no change in ranking, no featured band and no badge off its own page.
 * The two tables are joined by slug, so both are updated together here.
 */
async function setPlacement(env: Env, listingId: number, active: boolean) {
  await env.DB.prepare("UPDATE qh_premium_subscriptions SET placement_eligible = ?, updated_at = CURRENT_TIMESTAMP WHERE listing_id = ?").bind(active ? 1 : 0, listingId).run();
  const qhListing = await env.DB.prepare("SELECT slug FROM qh_listings WHERE id = ? LIMIT 1").bind(listingId).first<{ slug: string }>();
  if (qhListing?.slug) await env.DB.prepare("UPDATE listings SET premium = ? WHERE slug = ?").bind(active ? 1 : 0, qhListing.slug).run();
}

/** Resolves the qh_listings row a Stripe subscription belongs to. */
async function listingForSubscription(env: Env, subscriptionId: string | null) {
  if (!subscriptionId) return null;
  const row = await env.DB.prepare("SELECT listing_id AS listingId FROM qh_premium_subscriptions WHERE stripe_subscription_id = ? LIMIT 1").bind(subscriptionId).first<{ listingId: number }>();
  return row?.listingId ?? null;
}

/**
 * qh_settings.stripe_mode picks which secret to use — STRIPE_SECRET_KEY
 * holds the live key (set directly on Cloudflare), STRIPE_SECRET_KEY_TEST
 * holds the test one (a separate secret, since Cloudflare can't have two
 * values under one secret name and secrets can't be read back once set).
 * Defaults to "test" if the row is ever missing — a missing setting
 * should never silently mean "charge real cards".
 */
export async function getStripeMode(env: Env): Promise<"test" | "live"> {
  const row = await env.DB.prepare("SELECT value FROM qh_settings WHERE key = 'stripe_mode'").first<{ value: string }>();
  return row?.value === "live" ? "live" : "test";
}

export async function setStripeMode(env: Env, mode: "test" | "live"): Promise<void> {
  await env.DB.prepare("INSERT INTO qh_settings (key, value, updated_at) VALUES ('stripe_mode', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(mode).run();
}

async function stripe(env: Env) {
  const mode = await getStripeMode(env);
  const key = mode === "live" ? env.STRIPE_SECRET_KEY : env.STRIPE_SECRET_KEY_TEST;
  if (!key) throw new Error(mode === "live" ? "STRIPE_SECRET_KEY is not configured" : "STRIPE_SECRET_KEY_TEST is not configured — add it as a Worker secret to use test mode");
  return new Stripe(key);
}

/**
 * Deliberately ownerless: a studio can buy premium placement for its own
 * listing straight from the public listing page, with no account and no
 * claim flow. metadata.listing_id is all the webhook needs to activate it
 * (see handleStripeWebhook below) — client_reference_id/userId are just
 * for later matching to a real account if/when this listing gets claimed.
 */
export async function createPremiumCheckout(env: Env, input: { listingId: number; listingSlug: string; origin: string; tier: "city" | "country"; customerEmail?: string | null; userId?: number | null }) {
  const plan = PREMIUM_TIER[input.tier];
  const session = await (await stripe(env)).checkout.sessions.create({
    mode: "subscription",
    customer_email: input.customerEmail || undefined,
    client_reference_id: input.userId ? input.userId.toString() : undefined,
    allow_promotion_codes: true,
    metadata: { listing_id: input.listingId.toString(), tier: input.tier },
    line_items: [{ price_data: { currency: "usd", product_data: { name: plan.label, description: plan.description }, unit_amount: plan.amount, recurring: { interval: plan.interval, interval_count: 1 } }, quantity: 1 }],
    success_url: `${input.origin}/listing/${input.listingSlug}?premium=success`,
    cancel_url: `${input.origin}/listing/${input.listingSlug}?premium=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not provide a checkout URL");
  return { url: session.url, livemode: session.livemode };
}

/**
 * Public, no-login checkout — the whole point of this route is that a
 * studio owner can pay for premium placement straight from their own
 * listing page (or a link in an announcement email) without creating an
 * account or claiming anything first.
 */
/**
 * qh_listings is a separate, older mirror of the real `listings` table (see worker/directory.ts's
 * header comment) that stopped tracking new imports after a one-time sync — 407 of 1,564
 * published listings (26%) had no row there at all, so the buy button on every one of those
 * pages 404'd with "That listing isn't in the directory yet" even though the listing was live and
 * fully published. Backfilled once (worker/migrations/0019_backfill_qh_listings.sql), but that
 * only fixes listings that already existed — any future import hits the same gap the moment it's
 * published, since nothing keeps the two tables in sync. Self-healing here (create the missing
 * mirror row on the fly, from the real listing + its city) means a broken checkout button can
 * never recur for any published listing, present or future, regardless of import-pipeline drift.
 */
async function ensureQhListing(env: Env, slug: string): Promise<{ id: number; slug: string } | null> {
  const existing = await env.DB.prepare("SELECT id, slug FROM qh_listings WHERE slug = ? LIMIT 1").bind(slug).first<{ id: number; slug: string }>();
  if (existing) return existing;
  const listing = await env.DB.prepare("SELECT name, slug, descriptor, description, suburb, address, website, email, image_url, city_slug FROM listings WHERE slug = ? AND status = 'published' LIMIT 1")
    .bind(slug)
    .first<{ name: string; slug: string; descriptor: string | null; description: string | null; suburb: string | null; address: string | null; website: string | null; email: string | null; image_url: string | null; city_slug: string }>();
  if (!listing) return null;
  const city = await env.DB.prepare("SELECT id FROM qh_cities WHERE slug = ? LIMIT 1").bind(listing.city_slug).first<{ id: number }>();
  if (!city) return null; // No matching city row — genuinely can't place it; caller reports the same 404 as before.
  const inserted = await env.DB.prepare(
    "INSERT INTO qh_listings (city_id, category_id, name, slug, descriptor, description, neighbourhood, address, booking_url, contact_email, image_url, status) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')",
  )
    .bind(city.id, listing.name, listing.slug, listing.descriptor, listing.description, listing.suburb, listing.address, listing.website, listing.email, listing.image_url)
    .run();
  return { id: Number(inserted.meta.last_row_id), slug: listing.slug };
}

export async function handlePublicPremiumCheckout(request: Request, env: Env) {
  const body = await request.json<{ listingSlug?: string; tier?: string; email?: string }>().catch(() => ({}) as { listingSlug?: string; tier?: string; email?: string });
  const tier = body.tier === "country" ? "country" : body.tier === "city" ? "city" : null;
  if (!body.listingSlug || !tier) return Response.json({ error: "listingSlug and tier are required." }, { status: 400 });
  const listing = await ensureQhListing(env, body.listingSlug);
  if (!listing) return Response.json({ error: "That listing isn't in the directory yet." }, { status: 404 });
  const { url } = await createPremiumCheckout(env, { listingId: listing.id, listingSlug: listing.slug, origin: new URL(request.url).origin, tier, customerEmail: body.email });
  return Response.json({ checkoutUrl: url });
}

export async function handleStripeWebhook(request: Request, env: Env) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Stripe webhook is not configured" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = (await stripe(env)).webhooks.constructEvent(await request.text(), signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return Response.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }
  if (event.id.startsWith("evt_test_")) return Response.json({ verified: true });
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const listingId = Number(session.metadata?.listing_id);
    const tier = session.metadata?.tier === "country" ? "country" : "city";
    if (Number.isInteger(listingId) && listingId > 0) {
      await env.DB.prepare("INSERT INTO qh_premium_subscriptions (listing_id, tier, stripe_customer_id, stripe_subscription_id, placement_eligible) VALUES (?, ?, ?, ?, 1) ON CONFLICT(listing_id) DO UPDATE SET tier=excluded.tier, stripe_customer_id=excluded.stripe_customer_id, stripe_subscription_id=excluded.stripe_subscription_id, placement_eligible=1, updated_at=CURRENT_TIMESTAMP")
        .bind(listingId, tier, typeof session.customer === "string" ? session.customer : session.customer?.id ?? null, typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null)
        .run();
      await setPlacement(env, listingId, true);
    }
  }

  // Without these, placement was granted once and never withdrawn: a cancelled
  // or unpaid subscription kept its ranking, its featured band and its badge
  // indefinitely.
  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const listingId = await listingForSubscription(env, subscription.id);
    if (listingId) {
      const active = subscription.status === "active" || subscription.status === "trialing";
      await setPlacement(env, listingId, active);
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;
    const listingId = await listingForSubscription(env, subscriptionId);
    if (listingId) await setPlacement(env, listingId, false);
  }

  return Response.json({ received: true });
}
