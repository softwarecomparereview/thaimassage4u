import type { Env } from "./index";

/**
 * Sends via Cloudflare's own Email Sending binding
 * (https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
 * — no API token, no third-party provider. Requires:
 *   1. `send_email: [{ name: "EMAIL" }]` in wrangler.jsonc (done)
 *   2. thaimassageforu.com verified as a sending domain in the Cloudflare
 *      dashboard (Email → Email Sending) — a dashboard step, not something
 *      a Worker deploy can do. Sending before that's done fails with
 *      E_SENDER_NOT_VERIFIED.
 *
 * Cloudflare's send call itself reports delivered/bounced synchronously
 * (see processCampaignSend in campaigns.ts) — there's no documented
 * webhook for delivery events. There's also no built-in open/click
 * tracking, so both are done here: a 1x1 pixel on every send
 * (trackingPixelUrl) and outbound links rewritten through a redirect
 * that logs the click before forwarding (rewriteLinks).
 */
const FROM_ADDRESS = "hello@thaimassageforu.com";
const FROM_NAME = "Thai Massage For U";

export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function rewriteLinks(html: string, siteUrl: string, recipientId: number): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url) => `href="${siteUrl}/api/campaigns/click?r=${recipientId}&u=${encodeURIComponent(url)}"`);
}

/**
 * Overflow providers, tried in order when Cloudflare's daily quota is hit.
 * All three are free-tier HTTP APIs (no SMTP possible from Workers): Resend gives
 * 100/day (3k/mo), Brevo 300/day forever, Mailjet 200/day (6k/mo). Stacked on
 * Cloudflare's ~200/day that's ~800/day sustained at $0. Each activates only when
 * its secret exists; all three send from the same verified hello@ address, so
 * SPF/DKIM/DMARC for each provider must be added to the domain's DNS before their
 * sends land in inboxes rather than spam — that's a dashboard/DNS step, not
 * something a Worker deploy can do (see the DNS records each provider's own
 * domain-verification page gives you). Resend is tried first among the three: it
 * was the first added, its free-tier ceiling is the lowest of the three, and its
 * deliverability reputation from a freshly verified domain is generally strong.
 */
async function sendViaResend(env: Env, to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_ADDRESS}>`, to: [to], subject, html, text }),
  });
  return response.ok;
}

async function sendViaBrevo(env: Env, to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!env.BREVO_API_KEY) return false;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ sender: { name: FROM_NAME, email: FROM_ADDRESS }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
  });
  return response.ok;
}

async function sendViaMailjet(env: Env, to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!env.MAILJET_API_KEY || !env.MAILJET_API_SECRET) return false;
  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { authorization: `Basic ${btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_API_SECRET}`)}`, "content-type": "application/json" },
    body: JSON.stringify({ Messages: [{ From: { Email: FROM_ADDRESS, Name: FROM_NAME }, To: [{ Email: to }], Subject: subject, HTMLPart: html, TextPart: text }] }),
  });
  return response.ok;
}

export async function sendEmail(env: Env, input: { to: string; subject: string; html: string; unsubscribeUrl: string; recipientId: number }) {
  const trackingPixel = `<img src="${env.SITE_URL}/api/campaigns/open?r=${input.recipientId}" width="1" height="1" alt="" style="display:none" />`;
  const html = `${rewriteLinks(input.html, env.SITE_URL, input.recipientId)}\n<hr style="margin-top:32px;border:none;border-top:1px solid #e5e5e5" />\n<p style="font-size:12px;color:#888">Thai Massage For U — a directory of independently listed wellness places.<br /><a href="${input.unsubscribeUrl}" style="color:#888">Unsubscribe</a></p>${trackingPixel}`;
  const text = input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  try {
    const result = await env.EMAIL.send({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: input.to,
      subject: input.subject,
      html,
      text,
    });
    const bounced = result.permanent_bounces?.includes(input.to);
    return { delivered: !bounced, bounced: Boolean(bounced) };
  } catch (error) {
    // Only the daily-quota error falls through to overflow providers — a bounce
    // or bad address must NOT be retried elsewhere (that's how domains get burned).
    if (!/quota/i.test(String(error))) throw error;
    if (await sendViaResend(env, input.to, input.subject, html, text)) return { delivered: true, bounced: false };
    if (await sendViaBrevo(env, input.to, input.subject, html, text)) return { delivered: true, bounced: false };
    if (await sendViaMailjet(env, input.to, input.subject, html, text)) return { delivered: true, bounced: false };
    throw error;
  }
}

/**
 * Plain transactional send — no tracking pixel, no click-rewriting, no
 * unsubscribe footer. Used for one-off account mail (OTP login codes) where
 * none of that campaign machinery makes sense.
 */
export async function sendTransactionalEmail(env: Env, input: { to: string; subject: string; html: string; text?: string }) {
  const result = await env.EMAIL.send({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text ?? input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  });
  const bounced = result.permanent_bounces?.includes(input.to);
  return { delivered: !bounced, bounced: Boolean(bounced) };
}
