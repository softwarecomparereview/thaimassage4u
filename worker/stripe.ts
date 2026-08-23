import Stripe from "stripe";
import type { Env } from "./index";

export const PREMIUM_TIER = {
  city: { amount: 2100, interval: "week" as const, label: "Premium City Listing", description: "Featured city placement, billed weekly." },
  country: { amount: 15900, interval: "month" as const, label: "Premium Country Listing", description: "Country-level discoverability and priority placement, billed monthly." },
} as const;

function stripe(env: Env) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export async function createPremiumCheckout(env: Env, input: { listingId: number; userId: number; userEmail?: string | null; userName?: string | null; origin: string; tier: "city" | "country" }) {
  const plan = PREMIUM_TIER[input.tier];
  const session = await stripe(env).checkout.sessions.create({
    mode: "subscription",
    customer_email: input.userEmail || undefined,
    client_reference_id: input.userId.toString(),
    allow_promotion_codes: true,
    metadata: { listing_id: input.listingId.toString(), tier: input.tier, user_id: input.userId.toString(), customer_email: input.userEmail || "", customer_name: input.userName || "" },
    line_items: [{ price_data: { currency: "usd", product_data: { name: plan.label, description: plan.description }, unit_amount: plan.amount, recurring: { interval: plan.interval, interval_count: 1 } }, quantity: 1 }],
    success_url: `${input.origin}/cms?checkout=success&listing=${input.listingId}`,
    cancel_url: `${input.origin}/list-your-place?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not provide a checkout URL");
  return session.url;
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
