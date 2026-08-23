import type { Request, Response } from "express";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { handleStripeWebhook, PREMIUM_TIER } from "./stripe";

describe("premium listing pricing", () => {
  it("keeps the city placement at US$21 per week", () => {
    expect(PREMIUM_TIER.city).toMatchObject({ amount: 2100, interval: "week", label: "Premium City Listing" });
  });

  it("keeps the country placement at US$159 per month", () => {
    expect(PREMIUM_TIER.country).toMatchObject({ amount: 15900, interval: "month", label: "Premium Country Listing" });
  });

  it("verifies a signed Stripe test event without activating a subscription", async () => {
    const payload = JSON.stringify({ id: "evt_test_quiet_hour", object: "event", api_version: "2025-06-30", created: 0, data: { object: {} }, livemode: false, pending_webhooks: 1, request: null, type: "checkout.session.completed" });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: ENV.stripeWebhookSecret });
    let statusCode = 200;
    let responseBody: unknown;
    const response = {
      status: (code: number) => { statusCode = code; return response; },
      json: (body: unknown) => { responseBody = body; return response; },
    } as unknown as Response;

    await handleStripeWebhook({ headers: { "stripe-signature": signature }, body: payload } as unknown as Request, response);

    expect(statusCode).toBe(200);
    expect(responseBody).toEqual({ verified: true });
  });
});
