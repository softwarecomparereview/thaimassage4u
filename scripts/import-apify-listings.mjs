// Imports the quality-filtered Apify pull (data/apify-listings.json) into the
// live `listings` table, deduping against what's already there so the same
// real business doesn't end up listed twice under two different scrape
// sources (the original OSM pull vs. this Google Maps one). Writes a plain
// SQL file for review/apply via `wrangler d1 execute --file` — this script
// itself never touches D1 directly.
//
// Usage: node scripts/import-apify-listings.mjs <existing.json> <out.sql>
//   existing.json — output of:
//     wrangler d1 execute thaimassageforu --remote --json --command \
//       "SELECT name, city_slug, address FROM listings WHERE country_code='de'"

import { readFileSync, writeFileSync } from "node:fs";

const [, , existingPath, outPath] = process.argv;
if (!existingPath || !outPath) {
  console.error("Usage: node scripts/import-apify-listings.mjs <existing.json> <out.sql>");
  process.exit(1);
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|gbr|ug|e\.?k\.?|inh\.?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Street + house number only — city/postcode/neighbourhood suffix varies too much between
// sources to match on reliably, but the street address is where a chain's branches actually
// differ. Token-sorted rather than compared as a raw string, since the two sources order
// street-name vs. house-number differently ("67 Herzogstraße" vs. "Herzogstraße 67").
function normalizeAddress(address) {
  if (!address) return "";
  return address
    .toLowerCase()
    .split(",")[0]
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const pull = JSON.parse(readFileSync(new URL("../data/apify-listings.json", import.meta.url)));
const existingRaw = JSON.parse(readFileSync(existingPath, "utf8"));
const existing = existingRaw[0].results;

// Same name + same city + same address (order-insensitive) is a duplicate. Same name + same
// city with a DIFFERENT address is a different branch of a chain (e.g. "Bua Siam Thai-Massage
// & Spa" has 7 real Munich locations) — matching on name+city alone would have wrongly
// collapsed all of them into one. If either side is missing an address, fall back to name+city
// as a conservative "probably the same place" match rather than risking a duplicate listing.
const existingAddressesByNameCity = new Map();
for (const r of existing) {
  const nameCityKey = `${r.city_slug}::${normalizeName(r.name)}`;
  if (!existingAddressesByNameCity.has(nameCityKey)) existingAddressesByNameCity.set(nameCityKey, new Set());
  existingAddressesByNameCity.get(nameCityKey).add(normalizeAddress(r.address));
}
function isDuplicate(nameCityKey, normalizedAddress) {
  const addresses = existingAddressesByNameCity.get(nameCityKey);
  if (!addresses) return false;
  if (!normalizedAddress || addresses.has("")) return true; // no address to compare on one side — be conservative
  return addresses.has(normalizedAddress);
}
const existingSlugs = new Set(existing.map(r => r.slug).filter(Boolean));

// Google Maps text search for "massage"/"spa" pulls in a lot of loosely-related matches —
// dermatology clinics, cosmetics studios, laser hair removal, permanent makeup artists — that
// Google ranks as relevant but aren't actually massage/spa businesses. The original OSM scraper
// avoided this by querying precise category tags (shop=massage, amenity=spa); this actor doesn't
// expose a category field in its output, so the name itself is the only reliable signal available
// after the fact. Requiring "massage" or "spa" literally in the name is conservative — it drops
// some real wellness places whose name doesn't say either word — but that's the safer failure mode
// for a directory that's explicit about never listing something it can't stand behind.
function isRelevant(name) {
  if (!/massage|\bspa\b/i.test(name)) return false;
  // "Spa" in a name is not evidence of massage. Nail salons were the whole of
  // the off-category residue in the 2026-08-26 listing audit — CITY NAILS &
  // SPA, Mia Nails & Spa, BS Nails Cosmetic Spa, Sofia Spa Nails & Beauty,
  // Lovey Nail — so a name that says nails and never says massage is out.
  if (/nail|nagelstudio/i.test(name) && !/massage|thai|wellness/i.test(name)) return false;
  return true;
}

/**
 * A listing nobody can act on is worse than no listing: a visitor cannot call,
 * visit or book, a crawler gets a contentless page, and the claim flow has no
 * address to send its one-time code to, so the business can never fix it
 * either. The 2026-08-26 audit quarantined 38 such rows; this keeps the next
 * import from adding more.
 */
function isContactable(listing) {
  return Boolean(listing.phone || listing.website || listing.email || listing.address);
}

const kept = [];
const skippedDuplicates = [];
const skippedIrrelevant = [];
const seenThisBatch = new Set(); // guards against the same place appearing twice within this pull
const skippedUnactionable = [];
for (const listing of pull.listings) {
  if (!isRelevant(listing.name)) {
    skippedIrrelevant.push(listing);
    continue;
  }
  if (!isContactable(listing)) {
    skippedUnactionable.push(listing);
    continue;
  }
  const nameCityKey = `${listing.citySlug}::${normalizeName(listing.name)}`;
  const address = normalizeAddress(listing.address);
  const batchKey = `${nameCityKey}::${address}`;
  if (isDuplicate(nameCityKey, address) || seenThisBatch.has(batchKey)) {
    skippedDuplicates.push(listing);
    continue;
  }
  seenThisBatch.add(batchKey);
  kept.push(listing);
}

const usedSlugs = new Set(existingSlugs);
function uniqueSlug(name, citySlug) {
  const base = `${slugify(name)}-${citySlug}`;
  let candidate = base;
  let n = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${n}`;
    n++;
  }
  usedSlugs.add(candidate);
  return candidate;
}

// listings.description and .services are NOT NULL with no default — built from only the real
// facts this listing actually has, nothing invented (no rating/review claim unless Apify really
// returned one for this place).
function cityDisplayName(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function buildDescription(listing) {
  const parts = [`${listing.name} is an independently listed massage and wellness business in ${cityDisplayName(listing.citySlug)}.`];
  if (listing.address) parts.push(`Located at ${listing.address}.`);
  if (typeof listing.rating === "number" && listing.reviewCount) parts.push(`Rated ${listing.rating}★ from ${listing.reviewCount} reviews on Google.`);
  return parts.join(" ");
}

const lines = [];
for (const listing of kept) {
  const slug = uniqueSlug(listing.name, listing.citySlug);
  lines.push(
    `INSERT INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, price_from, currency, premium, claimed, source, source_url, place_id, rating, review_count) VALUES (${sqlString(slug)}, ${sqlString(listing.name)}, ${sqlString(listing.countryCode)}, ${sqlString(listing.citySlug)}, ${sqlString(listing.suburb)}, ${sqlString(listing.address)}, ${sqlString(listing.phone)}, ${sqlString(listing.email)}, ${sqlString(listing.website)}, ${sqlString("Massage")}, ${sqlString(buildDescription(listing))}, NULL, NULL, 0, 0, 'apify_google_maps', ${sqlString(listing.website)}, ${sqlString(listing.placeId)}, ${listing.rating ?? "NULL"}, ${listing.reviewCount ?? "NULL"});`,
  );
}

writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Pull had ${pull.listings.length} listings.`);
console.log(`Skipped as not actually massage/spa businesses: ${skippedIrrelevant.length}`);
console.log(`Skipped as unactionable (no phone, website, email or address): ${skippedUnactionable.length}`);
console.log(`Skipped as likely duplicates of existing listings: ${skippedDuplicates.length}`);
console.log(`New listings to insert: ${kept.length}`);
console.log(`SQL written to ${outPath}`);
if (skippedDuplicates.length) {
  console.log("\nSkipped (duplicate) names:");
  for (const d of skippedDuplicates) console.log(`  - ${d.name} (${d.citySlug})`);
}
