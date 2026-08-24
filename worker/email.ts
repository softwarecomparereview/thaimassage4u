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

export async function sendEmail(env: Env, input: { to: string; subject: string; html: string; unsubscribeUrl: string; recipientId: number }) {
  const trackingPixel = `<img src="${env.SITE_URL}/api/campaigns/open?r=${input.recipientId}" width="1" height="1" alt="" style="display:none" />`;
  const html = `${rewriteLinks(input.html, env.SITE_URL, input.recipientId)}\n<hr style="margin-top:32px;border:none;border-top:1px solid #e5e5e5" />\n<p style="font-size:12px;color:#888">Thai Massage For U — a directory of independently listed wellness places.<br /><a href="${input.unsubscribeUrl}" style="color:#888">Unsubscribe</a></p>${trackingPixel}`;
  const result = await env.EMAIL.send({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to: input.to,
    subject: input.subject,
    html,
    text: input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  });
  const bounced = result.permanent_bounces?.includes(input.to);
  return { delivered: !bounced, bounced: Boolean(bounced) };
}
