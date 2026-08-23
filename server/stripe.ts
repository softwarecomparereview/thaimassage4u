import type { Request, Response } from "express";
import Stripe from "stripe";
import { registerPremiumSubscription } from "./db";
import { ENV } from "./_core/env";

export const PREMIUM_TIER = {
  city: { amount: 2100, interval: "week" as const, label: "Premium City Listing", description: "Featured city placement, billed weekly." },
  country: { amount: 15900, interval: "month" as const, label: "Premium Country Listing", description: "Country-level discoverability and priority placement, billed monthly." },
} as const;

function getStripe() {
  if (!ENV.stripeSecretKey) throw new Error("Stripe is not configured");
  return new Stripe(ENV.stripeSecretKey);
}

export async function createPremiumCheckout(input: {
  listingId: number;
  userId: number;
  userEmail?: string | null;
  userName?: string | null;
  origin: string;
  tier: "city" | "country";
}) {
  const stripe = getStripe();
  const plan = PREMIUM_TIER[input.tier];
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.userEmail || undefined,
    client_reference_id: input.userId.toString(),
    allow_promotion_codes: true,
    metadata: {
      listing_id: input.listingId.toString(),
      tier: input.tier,
      user_id: input.userId.toString(),
      customer_email: input.userEmail || "",
      customer_name: input.userName || "",
    },
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: plan.label, description: plan.description },
        unit_amount: plan.amount,
        recurring: { interval: plan.interval, interval_count: 1 },
      },
      quantity: 1,
    }],
    success_url: `${input.origin}/cms?checkout=success&listing=${input.listingId}`,
    cancel_url: `${input.origin}/list-your-place?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not provide a checkout URL");
  return session.url;
}

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!ENV.stripeWebhookSecret) return res.status(500).json({ error: "Stripe webhook is not configured" });
  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) return res.status(400).json({ error: "Missing Stripe signature" });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, ENV.stripeWebhookSecret);
  } catch (error) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${error instanceof Error ? error.message : "unknown error"}` });
  }

  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const listingId = Number(session.metadata?.listing_id);
    const tier = session.metadata?.tier === "country" ? "country" : "city";
    if (Number.isInteger(listingId) && listingId > 0) {
      await registerPremiumSubscription({
        listingId,
        tier,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
        stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
      });
    }
  }
  console.log(`[Webhook] Processed ${event.type} (${event.id})`);
  return res.json({ received: true });
}
