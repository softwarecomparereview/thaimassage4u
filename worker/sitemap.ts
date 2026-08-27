import { PUBLIC_ARTICLE_STATUSES, PUBLISHED } from "./directory";
import type { Env } from "./index";

/** Every URL a search engine should be able to find, generated fresh from the same tables the
 * live pages read from — nothing hand-maintained to drift out of sync. Splits into one file per
 * URL type via ?type= so a single request never has to hold all of them in memory at once; the
 * index file just points to each. Well under Google's 50,000-URLs-per-file limit either way. */

const STATIC_PATHS = ["/", "/directory", "/journal", "/list-your-place"];
const COUNTRY_CODES = ["us", "uk", "au", "de", "ca", "nz", "ie", "ae"];

function urlEntry(loc: string, lastmod?: string | null) {
  return `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}</url>`;
}

function xml(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

export async function handleSitemapIndex(env: Env) {
  const origin = env.SITE_URL.replace(/\/$/, "");
  const sitemaps = ["static", "cities", "listings", "journal"]
    .map(type => `<sitemap><loc>${origin}/sitemap-${type}.xml</loc></sitemap>`)
    .join("");
  return new Response(xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}</sitemapindex>`), {
    headers: { "content-type": "application/xml; charset=UTF-8", "cache-control": "public, max-age=3600" },
  });
}

export async function handleSitemapStatic(env: Env) {
  const origin = env.SITE_URL.replace(/\/$/, "");
  const urls = [...STATIC_PATHS, ...COUNTRY_CODES.map(code => `/${code}`), ...COUNTRY_CODES.map(code => `/${code}/supplies`)].map(path => urlEntry(`${origin}${path}`));
  return sitemapResponse(urls);
}

export async function handleSitemapCities(env: Env) {
  const origin = env.SITE_URL.replace(/\/$/, "");
  const { results } = await env.DB.prepare("SELECT slug FROM cities ORDER BY slug").all<{ slug: string }>();
  const urls = results.map(row => urlEntry(`${origin}/city/${row.slug}`));
  return sitemapResponse(urls);
}

export async function handleSitemapListings(env: Env) {
  const origin = env.SITE_URL.replace(/\/$/, "");
  const { results } = await env.DB.prepare(`SELECT slug, created_at FROM listings WHERE ${PUBLISHED} ORDER BY id`).all<{ slug: string; created_at: string | null }>();
  const urls = results.map(row => urlEntry(`${origin}/listing/${row.slug}`, row.created_at));
  return sitemapResponse(urls);
}

export async function handleSitemapJournal(env: Env) {
  const origin = env.SITE_URL.replace(/\/$/, "");
  // Must match the visibility rule the article pages themselves use
  // (PUBLIC_ARTICLE_STATUSES in worker/directory.ts). While this said
  // `status = 'published'` and the pages accepted 'review' too, all 20 live,
  // publicly readable articles were missing from the sitemap entirely.
  const { results } = await env.DB.prepare(`SELECT slug, updated_at FROM qh_articles WHERE status IN (${PUBLIC_ARTICLE_STATUSES}) ORDER BY id`).all<{ slug: string; updated_at: string | null }>();
  const urls = results.map(row => urlEntry(`${origin}/journal/${row.slug}`, row.updated_at));
  return sitemapResponse(urls);
}

function sitemapResponse(urls: string[]) {
  return new Response(xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`), {
    headers: { "content-type": "application/xml; charset=UTF-8", "cache-control": "public, max-age=3600" },
  });
}

export function handleRobotsTxt(env: Env) {
  const origin = env.SITE_URL.replace(/\/$/, "");
  return new Response(`User-agent: *\nAllow: /\nDisallow: /cms\nDisallow: /my-listing\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: { "content-type": "text/plain; charset=UTF-8", "cache-control": "public, max-age=3600" },
  });
}
