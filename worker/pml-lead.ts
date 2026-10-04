// Forward a lead to Pilot My Life's lead intake (POST /hooks/thaimassageforu/lead-form).
//
// The site keeps doing what it already does with a lead (D1 row in qh_inquiries, CMS inbox, the
// claim flow); this only adds a signed copy so PML can qualify and remember it. It never blocks,
// slows or fails the visitor's request: callers hand it to ctx.waitUntil (see sendLeadToPml) so it
// runs after the response, with an 8s timeout, and every error is caught and logged.
//
// Signature (PML "pml-timestamped" scheme): x-pml-timestamp = unix seconds,
// x-pml-signature = sha256=hex(HMAC-SHA256(secret, `${timestamp}.${body}`)).
//
// Environment (Worker `thaimassageforu`):
//   PML_LEAD_WEBHOOK_SECRET  (Worker secret) shared with PML's lead-form webhook secret for this
//                            venture. Unset = nothing is sent (the feature is off).
//   PML_LEAD_WEBHOOK_URL     (optional) defaults to https://pilotmylife.com/hooks/thaimassageforu/lead-form
//
// Wired at: directory inquiry (REST /api/directory/inquiry and tRPC directory.submitInquiry, via
// createInquiry in worker/directory.ts) and a completed listing claim (/api/claim/verify).

export type PmlLeadEnv = { PML_LEAD_WEBHOOK_SECRET?: string; PML_LEAD_WEBHOOK_URL?: string };

export interface PmlLead {
  name?: string;
  email: string;
  phone?: string;
  message?: string;
  /** Path of the page the form was on. */
  page?: string;
  /** The visitor asked to be contacted (enquiry), so PML may keep the full message. */
  consent: boolean;
}

/** The part of ExecutionContext we need; matches both Workers' ExecutionContext and Hono's. */
export type WaitUntil = { waitUntil(promise: Promise<unknown>): void };

const DEFAULT_URL = "https://pilotmylife.com/hooks/thaimassageforu/lead-form";
const TIMEOUT_MS = 8_000;

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Builds the signed request; exported for tests. */
export async function signedLeadRequest(lead: PmlLead, secret: string, url = DEFAULT_URL, now = Date.now()): Promise<Request> {
  const body = JSON.stringify(lead);
  const ts = String(Math.floor(now / 1000));
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pml-timestamp": ts, "x-pml-signature": `sha256=${await hmacHex(secret, `${ts}.${body}`)}` },
    body,
  });
}

/** Sends one lead. Never throws; resolves once PML answered, failed or timed out. */
export async function forwardLead(env: PmlLeadEnv, lead: PmlLead): Promise<void> {
  if (!env.PML_LEAD_WEBHOOK_SECRET) return;
  if (!lead.email) return; // PML requires an email; phone-only leads stay on the site.
  try {
    const res = await fetch(await signedLeadRequest(lead, env.PML_LEAD_WEBHOOK_SECRET, env.PML_LEAD_WEBHOOK_URL || DEFAULT_URL), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) console.warn(`[pml-lead] PML returned HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[pml-lead] forward failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Fire-and-forget: runs forwardLead after the response when an ExecutionContext is available. */
export function sendLeadToPml(env: PmlLeadEnv, ctx: WaitUntil | undefined, lead: PmlLead): void {
  if (!env.PML_LEAD_WEBHOOK_SECRET || !lead.email) return;
  const pending = forwardLead(env, lead);
  try {
    if (ctx) ctx.waitUntil(pending);
  } catch (err) {
    console.warn(`[pml-lead] waitUntil unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Path of the page a form was submitted from, taken from the Referer (path only, never query). */
export function refererPath(request: Request): string | undefined {
  const referer = request.headers.get("referer");
  if (!referer) return undefined;
  try {
    return new URL(referer).pathname;
  } catch {
    return undefined;
  }
}
