/**
 * The single definition of what premium placement costs. Until this file
 * existed, /list-your-place advertised US$21/week and US$159/month while the
 * buy button on every listing page — and the Stripe line item behind it —
 * charged $9/week and $49/month. Both pages were public and indexed.
 *
 * Anything that shows or charges a price reads it from here: the marketing
 * page, the listing-page checkout box, and worker/stripe.ts.
 */
export type PremiumTier = "city" | "country";

export const PREMIUM_TIERS: Record<PremiumTier, {
  /** Cents, in USD — what Stripe is actually told to charge. */
  amountCents: number;
  interval: "week" | "month";
  label: string;
  /** Rendered price, derived below so copy can never drift from the charge. */
  description: string;
}> = {
  city: {
    amountCents: 900,
    interval: "week",
    label: "Premium city listing",
    description: "Priority placement in one city, above the organic results, clearly labelled as featured.",
  },
  country: {
    amountCents: 4900,
    interval: "month",
    label: "Premium country listing",
    description: "Priority placement across every city in one country, clearly labelled as featured.",
  },
};

export function formatPremiumPrice(tier: PremiumTier): string {
  const plan = PREMIUM_TIERS[tier];
  const dollars = plan.amountCents / 100;
  const amount = Number.isInteger(dollars) ? dollars.toFixed(0) : dollars.toFixed(2);
  return `US$${amount} / ${plan.interval}`;
}
