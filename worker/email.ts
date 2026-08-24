import type { Env } from "./index";

/**
 * Cloudflare has no outbound email-sending API of its own — Email Routing
 * only receives/forwards mail for a zone (used below for inbound replies).
 * Sending goes through Resend's REST API instead, the transactional-email
 * provider this project's own handover notes already pointed at. Requires
 * a RESEND_API_KEY secret (wrangler secret put RESEND_API_KEY) and the
 * sending domain (thaimassageforu.com) verified in the Resend dashboard —
 * neither of which this Worker can set up on its own.
 */
const FROM_ADDRESS = "Thai Massage For U <hello@thaimassageforu.com>";
const REPLY_TO = "hello@thaimassageforu.com";

export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function sendEmail(env: Env, input: { to: string; subject: string; html: string; unsubscribeUrl: string }) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
  const html = `${input.html}\n<hr style="margin-top:32px;border:none;border-top:1px solid #e5e5e5" />\n<p style="font-size:12px;color:#888">Thai Massage For U — a directory of independently listed wellness places.<br /><a href="${input.unsubscribeUrl}" style="color:#888">Unsubscribe</a></p>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      reply_to: REPLY_TO,
      to: [input.to],
      subject: input.subject,
      html,
      headers: { "List-Unsubscribe": `<${input.unsubscribeUrl}>` },
    }),
  });
  const body = await response.json<{ id?: string; message?: string }>();
  if (!response.ok) throw new Error(body.message ?? `Resend send failed (${response.status})`);
  return { providerMessageId: body.id ?? null };
}

/**
 * Resend webhooks are Svix-signed. Verifying properly needs the `svix`
 * package; this does the same HMAC check by hand to avoid the extra
 * dependency for one route. See https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
 */
export async function verifyResendSignature(env: Env, request: Request, rawBody: string): Promise<boolean> {
  if (!env.RESEND_WEBHOOK_SECRET) return false;
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;
  const secretBytes = Uint8Array.from(atob(env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return signature.split(" ").some(part => part.split(",")[1] === expected);
}
