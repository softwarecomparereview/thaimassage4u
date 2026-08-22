import { escapeAttr, escapeHtml, jsonLd } from "./escape";
import type { Country } from "./db";
import { resolveTheme, type ResolvedTheme } from "./themes";
import { HERO_PHOTO } from "./photos";

export type PageMeta = {
  title: string;
  description: string;
  path: string;
  canonical?: string;
  locale?: string;
  image?: string;
  robots?: string;
  breadcrumbs?: Array<{ name: string; path: string }>;
  jsonLd?: unknown[];
  hreflang?: Array<{ lang: string; path: string }>;
};

const SITE = "Thai Massage For U";

export function absolute(siteUrl: string, path: string): string {
  return new URL(path, siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).toString();
}

export function layout(
  env: Env,
  meta: PageMeta,
  body: string,
  options?: { countries?: Country[]; geo?: string | null; theme?: ResolvedTheme }
) {
  const siteUrl = env.SITE_URL;
  const canonical = absolute(siteUrl, meta.canonical ?? meta.path);
  const image = absolute(siteUrl, meta.image ?? HERO_PHOTO);
  const locale = meta.locale ?? "en";
  const countries = options?.countries ?? [];
  const geo = options?.geo;
  const theme = options?.theme ?? resolveTheme();

  const crumbs = (meta.breadcrumbs ?? []).map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: absolute(siteUrl, crumb.path),
  }));

  const graph = [
    {
      "@type": "WebSite",
      name: SITE,
      url: siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      name: SITE,
      url: siteUrl,
      email: env.CONTACT_EMAIL,
      logo: absolute(siteUrl, "/images/hero.svg"),
    },
    ...(crumbs.length
      ? [{ "@type": "BreadcrumbList", itemListElement: crumbs }]
      : []),
    ...(meta.jsonLd ?? []),
  ];

  const navCountries = countries
    .map(
      (country) =>
        `<a href="/${escapeAttr(country.code)}" data-country="${escapeAttr(country.code)}">${escapeHtml(country.flag)} ${escapeHtml(country.name)}</a>`
    )
    .join("");

  const hreflang = (meta.hreflang ?? [])
    .map((item) => `<link rel="alternate" hreflang="${escapeAttr(item.lang)}" href="${escapeAttr(absolute(siteUrl, item.path))}">`)
    .join("\n");

  const crumbHtml = (meta.breadcrumbs ?? [])
    .map((crumb, index, all) => {
      const last = index === all.length - 1;
      return last
        ? `<span>${escapeHtml(crumb.name)}</span>`
        : `<a href="${escapeAttr(crumb.path)}">${escapeHtml(crumb.name)}</a> / `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="${escapeAttr(locale)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeAttr(meta.description)}">
<meta name="robots" content="${escapeAttr(meta.robots ?? "index,follow,max-image-preview:large")}">
<link rel="canonical" href="${escapeAttr(canonical)}">
${hreflang}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeAttr(SITE)}">
<meta property="og:title" content="${escapeAttr(meta.title)}">
<meta property="og:description" content="${escapeAttr(meta.description)}">
<meta property="og:url" content="${escapeAttr(canonical)}">
<meta property="og:image" content="${escapeAttr(image)}">
<meta property="og:locale" content="${escapeAttr(locale.replace("-", "_"))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(meta.title)}">
<meta name="twitter:description" content="${escapeAttr(meta.description)}">
<meta name="twitter:image" content="${escapeAttr(image)}">
<link rel="icon" href="/images/hero.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/themes.css">
<script type="application/ld+json">${jsonLd({ "@context": "https://schema.org", "@graph": graph })}</script>
</head>
<body class="${escapeAttr(theme.className)}">
<a class="skip-link" href="#content">Skip to content</a>
<div class="sale-ribbon">
  <a href="/for-sale">This directory is for sale · <span>Send an offer</span></a>
</div>
<div class="topbar">
  <div class="container">
    <div>USA · UK · Australia · Germany</div>
    <div>${
      theme.country
        ? `Browsing ${escapeHtml(theme.country.label)} · `
        : geo
          ? `Suggested for you: <a href="/${escapeAttr(geo)}">${escapeHtml(geo.toUpperCase())}</a> · `
          : ""
    }<a href="/?intl=1">All countries</a> · <a href="mailto:${escapeAttr(env.CONTACT_EMAIL)}">${escapeHtml(env.CONTACT_EMAIL)}</a></div>
  </div>
</div>
<header>
  <div class="container nav">
    <a class="brand" href="/" aria-label="${escapeAttr(SITE)} home">
      <span class="brand-mark">TM</span>
      <span>${escapeHtml(SITE)}</span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
    <nav id="primary-nav" class="nav-links" aria-label="Primary">
      <a href="/">Home</a>
      ${navCountries}
      <a href="/blog">Guides</a>
      <a href="/pricing">List a studio</a>
      <a href="/faq">FAQ</a>
      <a href="/for-sale" class="nav-sale">For sale</a>
    </nav>
  </div>
</header>
<main id="content">
  ${meta.breadcrumbs?.length ? `<div class="page-hero"><div class="container"><div class="breadcrumbs">${crumbHtml}</div></div></div>` : ""}
  ${body}
</main>
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-column">
        <h3>${escapeHtml(SITE)}</h3>
        <p>A quiet map of traditional Thai rooms — the kind you walk to after work in Melbourne, London, New York or Berlin. Stretch, breathe, and go home a little longer in the shoulders.</p>
        <p>We write about the cities as much as the studios: how they grew, why people book here, and what a first session actually feels like.</p>
      </div>
      <div class="footer-column">
        <h4>Countries</h4>
        ${countries.map((country) => `<a href="/${escapeAttr(country.code)}">${escapeHtml(country.flag)} Thai massage ${escapeHtml(country.name)}</a>`).join("")}
      </div>
      <div class="footer-column">
        <h4>Directory</h4>
        <a href="/search">Search listings</a>
        <a href="/pricing">Premium placement</a>
        <a href="/claim">Claim a listing</a>
        <a href="/blog">Guides</a>
        <a href="/contact">Contact</a>
      </div>
      <div class="footer-column">
        <h4>This domain</h4>
        <a href="/for-sale">For sale — send an offer</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/sitemap.xml">Sitemap</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 ${escapeHtml(SITE)}. For people looking for a real Thai room, not a brochure.</p>
    </div>
  </div>
</footer>
<div class="sticky-cta">
  <a href="/search">Find a studio</a>
  <a class="secondary" href="/for-sale">Domain for sale</a>
</div>
<script src="/app.js" defer></script>
</body>
</html>`;
}

export function notice(kind: "ok" | "err", text: string): string {
  return `<p class="form-notice ${kind}" role="status">${escapeHtml(text)}</p>`;
}

export function money(amount: number | null, currency: string | null): string {
  if (amount == null) return "Enquire";
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`;
  }
}
