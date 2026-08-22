import { escapeAttr, escapeHtml } from "./lib/escape";
import { layout, money, notice, type PageMeta } from "./lib/html";
import type { City, Country, KeywordStat, Listing } from "./lib/db";
import type { SerpPlan } from "./lib/serp";
import { resolveTheme, themeBand } from "./lib/themes";
import { ARTICLES, type Article } from "./lib/articles";
import { cityOrigin, countryOrigin, type OriginStory } from "./lib/origins";
import { cityPhoto, countryPhoto, HERO_PHOTO, listingPhoto, placePhotoAlt } from "./lib/photos";

type Shell = {
  env: Env;
  countries: Country[];
  geo?: string | null;
};

function page(
  shell: Shell,
  meta: PageMeta,
  body: string,
  place?: { country?: string | null; city?: string | null }
) {
  const theme = resolveTheme(place?.country, place?.city);
  return layout(shell.env, meta, body, { countries: shell.countries, geo: shell.geo, theme });
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return (match ? match[0] : text).trim();
}

function originEssay(story: OriginStory | null): string {
  if (!story) return "";
  return `<section class="origin-section">
    <div class="container origin-copy">
      <span class="eyebrow">${escapeHtml(story.kicker)}</span>
      <h2>${escapeHtml(story.title)}</h2>
      <p class="lead">${escapeHtml(story.lede)}</p>
      ${story.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </div>
  </section>`;
}

function countryCard(country: Country, listingCount: number) {
  return `<article class="place-card">
    <a href="/${escapeAttr(country.code)}">
      <img src="${escapeAttr(countryPhoto(country.code))}" alt="${escapeAttr(placePhotoAlt(country.name))}" width="800" height="500" loading="lazy">
      <div class="place-card-body">
        <h3>${escapeHtml(country.flag)} Thai massage in ${escapeHtml(country.name)}</h3>
        <p>${escapeHtml(firstSentence(countryOrigin(country.code)?.lede ?? country.tagline))}</p>
        <p class="small">${escapeHtml(String(listingCount))} studios to browse</p>
      </div>
    </a>
  </article>`;
}

export function renderHome(
  shell: Shell,
  counts: Record<string, number>,
  featured: Listing[],
  keywords: KeywordStat[],
  cities: City[]
) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const body = `
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <span class="eyebrow">Find a room. Keep your clothes on. Walk home taller.</span>
        <h1>Find authentic Thai massage in the USA, UK, Australia and Germany</h1>
        <p>Traditional mat work in the cities people actually live in — Melbourne laneways, London high streets, New York lunch hours, Berlin neighbourhoods. Read a little about the place, then pick a studio.</p>
        <form class="hero-search" action="/search" method="get" role="search">
          <label class="sr-only" for="q">Search Thai massage studios</label>
          <input id="q" name="q" type="search" placeholder="Try “Thai massage Berlin” or a studio name" required>
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
        <div class="trust-badges">
          <div class="trust-badge"><strong>4</strong><span>Countries</span></div>
          <div class="trust-badge"><strong>${escapeHtml(String(cities.length))}</strong><span>Cities</span></div>
          <div class="trust-badge"><strong>${escapeHtml(String(total))}</strong><span>Studios</span></div>
        </div>
      </div>
      <figure class="hero-visual">
        <img src="${HERO_PHOTO}" alt="Hot stone spa treatment — traditional wellness photography" width="1400" height="933">
        <figcaption>Traditional pressure, assisted stretching, a quieter hour in the middle of a city.</figcaption>
      </figure>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="section-header">
        <h2>Four countries, one wandering map</h2>
        <p>Start in Australia, where this brand began. Cross to Britain’s high streets, America’s lunch-hour rooms, and Berlin’s kiez studios — each city with its own skyline and story.</p>
      </div>
      <div class="suburb-grid">${shell.countries.map((country) => countryCard(country, counts[country.code] ?? 0)).join("")}</div>
    </div>
  </section>
  <section class="alt-bg">
    <div class="container">
      <div class="section-header">
        <h2>Open a city the way you would walk it</h2>
        <p>Every city page has a photograph of the real place, a short origin story, and the rooms nearby. No two capitals share a skyline or a sentence.</p>
      </div>
      <div class="city-chip-row">
        ${cities
          .slice(0, 18)
          .map(
            (city) =>
              `<a class="city-chip" href="/${escapeAttr(city.country_code)}/${escapeAttr(city.slug)}">Thai massage ${escapeHtml(city.name)}</a>`
          )
          .join("")}
      </div>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="section-header">
        <h2>Guides on the benefits of Thai massage</h2>
        <p>What the stretching is for, how a first visit feels, and why a desk-bound week asks for a mat rather than another candlelit oil menu.</p>
      </div>
      <div class="cards article-cards">${ARTICLES.map(articleCard).join("")}</div>
    </div>
  </section>
  <section class="alt-bg">
    <div class="container">
      <div class="section-header">
        <h2>Rooms worth a detour</h2>
        <p>Featured studios sit up front. Everyone else is still worth a look — and owners can claim a page whenever they are ready.</p>
      </div>
      <div class="cards">${featured.map(listingCard).join("")}</div>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="section-header">
        <h2>What people type before they book</h2>
        <p>Almost always the same shape: Thai massage, then a city. Here is the short list.</p>
      </div>
      <div class="keyword-table-wrap">
        <table class="keyword-table">
          <thead><tr><th>People search for</th><th>Each month</th></tr></thead>
          <tbody>
            ${keywords
              .map(
                (row) =>
                  `<tr><td>${escapeHtml(row.keyword)}</td><td>${escapeHtml(row.monthly_searches.toLocaleString("en"))}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;

  return page(
    shell,
    {
      title: "Thai Massage Directory: USA, UK, Australia & Germany | Thai Massage For U",
      description:
        "International Thai massage directory with city pages for New York, Los Angeles, London, Manchester, Melbourne, Sydney and Berlin. Claim a listing or make an offer on the .com.",
      path: "/",
      image: HERO_PHOTO,
      jsonLd: [
        {
          "@type": "ItemList",
          name: "Thai massage countries",
          itemListElement: shell.countries.map((country, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `Thai massage ${country.name}`,
            url: `${shell.env.SITE_URL}/${country.code}`,
          })),
        },
      ],
    },
    body,
    { country: shell.geo }
  );
}

function articleCard(article: Article): string {
  return `<article class="card listing-card article-card">
    <div class="listing-card-media">
      <img src="${escapeAttr(article.image)}" alt="${escapeAttr(article.imageAlt)}" width="640" height="360" loading="lazy">
    </div>
    <div class="listing-card-body">
      <p class="badge">${escapeHtml(article.kicker)}</p>
      <h3><a href="/blog/${escapeAttr(article.slug)}">${escapeHtml(article.title)}</a></h3>
      <p>${escapeHtml(article.description)}</p>
      <p class="small">${escapeHtml(String(article.readMinutes))} min read</p>
    </div>
  </article>`;
}

function listingCard(listing: Listing): string {
  const href = `/${listing.country_code}/${listing.city_slug}/${listing.slug}`;
  const badge = listing.premium >= 2 ? "Sponsored" : listing.premium === 1 ? "Featured" : listing.claimed ? "Claimed" : "Listed";
  const rating =
    listing.rating != null
      ? `<p class="small">${escapeHtml(listing.rating.toFixed(1))}★${listing.review_count ? ` · ${escapeHtml(String(listing.review_count))} reviews` : ""}</p>`
      : "";
  return `<article class="card listing-card">
    <div class="listing-card-media">
      <img src="${escapeAttr(listingPhoto(listing))}" alt="${escapeAttr(listing.name)}" width="640" height="360" loading="lazy">
    </div>
    <div class="listing-card-body">
      <p class="badge">${escapeHtml(badge)}</p>
      <h3><a href="${escapeAttr(href)}">${escapeHtml(listing.name)}</a></h3>
      <p>${escapeHtml(listing.suburb ?? listing.city_slug)} · ${escapeHtml(listing.services.replaceAll(",", " · "))}</p>
      ${rating}
      <div class="price"><span>${escapeHtml(listing.city_slug.replaceAll("-", " "))}</span><span>${escapeHtml(money(listing.price_from, listing.currency))}</span></div>
    </div>
  </article>`;
}

export function renderCountry(
  shell: Shell,
  country: Country,
  cities: City[],
  keywords: KeywordStat[],
  listingCount: number,
  featured: Listing[] = []
) {
  const origin = countryOrigin(country.code);
  const heroes = featured.slice(0, 2);
  const body = `
  ${themeBand(resolveTheme(country.code))}
  <section class="page-hero">
    <div class="container page-title">
      <h1>Thai massage in ${escapeHtml(country.name)}</h1>
      <p class="lead">${escapeHtml(origin?.lede ?? country.intro)}</p>
      <p class="small">${escapeHtml(String(listingCount))} studios across ${escapeHtml(country.name)}.</p>
    </div>
  </section>
  ${
    heroes.length
      ? `<section class="featured-heroes">
    <div class="container">
      <div class="section-header">
        <h2>Featured in ${escapeHtml(country.name)}</h2>
        <p>Two rooms at most sit up here — the ones we would send a friend to first.</p>
      </div>
      <div class="featured-hero-grid">${heroes.map(featuredHero).join("")}</div>
    </div>
  </section>`
      : ""
  }
  ${originEssay(origin)}
  <section>
    <div class="container">
      <div class="section-header">
        <h2>Cities and their stories</h2>
        <p>Each capital keeps its own skyline, founding story and studio list. Open a city when you are ready to walk it.</p>
      </div>
      <div class="suburb-grid">
        ${cities
          .map(
            (city) => `<article class="place-card">
              <a href="/${escapeAttr(country.code)}/${escapeAttr(city.slug)}">
                <img src="${escapeAttr(cityPhoto(country.code, city.slug))}" alt="${escapeAttr(placePhotoAlt(city.name))}" width="800" height="500" loading="lazy">
                <div class="place-card-body">
                  <h3>Thai massage ${escapeHtml(city.name)}</h3>
                  <p>${escapeHtml(cityOrigin(country.code, city.slug)?.lede ?? city.intro)}</p>
                  <p class="small">Studios in ${escapeHtml(city.name)}</p>
                </div>
              </a>
            </article>`
          )
          .join("")}
      </div>
    </div>
  </section>
  ${keywordBlock(keywords)}`;

  return page(
    shell,
    {
      title: `Thai Massage ${country.name} — City Directory | Thai Massage For U`,
      description: `Find Thai massage studios across ${country.name}. City stories, photography, and rooms you can actually walk to.`,
      path: `/${country.code}`,
      image: countryPhoto(country.code),
      locale: country.locale,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: country.name, path: `/${country.code}` },
      ],
      jsonLd: [
        {
          "@type": "ItemList",
          name: `Thai massage cities in ${country.name}`,
          itemListElement: cities.map((city, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `Thai massage ${city.name}`,
            url: `${shell.env.SITE_URL}/${country.code}/${city.slug}`,
          })),
        },
      ],
    },
    body,
    { country: country.code }
  );
}

function keywordBlock(keywords: KeywordStat[]): string {
  if (!keywords.length) return "";
  return `<section class="alt-bg"><div class="container">
    <h2>What people look for here</h2>
    <div class="keyword-table-wrap"><table class="keyword-table">
      <thead><tr><th>People search for</th><th>Each month</th></tr></thead>
      <tbody>${keywords
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.keyword)}</td><td>${escapeHtml(row.monthly_searches.toLocaleString("en"))}</td></tr>`
        )
        .join("")}</tbody>
    </table></div>
  </div></section>`;
}

function featuredHero(listing: Listing): string {
  const href = `/${listing.country_code}/${listing.city_slug}/${listing.slug}`;
  return `<article class="featured-hero">
    <a href="${escapeAttr(href)}">
      <img src="${escapeAttr(listingPhoto(listing))}" alt="${escapeAttr(listing.name)}" width="1200" height="720">
      <div class="featured-hero-copy">
        <p class="badge">Featured</p>
        <h3>${escapeHtml(listing.name)}</h3>
        <p>${escapeHtml(listing.suburb ?? listing.city_slug.replaceAll("-", " "))} · ${escapeHtml(listing.services.replaceAll(",", " · "))}</p>
        <span class="featured-hero-go">Open this room</span>
      </div>
    </a>
  </article>`;
}

export function renderCity(shell: Shell, country: Country, city: City, listings: Listing[], serp: SerpPlan | null) {
  const origin = cityOrigin(country.code, city.slug);
  const h1 = serp?.h1 || `Thai massage in ${city.name}, ${country.name}`;
  const lead = origin?.lede || serp?.description || city.intro;
  const related = (serp?.related ?? []).map((query) => `<a class="city-chip" href="/search?q=${escapeAttr(query)}">${escapeHtml(query)}</a>`).join("");
  const paa = (serp?.peopleAlsoAsk ?? [])
    .map((item) => `<div class="faq-item"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer || "See the studios below for rooms nearby.")}</p></div>`)
    .join("");
  const shown = listings.slice(0, 20);
  const body = `
  ${themeBand(resolveTheme(country.code, city.slug))}
  <section class="page-hero">
    <div class="container page-title">
      <h1>${escapeHtml(h1)}</h1>
      <p class="lead">${escapeHtml(lead)}</p>
      <p class="small">Top ${escapeHtml(String(shown.length))} rooms in ${escapeHtml(city.name)}${city.region ? ` · ${escapeHtml(city.region)}` : ""}</p>
      <a class="btn btn-primary" href="/pricing">Feature a studio in ${escapeHtml(city.name)}</a>
    </div>
  </section>
  ${originEssay(origin)}
  <section>
    <div class="container">
      <div class="section-header">
        <h2>Top studios in ${escapeHtml(city.name)}</h2>
        <p>Twenty rooms at most, ranked with featured studios first. If a room looks familiar, it is yours to claim.</p>
      </div>
      <div class="cards">${shown.map(listingCard).join("") || "<p>No studios listed here yet. Check another city, or come back soon.</p>"}</div>
    </div>
  </section>
  <section class="alt-bg">
    <div class="container">
      <div class="section-header">
        <h2>Why people book Thai massage</h2>
        <p>Stretching, sleep, desk-bound weeks, and the first visit — written in ordinary language.</p>
      </div>
      <div class="cards article-cards">${ARTICLES.slice(0, 3).map(articleCard).join("")}</div>
    </div>
  </section>
  ${related ? `<section><div class="container"><h2>Also on people’s minds</h2><div class="city-chip-row">${related}</div></div></section>` : ""}
  ${paa ? `<section class="alt-bg"><div class="container"><h2>Questions people ask</h2><div class="faq-list">${paa}</div></div></section>` : ""}`;

  return page(
    shell,
    {
      title: serp?.title || `${h1} | Best Studios & Spas`,
      description: serp?.description || `Compare Thai massage studios in ${city.name}. See featured listings, claim an unclaimed storefront, or advertise on this high-intent city page.`,
      path: `/${country.code}/${city.slug}`,
      image: cityPhoto(country.code, city.slug),
      locale: country.locale,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: country.name, path: `/${country.code}` },
        { name: city.name, path: `/${country.code}/${city.slug}` },
      ],
      jsonLd: [
        {
          "@type": "ItemList",
          name: `Thai massage ${city.name}`,
          itemListElement: listings.slice(0, 20).map((listing, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: listing.name,
            url: `${shell.env.SITE_URL}/${country.code}/${city.slug}/${listing.slug}`,
          })),
        },
      ],
    },
    body,
    { country: country.code, city: city.slug }
  );
}

export function renderListing(shell: Shell, country: Country, city: City, listing: Listing) {
  const path = `/${country.code}/${city.slug}/${listing.slug}`;
  const body = `
  <section>
    <div class="container content-wrapper">
      <article class="main-content">
        <p class="eyebrow">${escapeHtml(listing.premium ? "Premium listing" : "Directory listing")}</p>
        <h1>${escapeHtml(listing.name)} — Thai massage in ${escapeHtml(city.name)}</h1>
        <img class="listing-hero" src="${escapeAttr(listingPhoto(listing))}" alt="${escapeAttr(listing.name)}" width="1200" height="640">
        <p>${escapeHtml(listing.description)}</p>
        ${listing.rating != null ? `<p><strong>${escapeHtml(listing.rating.toFixed(1))}★</strong>${listing.review_count ? ` from ${escapeHtml(String(listing.review_count))} Google reviews` : ""}</p>` : ""}
        <ul class="checklist">
          ${listing.services.split(",").map((service) => `<li>${escapeHtml(service.trim())}</li>`).join("")}
          <li>${escapeHtml(listing.address ?? `${city.name}, ${country.name}`)}</li>
          <li>${escapeHtml(listing.hours ?? "Hours listed after the owner claims")}</li>
        </ul>
        <div class="hero-actions">
          ${listing.phone ? `<a class="btn btn-primary" href="tel:${escapeAttr(listing.phone)}">Call ${escapeHtml(listing.phone)}</a>` : ""}
          ${listing.maps_url ? `<a class="btn btn-outline" href="${escapeAttr(listing.maps_url)}" rel="nofollow noopener" target="_blank">Open in Google Maps</a>` : ""}
          ${listing.claimed ? "" : `<a class="btn btn-secondary" href="/claim/${escapeAttr(listing.slug)}">Claim this listing</a>`}
          <a class="btn btn-outline" href="/${escapeAttr(country.code)}/${escapeAttr(city.slug)}">More in ${escapeHtml(city.name)}</a>
        </div>
        ${listing.source === "openstreetmap" ? `<p class="small">Found on the public map. The studio can claim this page to confirm hours and phone.</p>` : ""}
      </article>
      <aside class="sidebar">
        <div class="sidebar-widget">
          <h3>Visit / enquire</h3>
          <p>${escapeHtml(listing.suburb ?? city.name)}</p>
          <p>${escapeHtml(listing.address ?? "Address available after claim")}</p>
          <p>From ${escapeHtml(money(listing.price_from, listing.currency))}</p>
          ${listing.email ? `<a class="btn btn-primary" href="mailto:${escapeAttr(listing.email)}">Email studio</a>` : `<a class="btn btn-primary" href="/claim/${escapeAttr(listing.slug)}">Claim to add booking</a>`}
        </div>
        <div class="sidebar-widget">
          <h3>Advertise here</h3>
          <p>A featured slot on this city’s page sits above the rest of the rooms.</p>
          <a class="btn btn-secondary" href="/pricing">See premium tiers</a>
        </div>
        <div class="sidebar-widget">
          <h3>Origin of ${escapeHtml(city.name)}</h3>
          <p>${escapeHtml(cityOrigin(country.code, city.slug)?.lede ?? city.intro)}</p>
          <a class="btn btn-outline" href="/${escapeAttr(country.code)}/${escapeAttr(city.slug)}">Read the city essay</a>
        </div>
      </aside>
    </div>
  </section>`;

  return page(
    shell,
    {
      title: `${listing.name} | Thai Massage ${city.name}`,
      description: `${listing.name} offers ${listing.services.replaceAll(",", ", ").toLowerCase()} in ${city.name}, ${country.name}. ${listing.claimed ? "Claimed listing." : "Unclaimed — owners can update details."}`,
      path,
      locale: country.locale,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: country.name, path: `/${country.code}` },
        { name: city.name, path: `/${country.code}/${city.slug}` },
        { name: listing.name, path: path },
      ],
      jsonLd: [
        {
          "@type": "HealthAndBeautyBusiness",
          name: listing.name,
          url: `${shell.env.SITE_URL}${path}`,
          image: `${shell.env.SITE_URL}${listingPhoto(listing)}`,
          telephone: listing.phone ?? undefined,
          email: listing.email ?? undefined,
          address: {
            "@type": "PostalAddress",
            streetAddress: listing.address ?? undefined,
            addressLocality: city.name,
            addressRegion: city.region ?? undefined,
            addressCountry: country.code.toUpperCase(),
          },
          priceRange: listing.price_from ? money(listing.price_from, listing.currency) : "$$",
        },
      ],
    },
    body,
    { country: country.code, city: city.slug }
  );
}

export function renderSale(shell: Shell, sent?: string) {
  const body = `
  <section class="sale-hero-section">
    <div class="container sale-hero-grid">
      <div>
        <span class="eyebrow">Domain + directory for sale</span>
        <h1>thaimassageforu.com is open to offers</h1>
        <p class="lead">Any serious offer will be considered. The name, the city pages, and the studio directory can transfer together.</p>
        ${sent === "1" ? notice("ok", "Offer received. We will read every message.") : ""}
        ${sent === "0" ? notice("err", "Please complete the required fields with a real email.") : ""}
        <form class="sale-form" action="/api/offers" method="post">
          <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div>
            <label for="name">Your name</label>
            <input id="name" name="name" required maxlength="80" placeholder="Alex Rivera">
          </div>
          <div>
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required maxlength="120" placeholder="you@studio.com">
          </div>
          <div class="form-row">
            <div>
              <label for="company">Company (optional)</label>
              <input id="company" name="company" maxlength="120">
            </div>
            <div>
              <label for="offer_amount">Offer amount</label>
              <input id="offer_amount" name="offer_amount" maxlength="40" placeholder="25000">
            </div>
          </div>
          <div>
            <label for="currency">Currency</label>
            <select id="currency" name="currency">
              <option>USD</option><option>GBP</option><option selected>AUD</option><option>EUR</option>
            </select>
          </div>
          <div>
            <label for="message">What would you use the site for?</label>
            <textarea id="message" name="message" required maxlength="2000" placeholder="Tell us your plan, timeline and whether you want the listings database too."></textarea>
          </div>
          <label class="check"><input type="checkbox" name="consent" value="yes" required> I understand this is an offer enquiry, not a binding sale.</label>
          <button class="btn btn-primary" type="submit">Send my offer</button>
        </form>
      </div>
      <figure class="sale-art">
        <img src="${HERO_PHOTO}" width="640" height="427" alt="Hot stone spa photography for the directory that is for sale">
        <figcaption>Any offer considered. No hard asking price on the page — use the form.</figcaption>
      </figure>
    </div>
  </section>`;

  return page(
    shell,
    {
      title: "This Thai Massage Directory Is For Sale | Thai Massage For U",
      description: "thaimassageforu.com is listed for sale. Send any serious offer through the form. The city directory can be included.",
      path: "/for-sale",
      image: HERO_PHOTO,
    },
    body
  );
}

export function renderClaim(shell: Shell, listing: Listing | null, sent?: string) {
  const body = `
  <section class="page-hero"><div class="container page-title">
    <h1>${listing ? `Claim ${escapeHtml(listing.name)}` : "Claim a Thai massage listing"}</h1>
    <p class="lead">If this is your room, tell us. We will check it is really yours before anything on the page changes.</p>
    ${sent === "1" ? notice("ok", "Claim received. We will verify ownership before publishing edits.") : ""}
  </div></section>
  <section><div class="container booking-panel">
    <form action="/api/claims" method="post">
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div>
        <label for="listing_slug">Studio page</label>
        <input id="listing_slug" name="listing_slug" required value="${escapeAttr(listing?.slug ?? "")}" placeholder="studio-name-melbourne">
      </div>
      <div>
        <label for="name">Your name</label>
        <input id="name" name="name" required maxlength="80">
      </div>
      <div>
        <label for="email">Work email</label>
        <input id="email" name="email" type="email" required maxlength="120">
      </div>
      <div>
        <label for="phone">Phone</label>
        <input id="phone" name="phone" maxlength="40">
      </div>
      <div>
        <label for="role">Your role</label>
        <select id="role" name="role"><option>Owner</option><option>Manager</option><option>Marketing</option></select>
      </div>
      <div>
        <label for="message">How can we verify this is your studio?</label>
        <textarea id="message" name="message" required maxlength="2000"></textarea>
      </div>
      <button class="btn btn-primary" type="submit">Submit claim</button>
    </form>
  </div></section>`;

  return page(
    shell,
    {
      title: listing ? `Claim ${listing.name} | Thai Massage For U` : "Claim a Listing | Thai Massage For U",
      description: "Claim an unclaimed Thai massage listing to edit details, add booking and buy premium placement.",
      path: listing ? `/claim/${listing.slug}` : "/claim",
      robots: "noindex,follow",
    },
    body
  );
}

export function renderSearch(shell: Shell, query: string, listings: Listing[]) {
  const body = `
  <section class="page-hero"><div class="container page-title">
    <h1>Search results${query ? ` for “${escapeHtml(query)}”` : ""}</h1>
    <form class="hero-search" action="/search" method="get"><input name="q" value="${escapeAttr(query)}" type="search"><button class="btn btn-primary" type="submit">Search</button></form>
  </div></section>
  <section><div class="container"><div class="cards">${listings.map(listingCard).join("") || "<p>No studios matched. Try a city name.</p>"}</div></div></section>`;
  return page(
    shell,
    {
      title: query ? `Thai massage “${query}” | Search` : "Search Thai massage studios",
      description: "Search Thai massage listings across the USA, UK, Australia and Germany.",
      path: "/search",
      robots: query ? "noindex,follow" : "index,follow",
    },
    body
  );
}

export function renderFaq(shell: Shell) {
  const faqs = [
    ["Is this a booking site?", "It is a map of rooms. You read a city, pick a studio, and call or email them. Owners can claim a page to keep the details honest."],
    ["Why these four countries?", "This brand started in Melbourne. Britain and the United States have the same habit of searching a city name after “Thai massage”. Germany is here because Berlin books the craft the way a neighbourhood books a bakery — often, and in more than one language."],
    ["Are all of these official studio pages?", "Not until an owner claims them. Unclaimed rooms are a starting sketch: name, neighbourhood, the kind of work they do. Claimed pages can add a phone, hours and a booking note."],
    ["How do new studios get onto a city page?", "We look up public studio listings and the open map, then owners fill in the rest. We do not harvest White Pages or Yellow Pages."],
    ["Can I buy the domain?", "Yes. Use the for-sale form. Offers for the name, the directory, or both are read."],
  ];
  const body = `<section class="page-hero"><div class="container page-title"><h1>Questions we hear a lot</h1><p class="lead">Booking, claiming a room, and the four countries on this map.</p></div></section>
  <section><div class="container faq-list">${faqs
    .map((faq) => `<div class="faq-item"><h2>${escapeHtml(faq[0])}</h2><p>${escapeHtml(faq[1])}</p></div>`)
    .join("")}</div></section>`;
  return page(
    shell,
    {
      title: "FAQ | Thai Massage For U",
      description: "How the Thai massage directory works, how studios get listed, and how to claim a page.",
      path: "/faq",
      jsonLd: [
        {
          "@type": "FAQPage",
          mainEntity: faqs.map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        },
      ],
    },
    body
  );
}

export function renderContact(shell: Shell, sent?: string) {
  const body = `<section class="page-hero"><div class="container page-title"><h1>Contact the directory</h1>
    <p class="lead">Press, city sponsorships and listing questions. Domain offers belong on the for-sale form.</p>
    ${sent === "1" ? notice("ok", "Message received.") : ""}
  </div></section>
  <section><div class="container booking-panel">
    <form action="/api/contact" method="post">
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div><label for="name">Name</label><input id="name" name="name" required></div>
      <div><label for="email">Email</label><input id="email" name="email" type="email" required></div>
      <div><label for="topic">Topic</label><select id="topic" name="topic"><option>Listing help</option><option>Advertising</option><option>Press</option></select></div>
      <div><label for="message">Message</label><textarea id="message" name="message" required></textarea></div>
      <button class="btn btn-primary" type="submit">Send</button>
    </form>
  </div></section>`;
  return page(shell, { title: "Contact | Thai Massage For U", description: "Contact the international Thai massage directory team.", path: "/contact" }, body);
}

export function renderPricing(shell: Shell) {
  const body = `<section class="page-hero"><div class="container page-title"><h1>Premium listings and city sponsorships</h1>
    <p class="lead">A basic page is free. Featured rooms sit at the top of a country — two at a time — and at the front of a city.</p></div></section>
  <section><div class="container cards">
    <article class="card"><h2>Basic</h2><p>Public name, suburb and services. Claim is free.</p><div class="price"><span>Monthly</span><span>$0</span></div></article>
    <article class="card"><h2>Featured</h2><p>Priority sort, badge and extra photos on the city page.</p><div class="price"><span>From</span><span>$49</span></div></article>
    <article class="card"><h2>City sponsor</h2><p>One of the two hero rooms on a country page, plus the top of that city’s list.</p><div class="price"><span>From</span><span>$199</span></div></article>
  </div></section>`;
  return page(shell, { title: "Pricing | List a Thai Massage Studio", description: "Premium Thai massage listing tiers for featured placement and city sponsorships.", path: "/pricing" }, body);
}

export function renderBlog(shell: Shell) {
  const body = `<section class="page-hero"><div class="container page-title"><h1>Thai massage guides for every city</h1>
    <p class="lead">Original essays on benefits, sleep, desk work, first visits and how the craft travelled from Wat Pho to the capitals on this map. City folders capture the booking queries; these pages capture the questions people ask first.</p></div></section>
  <section><div class="container"><div class="cards article-cards">${ARTICLES.map(articleCard).join("")}</div></div></section>`;
  return page(shell, { title: "Thai Massage Guides | Thai Massage For U", description: "Original guides on the benefits of traditional Thai massage, sleep, desk work, first visits and the craft’s path from Wat Pho to Berlin and Melbourne.", path: "/blog", image: ARTICLES[0].image }, body);
}

export function renderArticle(shell: Shell, article: Article) {
  const others = ARTICLES.filter((item) => item.slug !== article.slug).slice(0, 3);
  const body = `
  <section class="article-hero">
    <div class="container">
      <p class="eyebrow">${escapeHtml(article.kicker)} · ${escapeHtml(String(article.readMinutes))} min read</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="lead">${escapeHtml(article.description)}</p>
    </div>
    <figure class="article-hero-photo">
      <img src="${escapeAttr(article.image)}" alt="${escapeAttr(article.imageAlt)}" width="1400" height="800">
    </figure>
  </section>
  <article class="article-body">
    <div class="container content-container">
      ${article.sections
        .map(
          (section) =>
            `${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ""}${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}`
        )
        .join("")}
      <p class="small">Find a city, then a room. These guides are for curious readers, not medical advice.</p>
    </div>
  </article>
  <section class="alt-bg"><div class="container">
    <div class="section-header"><h2>Keep reading</h2></div>
    <div class="cards article-cards">${others.map(articleCard).join("")}</div>
  </div></section>`;
  return page(
    shell,
    {
      title: `${article.title} | Thai Massage For U`,
      description: article.description,
      path: `/blog/${article.slug}`,
      image: article.image,
      jsonLd: [
        {
          "@type": "Article",
          headline: article.title,
          datePublished: article.date,
          image: `${shell.env.SITE_URL}${article.image}`,
          author: { "@type": "Organization", name: "Thai Massage For U" },
        },
      ],
    },
    body
  );
}

export function renderLegal(shell: Shell, kind: "privacy" | "terms") {
  const title = kind === "privacy" ? "Privacy policy" : "Terms of use";
  const body = `<section class="page-hero"><div class="container page-title"><h1>${title}</h1>
    <p class="lead">When you send an offer, a claim, or a message, we keep the name, email and words you typed so we can reply. We do not sell that. Please do not send card numbers or passwords through these forms.</p>
  </div></section>`;
  return page(shell, { title: `${title} | Thai Massage For U`, description: `${title} for the Thai Massage For U directory.`, path: `/${kind}` }, body);
}

export function renderNotFound(shell: Shell) {
  return page(
    shell,
    { title: "Page not found | Thai Massage For U", description: "That directory URL does not exist.", path: "/404", robots: "noindex" },
    `<section class="page-hero"><div class="container page-title"><h1>This page is not in the directory</h1><p><a class="btn btn-primary" href="/">Back home</a></p></div></section>`
  );
}
