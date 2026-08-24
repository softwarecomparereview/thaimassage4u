import type { Env } from "./index";
import type { WorkerUser } from "./auth";
import { resolveAudience, unsubToken, ALWAYS_CC, type CampaignRecipientRow } from "./campaigns";
import { verifyTwilioSignature } from "./sms";

const TRANSPARENT_PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7"), c => c.charCodeAt(0));

type CreateCampaignInput = {
  name: string;
  channel: "email" | "sms";
  subject?: string;
  body: string;
  audienceSource: "csv" | "city" | "country";
  citySlugs?: string[];
  countryCode?: string;
  csvRows?: { name?: string; email?: string; phone?: string }[];
};

export async function handleCreateCampaign(request: Request, env: Env, user: WorkerUser) {
  const input = await request.json<CreateCampaignInput>().catch(() => null);
  if (!input?.name || !input.body || !input.channel) return Response.json({ error: "name, channel, and body are required." }, { status: 400 });

  const rows: CampaignRecipientRow[] = (input.csvRows ?? []).map(r => ({ name: r.name ?? null, email: r.email ?? null, phone: r.phone ?? null, city_slug: null, country_code: null, listing_id: null }));
  const audience = await resolveAudience(env, input.audienceSource, { rows, citySlugs: input.citySlugs, countryCode: input.countryCode }, input.channel);

  // Every email send always carries these two as a live check — a real send
  // is never fired blind. Added before the empty-audience check below so a
  // deliberate test-only send (empty CSV) still goes to them.
  if (input.channel === "email") {
    for (const address of ALWAYS_CC) {
      if (!audience.some(r => r.email?.toLowerCase() === address.toLowerCase())) {
        audience.push({ name: "Team", email: address, phone: null, city_slug: null, country_code: null, listing_id: null });
      }
    }
  }

  if (!audience.length) return Response.json({ error: "No recipients found for that audience — nothing to send to." }, { status: 400 });

  const campaign = await env.DB.prepare("INSERT INTO qh_campaigns (name, channel, subject, body, audience_source, audience_filter, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(input.name, input.channel, input.subject ?? null, input.body, input.audienceSource, JSON.stringify({ citySlugs: input.citySlugs, countryCode: input.countryCode }), user.id)
    .run();
  const campaignId = Number(campaign.meta.last_row_id);

  const inserts = audience.map(r =>
    env.DB.prepare("INSERT INTO qh_campaign_recipients (campaign_id, listing_id, name, email, phone, city_slug, country_code) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(campaignId, r.listing_id, r.name, r.email, r.phone, r.city_slug, r.country_code),
  );
  for (let i = 0; i < inserts.length; i += 50) await env.DB.batch(inserts.slice(i, i + 50));

  return Response.json({ campaignId, recipientCount: audience.length });
}

export async function handleSendCampaign(env: Env, campaignId: number) {
  const campaign = await env.DB.prepare("SELECT id, status FROM qh_campaigns WHERE id = ?").bind(campaignId).first<{ id: number; status: string }>();
  if (!campaign) return Response.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign.status !== "draft") return Response.json({ error: `Campaign is already ${campaign.status}.` }, { status: 400 });

  const { results } = await env.DB.prepare("SELECT id FROM qh_campaign_recipients WHERE campaign_id = ? AND status = 'queued'").bind(campaignId).all<{ id: number }>();
  await env.DB.prepare("UPDATE qh_campaigns SET status = 'sending', sent_at = CURRENT_TIMESTAMP WHERE id = ?").bind(campaignId).run();
  for (let i = 0; i < results.length; i += 100) {
    await env.LEADS.sendBatch(results.slice(i, i + 100).map(r => ({ body: { recipientId: r.id } })));
  }
  return Response.json({ queued: results.length });
}

export async function handleListCampaigns(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.channel, c.status, c.created_at, c.sent_at,
            COUNT(r.id) AS total,
            SUM(CASE WHEN r.status IN ('sent','delivered','opened','clicked') THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN r.status = 'delivered' OR r.status = 'opened' OR r.status = 'clicked' THEN 1 ELSE 0 END) AS delivered,
            SUM(CASE WHEN r.status = 'opened' OR r.status = 'clicked' THEN 1 ELSE 0 END) AS opened,
            SUM(CASE WHEN r.status = 'clicked' THEN 1 ELSE 0 END) AS clicked,
            SUM(CASE WHEN r.status = 'bounced' THEN 1 ELSE 0 END) AS bounced,
            SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM qh_campaigns c LEFT JOIN qh_campaign_recipients r ON r.campaign_id = c.id
     GROUP BY c.id ORDER BY c.created_at DESC`,
  ).all();
  return Response.json({ campaigns: results });
}

export async function handleListInbox(env: Env) {
  const { results } = await env.DB.prepare("SELECT * FROM qh_inbound_messages ORDER BY received_at DESC LIMIT 200").all();
  return Response.json({ messages: results });
}

export async function handleMarkInboxRead(env: Env, id: number) {
  await env.DB.prepare("UPDATE qh_inbound_messages SET read_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}

export async function handleUnsubscribe(request: Request, env: Env) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");
  if (!email || !token || token !== (await unsubToken(env, email))) return new Response("Invalid unsubscribe link.", { status: 400 });
  await env.DB.prepare("INSERT INTO qh_suppressions (channel, address, reason) VALUES ('email', ?, 'unsubscribed') ON CONFLICT(channel, address) DO NOTHING").bind(email).run();
  return new Response("You've been unsubscribed and won't receive further emails from Thai Massage For U.", { status: 200, headers: { "content-type": "text/plain" } });
}

/**
 * Cloudflare's Email Sending doesn't have documented delivery webhooks or
 * open/click tracking, so both are DIY: a 1x1 pixel embedded in every send
 * (worker/email.ts) hits this on open, and every outbound link in the
 * email is rewritten to route through handleCampaignClick first.
 */
export async function handleCampaignOpen(env: Env, recipientId: number) {
  await env.DB.prepare("UPDATE qh_campaign_recipients SET status = 'opened', opened_at = CURRENT_TIMESTAMP WHERE id = ? AND status NOT IN ('opened', 'clicked')").bind(recipientId).run();
  return new Response(TRANSPARENT_PIXEL, { headers: { "content-type": "image/gif", "cache-control": "no-store" } });
}

export async function handleCampaignClick(env: Env, recipientId: number, targetUrl: string | null) {
  if (!targetUrl) return new Response("Missing target URL", { status: 400 });
  await env.DB.prepare("UPDATE qh_campaign_recipients SET status = 'clicked', clicked_at = CURRENT_TIMESTAMP WHERE id = ?").bind(recipientId).run();
  return Response.redirect(targetUrl, 302);
}

export async function handleTwilioStatusWebhook(request: Request, env: Env) {
  const form = Object.fromEntries((await request.formData()).entries()) as Record<string, string>;
  if (!(await verifyTwilioSignature(env, request, request.url, form))) return new Response("Invalid signature", { status: 401 });
  const status = { delivered: "delivered", failed: "failed", undelivered: "failed" }[form.MessageStatus] as string | undefined;
  if (status && form.MessageSid) {
    const column = status === "delivered" ? "delivered_at" : null;
    await env.DB.prepare(`UPDATE qh_campaign_recipients SET status = ?${column ? `, ${column} = CURRENT_TIMESTAMP` : ""} WHERE provider_message_id = ?`).bind(status, form.MessageSid).run();
  }
  return new Response(null, { status: 204 });
}

export async function handleTwilioInboundWebhook(request: Request, env: Env) {
  const form = Object.fromEntries((await request.formData()).entries()) as Record<string, string>;
  if (!(await verifyTwilioSignature(env, request, request.url, form))) return new Response("Invalid signature", { status: 401 });
  await env.DB.prepare("INSERT INTO qh_inbound_messages (channel, from_address, to_address, body) VALUES ('sms', ?, ?, ?)").bind(form.From, form.To, form.Body ?? "").run();
  if (/^\s*stop\s*$/i.test(form.Body ?? "")) await env.DB.prepare("INSERT INTO qh_suppressions (channel, address, reason) VALUES ('sms', ?, 'unsubscribed') ON CONFLICT(channel, address) DO NOTHING").bind(form.From).run();
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { status: 200, headers: { "content-type": "text/xml" } });
}
