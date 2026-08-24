import Stripe from "stripe";
import type { Env } from "./index";

// Introductory launch pricing — cheap enough to remove hesitation on a
// first cold ask, before any studio has evidence the placement earns its
// keep. Revisit once the first cohort has seen real leads land.
export const PREMIUM_TIER = {
  city: { amount: 900, interval: "week" as const, label: "Premium City Listing", description: "Featured city placement, billed weekly. Launch pricing." },
  country: { amount: 4900, interval: "month" as const, label: "Premium Country Listing", description: "Country-level discoverability and priority placement, billed monthly. Launch pricing." },
} as const;

function stripe(env: Env) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  return new Stripe(env.STRIPE_SECRET_KEY);
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
  const session = await stripe(env).checkout.sessions.create({
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
export async function handlePublicPremiumCheckout(request: Request, env: Env) {
  const body = await request.json<{ listingSlug?: string; tier?: string; email?: string }>().catch(() => ({}) as { listingSlug?: string; tier?: string; email?: string });
  const tier = body.tier === "country" ? "country" : body.tier === "city" ? "city" : null;
  if (!body.listingSlug || !tier) return Response.json({ error: "listingSlug and tier are required." }, { status: 400 });
  const listing = await env.DB.prepare("SELECT id, slug FROM qh_listings WHERE slug = ? LIMIT 1").bind(body.listingSlug).first<{ id: number; slug: string }>();
  if (!listing) return Response.json({ error: "That listing isn't in the directory yet." }, { status: 404 });
  const { url } = await createPremiumCheckout(env, { listingId: listing.id, listingSlug: listing.slug, origin: new URL(request.url).origin, tier, customerEmail: body.email });
  return Response.json({ checkoutUrl: url });
}

export async function handleStripeWebhook(request: Request, env: Env) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Stripe webhook is not configured" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe(env).webhooks.constructEvent(await request.text(), signature, env.STRIPE_WEBHOOK_SECRET);
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
    }
  }
  return Response.json({ received: true });
}
