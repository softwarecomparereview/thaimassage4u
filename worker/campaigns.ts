import type { Env } from "./index";
import { renderTemplate, sendEmail } from "./email";
import { sendSms } from "./sms";

export type CampaignRecipientRow = { name: string | null; email: string | null; phone: string | null; city_slug: string | null; country_code: string | null; listing_id: number | null };

/** Always copied on every send so a real send is never fired blind. */
export const ALWAYS_CC = ["aniruddhp@gmail.com", "hello@thaimassageforu.com"];

/** A few honest, city-specific lines on why the directory is useful there — used as {{city_blurb}} in templates. Falls back to a generic line for any city not listed here. */
export const CITY_BLURBS: Record<string, string> = {
  melbourne: "Melbourne's wellness scene is dense and word-of-mouth driven — a lot of great studios in the CBD, Southbank and the inner suburbs never show up for someone searching from a hotel or new to the area. We're building a straightforward, city-first directory so people looking for a proper Thai massage in Melbourne can actually find you.",
  sydney: "Sydney has more visitors and transplants searching \"massage near me\" on any given day than almost any other city we cover — CBD workers, tourists around Circular Quay and Bondi, people between meetings. Most of that search traffic never reaches an independent studio's own website. That's the gap we're filling.",
  berlin: "Berlin is our single highest-demand city — public keyword data shows tens of thousands of monthly searches for \"thai massage berlin\" and its variants, more than any other city we cover. Most of that search volume lands on directories and franchises, not on an independent studio's own site. We built Berlin's page to change that.",
  munich: "Munich searchers skew premium and time-pressed — Altstadt offices, Schwabing residents, trade-fair visitors who want something booked before lunch, not a long research session. A clear, city-first listing is what gets picked in that window.",
  hamburg: "Hamburg's studios are spread across the Innenstadt, Sternschanze and the harbour district, which makes word-of-mouth alone unreliable — someone new to a neighbourhood has no way to know you're two streets over. That's exactly the gap a proper city directory closes.",
  frankfurt: "Frankfurt mixes banking-district lunch-break searches with residents in Westend and Sachsenhausen — high intent, low patience. A studio that's easy to find in that moment gets the booking; one that isn't loses it to whoever ranks first.",
  cologne: "Cologne's Thai massage searches cluster around the Ring, the Belgian Quarter and cathedral-adjacent visitor traffic — a lot of it from people new to the city who have no existing studio in mind yet. A clear listing is how you become the one they find.",
};
const DEFAULT_CITY_BLURB = "We're building a straightforward, city-first wellness directory so people searching for a real studio — not a franchise — can actually find you.";

/** Excludes anyone a previous campaign already successfully reached on this channel — checked
 * against qh_campaign_recipients.sent_at, which every send already stamps (see processCampaignSend
 * below). Keeps a city/country audience from re-hitting the same businesses on a later campaign.
 * 'queued'/'sending'/'failed'/'bounced'/'unsubscribed' don't count as "already emailed" — only a
 * send that actually went out does. CSV audiences bypass this on purpose: that list was hand-picked
 * for this send, so it's not silently filtered. */
const ALREADY_CONTACTED_CLAUSE = `NOT EXISTS (
    SELECT 1 FROM qh_campaign_recipients cr
    JOIN qh_campaigns c ON c.id = cr.campaign_id
    WHERE c.channel = ? AND cr.__COLUMN__ = listings.__COLUMN__ AND cr.status IN ('sent', 'delivered', 'opened', 'clicked')
  )`;

/** Legacy `listings`/`cities` is the real contact-data source — it has
 * both phone and email for the 494+4 real businesses; qh_listings (synced
 * for the CMS dashboard) only carries contact_email. */
export async function resolveAudience(env: Env, source: "csv" | "city" | "country", filter: { rows?: CampaignRecipientRow[]; citySlugs?: string[]; countryCode?: string }, channel: "email" | "sms"): Promise<CampaignRecipientRow[]> {
  if (source === "csv") return filter.rows ?? [];
  const column = channel === "email" ? "email" : "phone";
  const alreadyContacted = ALREADY_CONTACTED_CLAUSE.replaceAll("__COLUMN__", column);
  if (source === "city" && filter.citySlugs?.length) {
    const placeholders = filter.citySlugs.map(() => "?").join(",");
    const { results } = await env.DB.prepare(`SELECT id AS listing_id, name, email, phone, city_slug, country_code FROM listings WHERE city_slug IN (${placeholders}) AND ${column} IS NOT NULL AND ${column} != '' AND ${alreadyContacted}`).bind(...filter.citySlugs, channel).all<CampaignRecipientRow & { name: string; listing_id: number }>();
    return results.map(r => ({ ...r, name: r.name }));
  }
  if (source === "country" && filter.countryCode) {
    const { results } = await env.DB.prepare(`SELECT id AS listing_id, name, email, phone, city_slug, country_code FROM listings WHERE country_code = ? AND ${column} IS NOT NULL AND ${column} != '' AND ${alreadyContacted}`).bind(filter.countryCode, channel).all<CampaignRecipientRow & { name: string; listing_id: number }>();
    return results.map(r => ({ ...r, name: r.name }));
  }
  return [];
}

export async function isSuppressed(env: Env, channel: "email" | "sms", address: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 FROM qh_suppressions WHERE channel = ? AND address = ? LIMIT 1").bind(channel, address).first();
  return Boolean(row);
}

type QueueMessage = { recipientId: number };

/** Called from the Worker's queue() consumer — one message per recipient. */
export async function processCampaignSend(env: Env, message: QueueMessage) {
  const recipient = await env.DB.prepare("SELECT qh_campaign_recipients.*, qh_campaigns.channel, qh_campaigns.subject, qh_campaigns.body FROM qh_campaign_recipients JOIN qh_campaigns ON qh_campaigns.id = qh_campaign_recipients.campaign_id WHERE qh_campaign_recipients.id = ?")
    .bind(message.recipientId)
    .first<{ id: number; campaign_id: number; name: string | null; email: string | null; phone: string | null; city_slug: string | null; country_code: string | null; channel: "email" | "sms"; subject: string | null; body: string }>();
  if (!recipient) return;

  const address = recipient.channel === "email" ? recipient.email : recipient.phone;
  if (!address) {
    await env.DB.prepare("UPDATE qh_campaign_recipients SET status = 'failed', error = 'No address on file' WHERE id = ?").bind(recipient.id).run();
    return;
  }
  if (await isSuppressed(env, recipient.channel, address)) {
    await env.DB.prepare("UPDATE qh_campaign_recipients SET status = 'unsubscribed' WHERE id = ?").bind(recipient.id).run();
    return;
  }

  const cityName = recipient.city_slug ? recipient.city_slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "";
  const vars = { name: recipient.name ?? "there", city: cityName, country: (recipient.country_code ?? "").toUpperCase(), country_code: (recipient.country_code ?? "").toLowerCase(), city_blurb: recipient.city_slug ? (CITY_BLURBS[recipient.city_slug] ?? DEFAULT_CITY_BLURB) : DEFAULT_CITY_BLURB };
  try {
    if (recipient.channel === "email") {
      const unsubscribeUrl = `${env.SITE_URL}/api/campaigns/unsubscribe?email=${encodeURIComponent(address)}&token=${await unsubToken(env, address)}`;
      const { delivered, bounced } = await sendEmail(env, { to: address, subject: renderTemplate(recipient.subject ?? "Thai Massage For U", vars), html: renderTemplate(recipient.body, vars), unsubscribeUrl, recipientId: recipient.id });
      if (bounced) {
        await env.DB.prepare("UPDATE qh_campaign_recipients SET status = 'bounced', bounced_at = CURRENT_TIMESTAMP WHERE id = ?").bind(recipient.id).run();
        await env.DB.prepare("INSERT INTO qh_suppressions (channel, address, reason) VALUES ('email', ?, 'bounced') ON CONFLICT(channel, address) DO NOTHING").bind(address).run();
      } else {
        await env.DB.prepare(`UPDATE qh_campaign_recipients SET status = ?, sent_at = CURRENT_TIMESTAMP, delivered_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(delivered ? "delivered" : "sent", recipient.id).run();
      }
    } else {
      const { providerMessageId } = await sendSms(env, { to: address, body: renderTemplate(recipient.body, vars) });
      await env.DB.prepare("UPDATE qh_campaign_recipients SET status = 'sent', provider_message_id = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?").bind(providerMessageId, recipient.id).run();
    }
  } catch (error) {
    await env.DB.prepare("UPDATE qh_campaign_recipients SET status = 'failed', error = ? WHERE id = ?").bind(String(error instanceof Error ? error.message : error), recipient.id).run();
  }
}

/** Short-lived unsubscribe token — HMAC of the address, not a stored secret per-recipient. */
export async function unsubToken(env: Env, address: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(address));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/[+/=]/g, "");
}
