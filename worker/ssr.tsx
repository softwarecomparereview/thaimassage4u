import { dehydrate, QueryClient } from "@tanstack/react-query";
import { TRPCError } from "@trpc/server";
import { prefetchForPath, type HeadMeta } from "../client/src/ssr/prefetch";
import { formatPremiumPrice, PREMIUM_TIERS } from "../shared/pricing";
import { getArticle, getCityGuide, getCountryGuide, getDirectoryHome, getListing } from "./directory";
import type { Env } from "./index";

const siteName = "Quiet Hour";
const defaultDescription = "A considered guide to wellness places, rituals, and city intelligence.";
const clean = (value: string, length: number) => Array.from(value.replace(/\s+/g, " ").trim()).slice(0, length).join("");
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
// [text](url) links are the one bit of real markdown article bodies use — mainly to link a
// country/massage-guide article back to the relevant /city/{slug} or /listing/{slug} page for
// internal linking. Applied after escape() so the brackets/parens in the source are still plain
// characters to match against; the resulting <a> is real, crawlable HTML, not escaped text.
const markdown = (value: string) => escape(value).replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').split(/\n{2,}/).map(block => block.startsWith("<h") ? block : `<p>${block.replace(/\n/g, "<br />")}</p>`).join("");

function renderHead(head: HeadMeta, origin: string) {
  const title = escape(clean(head.title || siteName, 70));
  const description = escape(clean(head.description || defaultDescription, 200));
  const canonical = head.canonicalPath ? `${origin}${head.canonicalPath}` : "";
  const image = head.ogImage?.startsWith("/") ? `${origin}${head.ogImage}` : head.ogImage;
  const tags = [`<title>${title}</title>`, `<meta name="description" content="${description}" />`, `<meta property="og:type" content="${head.ogType || "website"}" />`, `<meta property="og:title" content="${title}" />`, `<meta property="og:description" content="${description}" />`, `<meta property="og:site_name" content="${siteName}" />`, `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`, `<meta name="twitter:title" content="${title}" />`, `<meta name="twitter:description" content="${description}" />`];
  if (canonical) tags.push(`<link rel="canonical" href="${escape(canonical)}" />`, `<meta property="og:url" content="${escape(canonical)}" />`);
  for (const alternate of head.alternates ?? []) tags.push(`<link rel="alternate" hreflang="${escape(alternate.locale)}" href="${escape(`${origin}${alternate.path}`)}" />`);
  if (image) tags.push(`<meta property="og:image" content="${escape(image)}" />`, `<meta name="twitter:image" content="${escape(image)}" />`);
  if (head.noindex || head.notFound) tags.push(`<meta name="robots" content="noindex, follow" />`);
  if (head.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(head.jsonLd).replace(/</g, "\\u003c")}</script>`);
  return tags.join("\n");
}

async function getHead(pathAndSearch: string, env: Env) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  const head = await prefetchForPath(pathAndSearch, queryClient, {
    home: () => getDirectoryHome(env) as any,
    listingBySlug: async slug => { const value = await getListing(env, slug); if (!value) throw new TRPCError({ code: "NOT_FOUND" }); return value as any; },
    articleBySlug: async slug => { const value = await getArticle(env, slug); if (!value) throw new TRPCError({ code: "NOT_FOUND" }); return value as any; },
    cityBySlug: async slug => { const value = await getCityGuide(env, slug); if (!value) throw new TRPCError({ code: "NOT_FOUND" }); return value as any; },
    countryBySlug: async code => { const value = await getCountryGuide(env, code); if (!value) throw new TRPCError({ code: "NOT_FOUND" }); return value as any; },
  });
  return { head, state: dehydrate(queryClient) };
}

async function renderPublicBody(rawPath: string, env: Env) {
  const path = rawPath !== "/" ? rawPath.replace(/\/+$/, "") : rawPath;
  const articleMatch = path.match(/^\/journal\/([^/]+)$/);
  if (articleMatch) {
    const article = await getArticle(env, articleMatch[1]);
    if (!article) return `<main class="worker-ssr"><h1>Page not found</h1><p>This article is not available.</p></main>`;
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/journal">Journal</a></nav><article><p class="eyebrow">${escape(String(article.topic ?? "Wellness"))}</p><h1>${escape(String(article.title))}</h1><p class="lede">${escape(String(article.excerpt ?? ""))}</p>${markdown(String(article.body ?? ""))}</article></main>`;
  }
  const countryMatch = path.match(/^\/(us|uk|au|de)$/);
  if (countryMatch) {
    const guide = await getCountryGuide(env, countryMatch[1]);
    if (!guide) return `<main class="worker-ssr"><h1>Page not found</h1></main>`;
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/directory">Explore</a></nav><h1>Wellness in ${escape(guide.country.name)}</h1><ul>${guide.cities.map(city => `<li><a href="/city/${escape(city.slug)}">${escape(city.name)}</a></li>`).join("")}</ul><ul>${guide.listings.map(item => `<li><a href="/listing/${escape(item.slug)}">${escape(item.name)}</a></li>`).join("")}</ul></main>`;
  }
  const cityMatch = path.match(/^\/city\/([^/]+)$/);
  if (cityMatch) {
    const guide = await getCityGuide(env, cityMatch[1]);
    if (!guide) return `<main class="worker-ssr"><h1>Page not found</h1></main>`;
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/directory">Explore</a></nav><h1>${escape(guide.city.name)} wellness guide</h1><p>${escape(String(guide.city.introduction ?? ""))}</p><ul>${guide.listings.map(item => `<li><a href="/listing/${escape(item.slug)}">${escape(item.name)}</a></li>`).join("")}</ul></main>`;
  }
  const listingMatch = path.match(/^\/listing\/([^/]+)$/);
  if (listingMatch) {
    const detail = await getListing(env, listingMatch[1]);
    if (!detail) return `<main class="worker-ssr"><h1>Page not found</h1></main>`;
    const facts = [
      detail.listing.address ? `<li>${escape(String(detail.listing.address))}</li>` : "",
      detail.listing.phone ? `<li><a href="tel:${escape(String(detail.listing.phone).replace(/[^+\d]/g, ""))}">${escape(String(detail.listing.phone))}</a></li>` : "",
      detail.listing.rating ? `<li>Rated ${escape(String(detail.listing.rating))} out of 5${detail.listing.reviewCount ? ` from ${escape(String(detail.listing.reviewCount))} Google reviews` : ""}</li>` : "",
      // Routed through the tracked redirect (worker/outbound.ts) — same link a hydrated client
      // renders (client/src/pages/ListingDetail.tsx) — so a crawler that never executes JS still
      // only ever sees the trackable URL, not the bare bookingUrl.
      detail.listing.bookingUrl ? `<li><a href="/api/directory/go?slug=${escape(listingMatch[1])}" rel="nofollow noreferrer">Visit website</a></li>` : "",
    ].join("");
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/directory">Explore</a></nav><article><h1>${escape(detail.listing.name)}</h1><p>${escape(String(detail.listing.description ?? detail.listing.descriptor ?? ""))}</p><p><a href="/city/${escape(detail.city.slug)}">${escape(String(detail.city.name))}</a></p><ul>${facts}</ul><ul>${detail.services.map(item => `<li>${escape(item.title)}</li>`).join("")}</ul></article></main>`;
  }
  if (path === "/list-your-place") {
    const tiers = (["city", "country"] as const).map(tier => `<li><strong>${escape(PREMIUM_TIERS[tier].label)}</strong> — ${escape(formatPremiumPrice(tier))}. ${escape(PREMIUM_TIERS[tier].description)}</li>`).join("");
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/directory">Explore</a></nav><h1>List your wellness studio</h1><p>Be found by people already looking for a treatment in your city. Paid placement is always labelled as featured.</p><ul>${tiers}</ul><p>Cancel anytime. Billed securely by Stripe.</p></main>`;
  }
  if (path === "/journal") {
    const home = await getDirectoryHome(env);
    const items = home.articles.map((item: any) => `<li><a href="/journal/${escape(String(item.slug))}">${escape(String(item.title))}</a> — ${escape(clean(String(item.excerpt ?? ""), 180))}</li>`).join("");
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/directory">Explore</a></nav><h1>Wellness journal</h1><ul>${items || "<li>Editorial notes are being prepared.</li>"}</ul></main>`;
  }
  if (path === "/directory") {
    const home = await getDirectoryHome(env);
    const cities = home.cities.map((city: any) => `<li><a href="/city/${escape(String(city.slug))}">${escape(String(city.name))}</a></li>`).join("");
    const places = home.listings.slice(0, 60).map((item: any) => `<li><a href="/listing/${escape(String(item.slug))}">${escape(String(item.name))}</a> — ${escape(String(item.cityName))}</li>`).join("");
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/journal">Journal</a></nav><h1>Wellness directory</h1><h2>Cities</h2><ul>${cities}</ul><h2>Places</h2><ul>${places}</ul></main>`;
  }
  const home = await getDirectoryHome(env);
  const journalItems = home.articles.slice(0, 3).map((item: any) => `<li><a href="/journal/${escape(String(item.slug))}">${escape(String(item.title))}</a></li>`).join("");
  return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/directory">Explore</a><a href="/journal">Journal</a><a href="/list-your-place">For studios</a></nav><section><p class="eyebrow">The considered city guide</p><h1>Find your <em>quiet</em> in the city.</h1><p>${defaultDescription}</p><a href="/directory">Explore the directory</a></section><section><h2>Latest field notes</h2><ul>${journalItems || "<li>Editorial notes are being prepared.</li>"}</ul></section></main>`;
}

function isAssetPath(pathname: string) {
  return pathname.startsWith("/assets/") || pathname.startsWith("/__manus__/") || /\.(?:js|css|ico|png|jpe?g|webp|svg|woff2?|map|json|txt)$/i.test(pathname);
}

export async function serveWorkerPage(request: Request, env: Env) {
  const url = new URL(request.url);
  if (isAssetPath(url.pathname)) return env.ASSETS.fetch(request);
  if (url.pathname === "/index.html") return Response.redirect(`${url.origin}/`, 301);
  if (url.pathname !== "/" && /\/+$/u.test(url.pathname)) return Response.redirect(`${url.origin}${url.pathname.replace(/\/+$/u, "")}${url.search}`, 301);
  // Three journal slugs were imported with literal quote characters (see
  // worker/migrations/0013_data_fixes.sql) — the quoted URL used to be what
  // actually resolved, so anything already indexed or bookmarked at that URL
  // needs a real redirect, not just a fixed database row.
  const quotedArticle = url.pathname.match(/^\/journal\/(.+)$/);
  if (quotedArticle && /['"]/.test(quotedArticle[1])) {
    const clean = quotedArticle[1].replace(/^['"]+|['"]+$/g, "");
    return Response.redirect(`${url.origin}/journal/${clean}${url.search}`, 301);
  }
  // Two now-retired URL schemes (a static-HTML era, then a /country/city/slug era before this
  // app's flat /listing/{slug} + /city/{slug} routes) left real, still-indexed pages 404ing —
  // confirmed via a Google Search Console coverage export, 2026-09-05: 219 URLs, 49 of which are
  // still-live published listings and cities, just parked under a path this app never serves.
  // Recover that indexed equity generically (does the URL's last segment match a live slug?)
  // rather than hand-mapping one export's URLs — the same retired scheme will keep resurfacing
  // in future crawls, and this catches all of it, not just what's in today's report.
  const segments = url.pathname.split("/").filter(Boolean);
  // Excludes every real route prefix this app serves so a coincidental slug collision (e.g. a
  // journal article and a listing sharing a slug) can never redirect a real page to the wrong one.
  const KNOWN_PREFIXES = new Set(["city", "listing", "journal", "cms", "supplies"]);
  const lastSegment = segments[segments.length - 1];
  if (segments.length >= 2 && !KNOWN_PREFIXES.has(segments[0]) && !KNOWN_PREFIXES.has(lastSegment)) {
    const listing = await env.DB.prepare("SELECT slug FROM listings WHERE slug = ? AND status = 'published' LIMIT 1").bind(lastSegment).first<{ slug: string }>();
    if (listing) return Response.redirect(`${url.origin}/listing/${listing.slug}${url.search}`, 301);
  }
  if (segments.length === 2 && !KNOWN_PREFIXES.has(segments[0]) && !KNOWN_PREFIXES.has(lastSegment)) {
    const city = await env.DB.prepare("SELECT slug FROM cities WHERE slug = ? LIMIT 1").bind(lastSegment).first<{ slug: string }>();
    if (city) return Response.redirect(`${url.origin}/city/${city.slug}${url.search}`, 301);
  }
  // This used to render HTML only for requests whose Accept header contained
  // "text/html", or whose user-agent contained the lowercase string "bot".
  // facebookexternalhit, LinkedInBot and Slurp match neither, so every link
  // preview — and any client sending the default Accept: */* — got a zero-byte
  // 404. A non-asset path is a page; render it regardless of what was asked for.
  const templateResponse = await env.ASSETS.fetch(new Request(new URL("/index.html", url)));
  const template = await templateResponse.text();
  // A missing asset bundle would otherwise be served as a blank 200 page, which
  // looks fine to a crawler and to uptime checks. Fail loudly instead.
  if (!templateResponse.ok || !template.includes("<!--app-html-->")) {
    console.error("[Worker SSR] index.html is missing from the asset bundle");
    return new Response("The site is being deployed. Please try again shortly.", { status: 503, headers: { "content-type": "text/plain; charset=UTF-8", "retry-after": "60" } });
  }
  try {
    const { head, state } = await getHead(`${url.pathname}${url.search}`, env);
    const body = await renderPublicBody(url.pathname, env);
    const document = template.replace("</head>", `${renderHead(head, env.SITE_URL.replace(/\/$/, ""))}</head>`).replace("</body>", `<script>window.__RQ_STATE__=${JSON.stringify(state).replace(/</g, "\\u003c")}</script></body>`).replace("<!--app-html-->", body);
    return new Response(document, { status: head.notFound ? 404 : 200, headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-cache" } });
  } catch (error) {
    console.error("[Worker SSR]", error);
    const fallback = template.replace("</head>", `${renderHead({ title: "Quiet Hour — Find your place in the city", description: defaultDescription, canonicalPath: "/" }, env.SITE_URL.replace(/\/$/, ""))}</head>`);
    return new Response(fallback, { status: 200, headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-cache" } });
  }
}
