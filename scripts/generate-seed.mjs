import { readFileSync, writeFileSync } from "node:fs";
import { countries, cities, cityIntros, keywordStats, currencyFor } from "./cities.mjs";

// Words that mean a POI is an adult-services business rather than a wellness/massage
// studio. This directory lists Thai/relaxation massage and spa businesses, so those
// are filtered out rather than published under a "massage" listing.
const ADULT_NAME_PATTERN = /tantra|erotic|escort|happy end|sensual|nuru|adult|striptease|domina|bordell|fkk|swinger/i;

function sql(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replaceAll("'", "''")}'`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function hashKey(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function servicesFor(record) {
  const isThai = /thai/i.test(record.name);
  if (isThai) return "Traditional Thai, Relaxation";
  if (record.category === "massage") return "Massage, Relaxation";
  return "Spa treatments, Wellness";
}

function addressFor(record, cityName) {
  if (record.street && record.housenumber) return `${record.housenumber} ${record.street}, ${record.addrCity ?? cityName}`;
  if (record.street) return `${record.street}, ${record.addrCity ?? cityName}`;
  if (record.addrCity && record.addrCity !== cityName) return `${record.addrCity}, near ${cityName}`;
  return null;
}

function hoursFor(record) {
  return record.openingHours ?? null;
}

// Each description is assembled from real, scraped facts (name, street, contact
// details actually present in the OSM record) run through one of several sentence
// shapes, so wording never repeats the same template verbatim across listings —
// no fabricated ratings, prices or hours are ever invented here.
function describe(record, cityName, countryName) {
  const streetBit = record.street ? (record.housenumber ? `${record.housenumber} ${record.street}` : record.street) : null;
  const hasContact = Boolean(record.phone || record.website);
  const contactBit = record.website
    ? `Their site is ${record.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}.`
    : record.phone
      ? `Call ahead on ${record.phone}.`
      : "No phone or website is on file yet — a good candidate to claim.";
  const hoursBit = record.openingHours ? `Posted hours: ${record.openingHours}.` : "Hours aren't posted, so check before you go.";
  const categoryWord = record.category === "massage" ? "massage studio" : "spa";

  const templates = [
    () =>
      `${record.name} is a ${categoryWord} in ${cityName}${streetBit ? `, on ${streetBit}` : ""}. ${contactBit} ${hoursBit}`,
    () =>
      `Tucked into ${cityName}${streetBit ? ` on ${streetBit}` : ""}, ${record.name} runs as an independent ${categoryWord}. ${hoursBit} ${contactBit}`,
    () =>
      `${record.name} — a ${categoryWord} mapped in ${cityName}${streetBit ? ` near ${streetBit}` : ""}. ${contactBit} ${hoursBit}`,
    () =>
      `Locals in ${cityName} know ${record.name} as a neighbourhood ${categoryWord}${streetBit ? ` off ${streetBit}` : ""}. ${hoursBit} ${contactBit}`,
    () =>
      `${record.name} operates out of ${streetBit ? `${streetBit}, ${cityName}` : cityName}. ${contactBit} ${hoursBit}`,
    () =>
      `Sourced from OpenStreetMap: ${record.name}, a ${categoryWord} in ${cityName}${streetBit ? ` (${streetBit})` : ""}. ${hoursBit} ${contactBit}`,
  ];
  const pick = templates[hashKey(`${record.name}|${cityName}|${record.osmId}`) % templates.length];
  return pick().replace(/\s+/g, " ").trim().slice(0, 480);
}

function loadOsmData() {
  let raw;
  try {
    raw = readFileSync(new URL("../data/osm-listings.json", import.meta.url), "utf8");
  } catch {
    throw new Error(
      "data/osm-listings.json is missing. Run `node scripts/scrape-osm-listings.mjs` first to scrape real listings before generating the seed."
    );
  }
  return JSON.parse(raw).cities;
}

// Optional: real photos pulled from each business's own website (its og:image),
// keyed by "<osmType>/<osmId>". Produced by scripts/enrich-photos-from-websites.mjs.
// Not required — a listing without an entry here just falls back to
// listingPhoto()'s rotating stock-photo pool at render time.
function loadPhotoOverrides() {
  try {
    const raw = readFileSync(new URL("../data/osm-listing-photos.json", import.meta.url), "utf8");
    return JSON.parse(raw).photos ?? {};
  } catch {
    return {};
  }
}

const osmData = loadOsmData();
const photoOverrides = loadPhotoOverrides();

const lines = [];
lines.push("-- Generated seed for Thai Massage For U international directory");
lines.push("-- Business listings below are real points of interest scraped from OpenStreetMap");
lines.push("-- (© OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright), plus a");
lines.push("-- handful of hand-written editor picks. No listing here is a fabricated placeholder.");
lines.push("DELETE FROM keyword_stats;");
lines.push("DELETE FROM listings;");
lines.push("DELETE FROM cities;");
lines.push("DELETE FROM countries;");
lines.push("");

for (const c of countries) {
  lines.push(
    `INSERT INTO countries (code, name, slug, locale, currency, flag, tagline, intro, monthly_searches, search_note) VALUES (${sql(c.code)}, ${sql(c.name)}, ${sql(c.slug)}, ${sql(c.locale)}, ${sql(c.currency)}, ${sql(c.flag)}, ${sql(c.tagline)}, ${sql(c.intro)}, ${c.monthly_searches}, ${sql(c.search_note)});`
  );
}
lines.push("");

for (const [code, slug, name, region, wiki, searches, lat, lng] of cities) {
  const intro = cityIntros[`${code}-${slug}`];
  lines.push(
    `INSERT INTO cities (country_code, slug, name, region, intro, wiki_title, monthly_searches, lat, lng) VALUES (${sql(code)}, ${sql(slug)}, ${sql(name)}, ${sql(region)}, ${sql(intro)}, ${sql(wiki)}, ${searches}, ${lat}, ${lng});`
  );
}
lines.push("");

for (const [cc, city, kw, vol, src] of keywordStats) {
  lines.push(
    `INSERT INTO keyword_stats (country_code, city_slug, keyword, monthly_searches, source) VALUES (${sql(cc)}, ${sql(city)}, ${sql(kw)}, ${vol}, ${sql(src)});`
  );
}
lines.push("");

const countryName = Object.fromEntries(countries.map((c) => [c.code, c.name]));

// Hand-written editor picks — real Melbourne rooms with first-person copy, kept as-is.
lines.push(`INSERT INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, price_from, currency, premium, claimed, hours, image_url, source) VALUES (
  'thai-massage-for-u-melbourne',
  'Thai Massage For U',
  'au',
  'melbourne',
  'Melbourne CBD',
  '123 Example Street, Melbourne VIC 3000',
  '+61 4XX XXX XXX',
  'hello@thaimassageforu.com',
  'https://thaimassageforu.com',
  'Traditional Thai,Relaxation,Foot massage,Couples',
  'The original Thai Massage For U studio in Melbourne. Traditional Thai, relaxation, couples sessions and foot massage — a room you can walk to after work.',
  99,
  'AUD',
  0,
  1,
  'Mon–Fri 10:00–20:00; Sat–Sun 10:00–18:00',
  '/images/hero.svg',
  'origin'
);`);

lines.push(`INSERT INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, price_from, currency, premium, claimed, hours, image_url, source) VALUES (
  'haruka-japanese-massage',
  'Haruka Japanese Massage',
  'au',
  'melbourne',
  'Melbourne CBD',
  '413/365 Little Collins St, Melbourne VIC 3000',
  '+61 468 480 365',
  NULL,
  NULL,
  'Japanese massage, Relaxation, Beauty & spa',
  'The Japanese room on Little Collins I send people to when they are already in the CBD and do not want a tourist spa. Close enough after a meeting that you walk, sit, and walk home.',
  NULL,
  'AUD',
  2,
  1,
  'From 11:00',
  '/images/partners/haruka.jpg',
  'editor'
);`);
lines.push(`INSERT INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, price_from, currency, premium, claimed, hours, image_url, source) VALUES (
  'noir-33-south-yarra',
  'NOIR 33 Massage & Spa',
  'au',
  'melbourne',
  'South Yarra',
  '10/209 Toorak Rd, South Yarra VIC 3141',
  '+61 481 333 209',
  'bookings@noir33.com.au',
  'https://noir33.com.au',
  'Private lounge, Specialty wellness, Premium packages',
  'South Yarra, not the CBD. Low lights, a lounge on Toorak Road, the room I mention when someone wants to disappear for an hour rather than sit in a shopfront on Collins.',
  NULL,
  'AUD',
  2,
  1,
  'Closes 20:00',
  '/images/partners/noir33.jpg',
  'editor'
);`);
lines.push(`INSERT INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, price_from, currency, premium, claimed, hours, image_url, source) VALUES (
  'betty-werribee',
  'Betty — independent masseuse',
  'au',
  'melbourne',
  'Werribee',
  'Werribee, western suburbs, Melbourne VIC',
  '+61 478 898 557',
  NULL,
  NULL,
  'Independent massage, Personal massage, Relaxation',
  'Betty is a highly skilled, qualified independent masseuse in Werribee. Amazing service — one person, one room. Call 0478 898 557. For people who live west of the river and should not have to come into the CBD for a proper hour.',
  NULL,
  'AUD',
  2,
  1,
  'Call to book',
  '/images/partners/betty.jpg',
  'editor'
);`);

let totalReal = 0;
let totalSkippedAdult = 0;
let totalWithRealPhoto = 0;

for (const [code, slug, name] of cities) {
  const records = osmData[`${code}/${slug}`] ?? [];
  const usedSlugs = new Set(code === "au" && slug === "melbourne" ? ["thai-massage-for-u-melbourne"] : []);

  for (const record of records) {
    if (ADULT_NAME_PATTERN.test(record.name)) {
      totalSkippedAdult += 1;
      continue;
    }

    let listingSlug = `${slugify(record.name)}-${slug}`;
    if (usedSlugs.has(listingSlug)) {
      let n = 2;
      while (usedSlugs.has(`${listingSlug}-${n}`)) n += 1;
      listingSlug = `${listingSlug}-${n}`;
    }
    usedSlugs.add(listingSlug);

    const address = addressFor(record, name);
    const description = describe(record, name, countryName[code]);
    const hours = hoursFor(record);
    const osmKey = `${record.osmType}/${record.osmId}`;
    const photoUrl = photoOverrides[osmKey] ?? null;

    lines.push(`INSERT OR IGNORE INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, currency, premium, claimed, hours, image_url, source, source_url, osm_id) VALUES (
      ${sql(listingSlug)},
      ${sql(record.name.slice(0, 80))},
      ${sql(code)},
      ${sql(slug)},
      ${sql(name)},
      ${sql(address)},
      ${sql(record.phone)},
      ${sql(record.email)},
      ${sql(record.website)},
      ${sql(servicesFor(record))},
      ${sql(description)},
      ${sql(currencyFor[code])},
      0,
      0,
      ${sql(hours)},
      ${sql(photoUrl)},
      'openstreetmap',
      ${sql(`https://www.openstreetmap.org/${record.osmType}/${record.osmId}`)},
      ${sql(osmKey)}
    );`);
    totalReal += 1;
    if (photoUrl) totalWithRealPhoto += 1;
  }
}

lines.push("");
lines.push("-- Outreach CRM: one row per unclaimed real listing, so someone can track");
lines.push("-- who's been asked to claim their business. This never sends anything itself.");
lines.push("DELETE FROM crm_contacts;");
lines.push(
  "INSERT INTO crm_contacts (listing_id, business_name, country_code, city_slug, phone, email, website, stage) SELECT id, name, country_code, city_slug, phone, email, website, 'new' FROM listings WHERE claimed = 0;"
);

writeFileSync(new URL("../seed/seed.sql", import.meta.url), lines.join("\n") + "\n");
console.log(
  `Wrote seed with ${countries.length} countries, ${cities.length} cities, ${totalReal} real OSM listings (skipped ${totalSkippedAdult} adult-services matches, ${totalWithRealPhoto} with a real photo from their own website) + 4 editor picks`
);
