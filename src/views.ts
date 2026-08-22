import { escapeAttr, escapeHtml } from "./lib/escape";
import { layout, money, notice, type PageMeta } from "./lib/html";
import type { City, Country, KeywordStat, Listing } from "./lib/db";
import type { SerpPlan } from "./lib/serp";
import { resolveTheme } from "./lib/themes";

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

function countryCard(country: Country, listingCount: number) {
  return `<article class="suburb-card country-card">
    <h3><a href="/${escapeAttr(country.code)}">${escapeHtml(country.flag)} Thai massage in ${escapeHtml(country.name)}</a></h3>
    <p>${escapeHtml(country.tagline)}</p>
    <p class="small"><strong>${escapeHtml(String(country.monthly_searches.toLocaleString("en")))}</strong> modelled monthly searches · ${escapeHtml(String(listingCount))} listings</p>
    <a class="btn btn-secondary" href="/${escapeAttr(country.code)}">Open ${escapeHtml(country.name)}</a>
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
        <span class="eyebrow">International Thai massage directory</span>
        <h1>Find authentic Thai massage in the USA, UK, Australia and Germany</h1>
        <p>thaimassageforu.com is no longer limited to Melbourne and Sydney. Country folders keep one domain authority while city pages target high-intent keywords such as “Best Thai massage in Manchester” and “Traditional Thai massage Los Angeles”.</p>
        <form class="hero-search" action="/search" method="get" role="search">
          <label class="sr-only" for="q">Search Thai massage studios</label>
          <input id="q" name="q" type="search" placeholder="Try “Thai massage Berlin” or a studio name" required>
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
        <div class="trust-badges">
          <div class="trust-badge"><strong>4</strong><span>Countries</span></div>
          <div class="trust-badge"><strong>${escapeHtml(String(cities.length))}</strong><span>City landers</span></div>
          <div class="trust-badge"><strong>${escapeHtml(String(total))}</strong><span>Directory listings</span></div>
        </div>
      </div>
      <div class="hero-card">
        <div class="hero-image hero-image-local">
          <div class="floating-badge">
            <strong>Domain for sale</strong>
            <div class="small">Any serious offer considered. Open the form and tell us what you have in mind.</div>
            <a class="btn btn-primary" href="/for-sale">Make an offer</a>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="section-header">
        <h2>Countries chosen for search demand</h2>
        <p>USA, UK and Australia were specified. Germany was added because Berlin Thai-massage keyword variants alone exceed 43,000 documented monthly searches — the strongest measured city cluster.</p>
      </div>
      <div class="suburb-grid">${shell.countries.map((country) => countryCard(country, counts[country.code] ?? 0)).join("")}</div>
    </div>
  </section>
  <section class="alt-bg">
    <div class="container">
      <div class="section-header">
        <h2>City pages built for “near me” SEO</h2>
        <p>Each city has a unique H1, intro, ItemList schema and internal links. That is how a .com directory ranks location keywords without splitting authority across ccTLDs.</p>
      </div>
      <div class="city-chip-row">
        ${cities
          .slice(0, 18)
          .map(
            (city) =>
              `<a class="city-chip" href="/${escapeAttr(city.country_code)}/${escapeAttr(city.slug)}">Thai massage ${escapeHtml(city.name)} <span>${escapeHtml(String(city.monthly_searches.toLocaleString("en")))}</span></a>`
          )
          .join("")}
      </div>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="section-header">
        <h2>Featured and sponsored studios</h2>
        <p>Premium placement is the B2B revenue layer: recurring featured rows, city sponsorships and local banners on these landers.</p>
      </div>
      <div class="cards">${featured.map(listingCard).join("")}</div>
    </div>
  </section>
  <section class="alt-bg">
    <div class="container">
      <div class="section-header">
        <h2>Keyword evidence in D1</h2>
        <p>Search volumes are stored beside listings so country and city copy can cite numbers instead of generic “expand internationally” claims.</p>
      </div>
      <div class="keyword-table-wrap">
        <table class="keyword-table">
          <thead><tr><th>Keyword</th><th>Monthly searches</th><th>Source</th></tr></thead>
          <tbody>
            ${keywords
              .map(
                (row) =>
                  `<tr><td>${escapeHtml(row.keyword)}</td><td>${escapeHtml(row.monthly_searches.toLocaleString("en"))}</td><td>${escapeHtml(row.source)}</td></tr>`
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
      image: "/images/hero-homepage.png",
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

function listingCard(listing: Listing): string {
  const href = `/${listing.country_code}/${listing.city_slug}/${listing.slug}`;
  const badge = listing.premium >= 2 ? "Sponsored" : listing.premium === 1 ? "Featured" : listing.source === "places" ? "Google Places" : listing.claimed ? "Claimed" : "Unclaimed";
  const rating =
    listing.rating != null
      ? `<p class="small">${escapeHtml(listing.rating.toFixed(1))}★${listing.review_count ? ` · ${escapeHtml(String(listing.review_count))} reviews` : ""}</p>`
      : "";
  return `<article class="card listing-card">
    <img src="${escapeAttr(listing.image_url ?? "/images/room.svg")}" alt="${escapeAttr(listing.name)}" width="640" height="360" loading="lazy">
    <p class="badge">${escapeHtml(badge)}</p>
    <h3><a href="${escapeAttr(href)}">${escapeHtml(listing.name)}</a></h3>
    <p>${escapeHtml(listing.suburb ?? listing.city_slug)} · ${escapeHtml(listing.services.replaceAll(",", " · "))}</p>
    ${rating}
    <div class="price"><span>${escapeHtml(listing.city_slug.replaceAll("-", " "))}</span><span>${escapeHtml(money(listing.price_from, listing.currency))}</span></div>
  </article>`;
}

export function renderCountry(shell: Shell, country: Country, cities: City[], keywords: KeywordStat[], listingCount: number) {
  const body = `
  <section class="page-hero">
    <div class="container page-title">
      <h1>Thai massage in ${escapeHtml(country.name)}</h1>
      <p class="lead">${escapeHtml(country.intro)}</p>
      <p class="small">${escapeHtml(country.search_note ?? "")} · ${escapeHtml(String(listingCount))} listings in D1.</p>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="suburb-grid">
        ${cities
          .map(
            (city) => `<article class="suburb-card">
              <h3><a href="/${escapeAttr(country.code)}/${escapeAttr(city.slug)}">Thai massage ${escapeHtml(city.name)}</a></h3>
              <p>${escapeHtml(city.intro)}</p>
              <p class="small">${escapeHtml(String(city.monthly_searches.toLocaleString("en")))} modelled monthly searches</p>
              <a class="btn btn-secondary" href="/${escapeAttr(country.code)}/${escapeAttr(city.slug)}">View ${escapeHtml(city.name)} studios</a>
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
      description: `Find Thai massage studios across ${country.name}. City pages target local keywords and unclaimed listings can be claimed by owners.`,
      path: `/${country.code}`,
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
    <h2>Keywords this country can rank</h2>
    <div class="keyword-table-wrap"><table class="keyword-table">
      <thead><tr><th>Keyword</th><th>Monthly searches</th><th>Source</th></tr></thead>
      <tbody>${keywords
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.keyword)}</td><td>${escapeHtml(row.monthly_searches.toLocaleString("en"))}</td><td>${escapeHtml(row.source)}</td></tr>`
        )
        .join("")}</tbody>
    </table></div>
  </div></section>`;
}

export function renderCity(shell: Shell, country: Country, city: City, listings: Listing[], serp: SerpPlan | null) {
  const h1 = serp?.h1 || `Thai massage in ${city.name}, ${country.name}`;
  const lead = serp?.description || city.intro;
  const related = (serp?.related ?? []).map((query) => `<a class="city-chip" href="/search?q=${escapeAttr(query)}">${escapeHtml(query)}</a>`).join("");
  const paa = (serp?.peopleAlsoAsk ?? [])
    .map((item) => `<div class="faq-item"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer || "See listings below for local studios.")}</p></div>`)
    .join("");
  const body = `
  <section class="page-hero">
    <div class="container page-title">
      <h1>${escapeHtml(h1)}</h1>
      <p class="lead">${escapeHtml(lead)}</p>
      <p class="small">${escapeHtml(String(listings.length))} listings · modelled demand ${escapeHtml(String(city.monthly_searches.toLocaleString("en")))} monthly searches${serp ? ` · SERP refreshed ${escapeHtml(serp.capturedAt.slice(0, 10))} for “${escapeHtml(serp.query)}”` : ""} · ${escapeHtml(city.region ?? "")}</p>
      <a class="btn btn-primary" href="/pricing">Sponsor ${escapeHtml(city.name)}</a>
    </div>
  </section>
  <section>
    <div class="container">
      <div class="cards">${listings.map(listingCard).join("") || "<p>No listings yet. Run Places enrichment to pull live studios.</p>"}</div>
    </div>
  </section>
  ${related ? `<section class="alt-bg"><div class="container"><h2>People also search today</h2><div class="city-chip-row">${related}</div></div></section>` : ""}
  ${paa ? `<section><div class="container"><h2>Questions from today's SERP</h2><div class="faq-list">${paa}</div></div></section>` : ""}`;

  return page(
    shell,
    {
      title: serp?.title || `${h1} | Best Studios & Spas`,
      description: serp?.description || `Compare Thai massage studios in ${city.name}. See featured listings, claim an unclaimed storefront, or advertise on this high-intent city page.`,
      path: `/${country.code}/${city.slug}`,
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
          itemListElement: listings.map((listing, index) => ({
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
        <img class="listing-hero" src="${escapeAttr(listing.image_url ?? "/images/room.svg")}" alt="${escapeAttr(listing.name)}" width="1200" height="640">
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
        ${listing.source === "openstreetmap" ? `<p class="small">Source: public OpenStreetMap search. Map data © OpenStreetMap contributors, ODbL.</p>` : ""}
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
          <p>City sponsorships sit above unclaimed rows on this lander.</p>
          <a class="btn btn-secondary" href="/pricing">See premium tiers</a>
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
          image: `${shell.env.SITE_URL}${listing.image_url ?? "/images/room.svg"}`,
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
        <p class="lead">Any serious offer will be considered. The international directory, D1 listings, city SEO architecture and this .com name can transfer together.</p>
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
        <img src="/images/sale-hero.svg" width="640" height="640" alt="Cute for-sale spa cottage with a hanging sign and a mailbox for offers">
        <figcaption>Any offer considered. No hard asking price on the page — use the form.</figcaption>
      </figure>
    </div>
  </section>`;

  return page(
    shell,
    {
      title: "This Thai Massage Directory Is For Sale | Thai Massage For U",
      description: "thaimassageforu.com is listed for sale. Send any serious offer through the form. The international city directory and D1 listings can be included.",
      path: "/for-sale",
      image: "/images/sale-hero.svg",
    },
    body
  );
}

export function renderClaim(shell: Shell, listing: Listing | null, sent?: string) {
  const body = `
  <section class="page-hero"><div class="container page-title">
    <h1>${listing ? `Claim ${escapeHtml(listing.name)}` : "Claim a Thai massage listing"}</h1>
    <p class="lead">Owners can request edits, premium placement and a booking button. Claims are stored in D1 and queued on Cloudflare.</p>
    ${sent === "1" ? notice("ok", "Claim received. We will verify ownership before publishing edits.") : ""}
  </div></section>
  <section><div class="container booking-panel">
    <form action="/api/claims" method="post">
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div>
        <label for="listing_slug">Listing slug</label>
        <input id="listing_slug" name="listing_slug" required value="${escapeAttr(listing?.slug ?? "")}" placeholder="golden-sala-berlin">
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
    ["Why add Germany as the fourth country?", "Berlin Thai-massage keyword variants are publicly documented at 16,400 + 14,300 + 7,400 + 5,000 monthly searches. That city cluster outpaces modelled volumes for other candidate fourth countries such as Canada or New Zealand."],
    ["Are unclaimed listings official business pages?", "No. Seeded and OpenStreetMap-derived rows are directory placeholders. Owners must claim a listing before booking buttons or verified phones go live."],
    ["How do you scrape new cities?", "Google Places (official API) supplies live studios, ratings and photos. Browser Run only opens the spa’s own website or allowlisted OSM/Wikipedia pages to make thumbnails. Google Search/Maps HTML is not scraped."],
    ["Do pages change with daily SERP data?", "Yes. A 06:20 UTC cron pulls SerpAPI snapshots into D1. City titles, H1s, People-also-ask blocks and related-search chips rewrite from the latest snapshot."],
    ["Can I buy the domain only?", "Yes. Use the for-sale form. Offers for the name, the listings database, or both are considered."],
  ];
  const body = `<section class="page-hero"><div class="container page-title"><h1>Directory FAQ</h1><p class="lead">SEO, listings and the sale process.</p></div></section>
  <section><div class="container faq-list">${faqs
    .map((faq) => `<div class="faq-item"><h2>${escapeHtml(faq[0])}</h2><p>${escapeHtml(faq[1])}</p></div>`)
    .join("")}</div></section>`;
  return page(
    shell,
    {
      title: "FAQ | Thai Massage For U International Directory",
      description: "How the international Thai massage directory, Germany keyword pick, Browser Run scraping and domain sale work.",
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
    <p class="lead">Unclaimed rows stay free. Revenue comes from featured placement, city takeovers and local banners on high-intent landers.</p></div></section>
  <section><div class="container cards">
    <article class="card"><h2>Basic</h2><p>Public name, suburb and services. Claim is free.</p><div class="price"><span>Monthly</span><span>$0</span></div></article>
    <article class="card"><h2>Featured</h2><p>Priority sort, badge and extra photos on the city page.</p><div class="price"><span>From</span><span>$49</span></div></article>
    <article class="card"><h2>City sponsor</h2><p>Top slot plus a banner on one city lander.</p><div class="price"><span>From</span><span>$199</span></div></article>
  </div></section>`;
  return page(shell, { title: "Pricing | List a Thai Massage Studio", description: "Premium Thai massage listing tiers for featured placement and city sponsorships.", path: "/pricing" }, body);
}

export function renderBlog(shell: Shell) {
  const body = `<section class="page-hero"><div class="container page-title"><h1>Thai massage guides for every city</h1>
    <p class="lead">Editorial pages support the directory with informational queries while city folders capture transactional ones.</p></div></section>
  <section><div class="container cards">
    <article class="card"><h2>What traditional Thai massage includes</h2><p>Assisted stretching, pressure-point work and clothed mat work — the queries people type before they add a city name.</p></article>
    <article class="card"><h2>How we pick city landers</h2><p>Search volume, studio density and English-language .com fit. Germany won the fourth-country slot on documented Berlin numbers.</p></article>
  </div></section>`;
  return page(shell, { title: "Thai Massage Guides | Thai Massage For U", description: "Guides that support the international Thai massage directory with informational search intent.", path: "/blog" }, body);
}

export function renderLegal(shell: Shell, kind: "privacy" | "terms") {
  const title = kind === "privacy" ? "Privacy policy" : "Terms of use";
  const body = `<section class="page-hero"><div class="container page-title"><h1>${title}</h1>
    <p class="lead">Offer, claim and contact forms store the fields you submit in Cloudflare D1. Analytics Engine records path-level events without selling personal profiles. Unclaimed listings may include public OpenStreetMap names with ODbL attribution. Do not submit secrets or payment cards in the offer form.</p>
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
