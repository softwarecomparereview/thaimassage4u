import { dehydrate, QueryClient } from "@tanstack/react-query";
import { TRPCError } from "@trpc/server";
import { prefetchForPath, type HeadMeta } from "../client/src/ssr/prefetch";
import { getArticle, getCityGuide, getDirectoryHome, getListing } from "./directory";
import type { Env } from "./index";

const siteName = "Quiet Hour";
const defaultDescription = "A considered guide to wellness places, rituals, and city intelligence.";
const clean = (value: string, length: number) => Array.from(value.replace(/\s+/g, " ").trim()).slice(0, length).join("");
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const markdown = (value: string) => escape(value).replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>").split(/\n{2,}/).map(block => block.startsWith("<h") ? block : `<p>${block.replace(/\n/g, "<br />")}</p>`).join("");

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
  });
  return { head, state: dehydrate(queryClient) };
}

async function renderPublicBody(path: string, env: Env) {
  const articleMatch = path.match(/^\/journal\/([^/]+)$/);
  if (articleMatch) {
    const article = await getArticle(env, articleMatch[1]);
    if (!article) return `<main class="worker-ssr"><h1>Page not found</h1><p>This article is not available.</p></main>`;
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/journal">Journal</a></nav><article><p class="eyebrow">${escape(String(article.topic ?? "Wellness"))}</p><h1>${escape(String(article.title))}</h1><p class="lede">${escape(String(article.excerpt ?? ""))}</p>${markdown(String(article.body ?? ""))}</article></main>`;
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
    return `<main class="worker-ssr"><nav><a href="/">Quiet Hour</a><a href="/directory">Explore</a></nav><article><h1>${escape(detail.listing.name)}</h1><p>${escape(String(detail.listing.description ?? detail.listing.descriptor ?? ""))}</p><p>${escape(String(detail.city.name))}</p><ul>${detail.services.map(item => `<li>${escape(item.title)}</li>`).join("")}</ul></article></main>`;
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
  const acceptsHtml = request.headers.get("accept")?.includes("text/html") || request.headers.get("user-agent")?.includes("bot");
  if (!acceptsHtml) return env.ASSETS.fetch(request);
  const templateResponse = await env.ASSETS.fetch(new Request(new URL("/index.html", url)));
  const template = await templateResponse.text();
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
