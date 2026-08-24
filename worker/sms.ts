import type { Env } from "./index";

/**
 * Cloudflare has no SMS product at all (sending or receiving) — this goes
 * through Twilio's REST API. Requires TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER secrets, plus a Twilio number
 * with its inbound-message webhook pointed at
 * POST /api/webhooks/twilio/inbound (see worker/index.ts) for replies.
 */
export async function sendSms(env: Env, input: { to: string; body: string }) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) throw new Error("Twilio is not configured");
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      To: input.to,
      From: env.TWILIO_FROM_NUMBER,
      Body: input.body,
      StatusCallback: `${env.SITE_URL}/api/webhooks/twilio/status`,
    }),
  });
  const body = await response.json<{ sid?: string; message?: string }>();
  if (!response.ok) throw new Error(body.message ?? `Twilio send failed (${response.status})`);
  return { providerMessageId: body.sid ?? null };
}

/** Twilio signs webhook requests with HMAC-SHA1 over the full URL + sorted form params. */
export async function verifyTwilioSignature(env: Env, request: Request, url: string, form: Record<string, string>): Promise<boolean> {
  if (!env.TWILIO_AUTH_TOKEN) return false;
  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;
  const data = url + Object.keys(form).sort().map(key => key + form[key]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TWILIO_AUTH_TOKEN), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}
