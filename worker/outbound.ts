import type { Env } from "./index";

/**
 * Tracked outbound redirect for a listing page's "Book direct" link.
 *
 * Every listing's outbound website/booking link used to be a raw <a href> straight to the
 * business's own site: no record of how many visitors this site actually sends anyone, and no
 * way to ever monetize a booking-platform referral program (Fresha, Booksy, Vagaro, Treatwell)
 * even if one existed, since those programs pay on referred bookings attributed through a
 * redirect they control the format of.
 *
 * BOOKING_PLATFORMS below only *detects* which platform a listing's own booking URL points at —
 * it does not fabricate an affiliate wrapper. Each platform's real deeplink/query-param format is
 * specific to whatever program you're actually accepted into, and guessing it would produce a
 * link that's either not tracked (silently loses the referral) or, worse, visibly broken. Once a
 * real program is joined, wire its real deeplink format into `wrap()` for that one platform,
 * gated on the matching env secret being set — same pattern AWIN_PUBLISHER_ID/
 * AWIN_ALIEXPRESS_ADVERTISER_ID already use in worker/supplies.ts for AliExpress. Until then this
 * still earns its keep: every click is logged with which platform it went to, which is exactly
 * the data needed to know which program is worth applying to first.
 */
const BOOKING_PLATFORMS: Array<{ platform: string; hostIncludes: string }> = [
  { platform: "fresha", hostIncludes: "fresha.com" },
  { platform: "booksy", hostIncludes: "booksy.com" },
  { platform: "vagaro", hostIncludes: "vagaro.com" },
  { platform: "treatwell", hostIncludes: "treatwell." },
  { platform: "mindbody", hostIncludes: "mindbodyonline.com" },
  { platform: "setmore", hostIncludes: "setmore.com" },
];

function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BOOKING_PLATFORMS.find(p => host.includes(p.hostIncludes))?.platform ?? null;
  } catch {
    return null;
  }
}

/** Redirects only ever go to a listing's own bookingUrl already on file — never an arbitrary
 * query param — so this can't be used as an open redirect. */
export async function handleListingClick(request: Request, env: Env) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return new Response("Missing slug", { status: 400 });
  const listing = await env.DB.prepare("SELECT id, website, city_slug, country_code FROM listings WHERE slug = ? AND status = 'published' LIMIT 1")
    .bind(slug)
    .first<{ id: number; website: string | null; city_slug: string | null; country_code: string | null }>();
  if (!listing?.website) return new Response("Listing has no outbound link on file", { status: 404 });
  const platform = detectPlatform(listing.website);
  await env.DB.prepare("INSERT INTO qh_listing_clicks (listing_id, slug, city_slug, country_code, platform, url) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(listing.id, slug, listing.city_slug, listing.country_code, platform, listing.website)
    .run();
  env.ANALYTICS?.writeDataPoint({ blobs: ["listing_click", listing.country_code ?? "", platform ?? "direct", slug], doubles: [1], indexes: [platform ?? "direct"] });
  return Response.redirect(listing.website, 302);
}

/** Admin: which booking platforms this site's outbound traffic is actually reaching, and how
 * often — the exact evidence needed to decide which affiliate program to apply to first. */
export async function handleListingClickStats(env: Env) {
  const [byPlatform, last7] = await Promise.all([
    env.DB.prepare("SELECT COALESCE(platform, 'direct') AS platform, COUNT(*) AS clicks FROM qh_listing_clicks GROUP BY platform ORDER BY clicks DESC").all(),
    env.DB.prepare("SELECT DATE(clicked_at) AS day, COUNT(*) AS clicks FROM qh_listing_clicks WHERE clicked_at >= DATETIME('now', '-7 days') GROUP BY day ORDER BY day").all(),
  ]);
  return Response.json({ byPlatform: byPlatform.results, last7: last7.results });
}
