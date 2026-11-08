import type { Env } from "./index";
import { sendTransactionalEmail } from "./email";
import type { WaitUntil } from "./pml-lead";

/**
 * Directory enquiry emails.
 *
 * A visitor's enquiry on a listing page goes to the SHOP, from hello@thaimassageforu.com, with
 * Reply-To set to the visitor — so the shop just hits reply and answers the customer directly.
 * We (CONTACT_EMAIL) get our own copy as a separate message that also says what happened to the
 * shop's email (sent / bounced / failed / no address on file), so a lead that could not reach
 * the shop is never silent.
 *
 * Runs after the visitor's response via ctx.waitUntil, same as the Pilot My Life forward in
 * worker/pml-lead.ts. It never throws: the enquiry is already saved in D1, and every failure
 * is logged ([enquiry-email] in Workers Logs) instead of failing the visitor's request.
 */

export interface Enquiry {
  inquiryId: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  /** Null when the enquiry was not tied to a listing (or the listing could not be found). */
  listing: { name: string; slug: string; claimed: boolean; shopEmail: string | null } | null;
}

export type ShopOutcome = "sent" | "bounced" | "failed" | "no-email";

const EMAIL_PATTERN = /^[^\s@<>"',;()]+@[^\s@<>"',;()]+\.[a-z]{2,}$/i;
// Scraped listing data sometimes holds asset names like "logo@2x.png" in the email column.
const FILE_NAME = /\.(png|jpe?g|gif|webp|svg|css|js)$/i;

/** First usable address in a free-text field ("a@x.com; b@y.com" -> a@x.com), or null. */
export function pickEmail(raw: string | null | undefined): string | null {
  for (const token of (raw ?? "").split(/[\s,;]+/)) {
    const candidate = token.replace(/^mailto:/i, "");
    if (EMAIL_PATTERN.test(candidate) && !FILE_NAME.test(candidate)) return candidate.toLowerCase();
  }
  return null;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

function detailRows(enquiry: Enquiry): [string, string][] {
  const rows: [string, string][] = [["Name", enquiry.name], ["Email", enquiry.email]];
  if (enquiry.phone) rows.push(["Phone", enquiry.phone]);
  return rows;
}

function detailsHtml(enquiry: Enquiry): string {
  const rows = detailRows(enquiry).map(([label, value]) => `<tr><td style="padding:2px 16px 2px 0;color:#666">${label}</td><td style="padding:2px 0"><strong>${escapeHtml(value)}</strong></td></tr>`).join("");
  return `<table style="border-collapse:collapse;margin:12px 0">${rows}</table><p style="margin:12px 0 4px;color:#666">Message</p><blockquote style="margin:0;padding:8px 14px;border-left:3px solid #ddd;white-space:pre-wrap">${escapeHtml(enquiry.message)}</blockquote>`;
}

function detailsText(enquiry: Enquiry): string {
  return `${detailRows(enquiry).map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nMessage:\n${enquiry.message}`;
}

/** What the shop receives. */
export function buildShopEmail(enquiry: Enquiry, env: Pick<Env, "SITE_URL" | "CONTACT_EMAIL">) {
  const listing = enquiry.listing;
  const shopName = listing ? oneLine(listing.name) : "your business";
  const pageUrl = listing ? `${env.SITE_URL}/listing/${listing.slug}` : env.SITE_URL;
  const claimLine = listing && !listing.claimed ? ` To change the address enquiries go to, claim your listing (it's free) at <a href="${pageUrl}">${pageUrl}</a>.` : "";
  const claimText = listing && !listing.claimed ? ` To change the address enquiries go to, claim your listing (it's free) at ${pageUrl}.` : "";
  const subject = `New enquiry for ${shopName} — Thai Massage For U`;
  const html = `<p>Hi ${escapeHtml(shopName)} team,</p><p>Someone found you on <a href="${env.SITE_URL}">Thai Massage For U</a> and sent you this enquiry:</p>${detailsHtml(enquiry)}<p><strong>Just reply to this email</strong> — your reply goes straight to ${escapeHtml(enquiry.name)}.</p><hr style="margin-top:28px;border:none;border-top:1px solid #e5e5e5" /><p style="font-size:12px;color:#888">Sent through your listing at <a href="${pageUrl}" style="color:#888">${pageUrl}</a>.${claimLine} To stop getting enquiries by email, write to ${escapeHtml(env.CONTACT_EMAIL)}.</p>`;
  const text = `Hi ${shopName} team,\n\nSomeone found you on Thai Massage For U and sent you this enquiry:\n\n${detailsText(enquiry)}\n\nJust reply to this email — your reply goes straight to ${enquiry.name}.\n\n--\nSent through your listing at ${pageUrl}.${claimText} To stop getting enquiries by email, write to ${env.CONTACT_EMAIL}.`;
  return { subject, html, text };
}

const OUTCOME_TAG: Record<ShopOutcome, string> = {
  sent: "Sent to shop",
  bounced: "SHOP EMAIL BOUNCED",
  failed: "SHOP EMAIL FAILED",
  "no-email": "NO SHOP EMAIL ON FILE",
};

function outcomeSentence(enquiry: Enquiry, outcome: ShopOutcome): string {
  const shopEmail = enquiry.listing?.shopEmail;
  switch (outcome) {
    case "sent": return `Delivered to the shop at ${shopEmail}. They can reply straight to the customer.`;
    case "bounced": return `The shop's address (${shopEmail}) bounced, so they have NOT seen this. Follow up with the shop yourself.`;
    case "failed": return `Sending to the shop (${shopEmail}) failed, so they have NOT seen this. Follow up with the shop yourself.`;
    case "no-email": return enquiry.listing
      ? "This listing has no usable email address, so the shop has NOT seen this. Follow up with the shop by phone or website, or reply to the customer yourself."
      : "This enquiry was not tied to a listing, so no shop was emailed.";
  }
}

/** Our own copy — same enquiry plus what happened to the shop's email. */
export function buildCopyEmail(enquiry: Enquiry, outcome: ShopOutcome, env: Pick<Env, "SITE_URL">) {
  const listing = enquiry.listing;
  const where = listing ? oneLine(listing.name) : "no listing";
  const subject = `[Copy] ${OUTCOME_TAG[outcome]} — enquiry for ${where}`;
  const sentence = outcomeSentence(enquiry, outcome);
  const pageUrl = listing ? `${env.SITE_URL}/listing/${listing.slug}` : null;
  const colour = outcome === "sent" ? "#1a7f37" : "#b42318";
  const html = `<p style="padding:10px 14px;border-left:4px solid ${colour};background:#f6f6f6"><strong>${OUTCOME_TAG[outcome]}.</strong> ${escapeHtml(sentence)}</p>${detailsHtml(enquiry)}${pageUrl ? `<p style="font-size:12px;color:#888">Listing: <a href="${pageUrl}" style="color:#888">${pageUrl}</a> · enquiry #${enquiry.inquiryId}</p>` : `<p style="font-size:12px;color:#888">Enquiry #${enquiry.inquiryId}</p>`}`;
  const text = `${OUTCOME_TAG[outcome]}. ${sentence}\n\n${detailsText(enquiry)}\n\n${pageUrl ? `Listing: ${pageUrl} · ` : ""}Enquiry #${enquiry.inquiryId}`;
  return { subject, html, text };
}

/** Emails the shop, then sends our copy. Never throws. */
export async function sendEnquiryEmails(env: Env, enquiry: Enquiry): Promise<ShopOutcome> {
  const replyTo = pickEmail(enquiry.email) ?? undefined;
  const shopEmail = enquiry.listing?.shopEmail ?? null;

  let outcome: ShopOutcome = "no-email";
  if (shopEmail) {
    try {
      const { bounced } = await sendTransactionalEmail(env, { to: shopEmail, replyTo, ...buildShopEmail(enquiry, env) });
      outcome = bounced ? "bounced" : "sent";
    } catch (error) {
      outcome = "failed";
      console.warn(`[enquiry-email] shop send failed for enquiry ${enquiry.inquiryId}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (outcome !== "sent") console.warn(`[enquiry-email] enquiry ${enquiry.inquiryId} did not reach the shop (${outcome})`);
  }

  const copyTo = env.CONTACT_EMAIL;
  // When the shop's own address is ours, the first message already is the copy.
  if (copyTo && !(outcome === "sent" && shopEmail === copyTo.toLowerCase())) {
    try {
      await sendTransactionalEmail(env, { to: copyTo, replyTo, ...buildCopyEmail(enquiry, outcome, env) });
    } catch (error) {
      console.warn(`[enquiry-email] copy send failed for enquiry ${enquiry.inquiryId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return outcome;
}

/** Fire-and-forget: runs sendEnquiryEmails after the response when an ExecutionContext is available. */
export function queueEnquiryEmails(env: Env, ctx: WaitUntil | undefined, enquiry: Enquiry): void {
  const pending = sendEnquiryEmails(env, enquiry).catch(error => {
    console.warn(`[enquiry-email] unexpected failure for enquiry ${enquiry.inquiryId}: ${error instanceof Error ? error.message : String(error)}`);
  });
  try {
    ctx?.waitUntil(pending);
  } catch (error) {
    console.warn(`[enquiry-email] waitUntil unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}
