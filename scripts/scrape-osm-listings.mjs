// Scrapes real massage/spa businesses from OpenStreetMap (Overpass API) for every
// city in scripts/cities.mjs and caches the raw results to data/osm-listings.json.
//
// This replaces the fabricated "studioNames" generator that used to invent fake
// business names and street addresses for every city. Everything written here is
// a real, currently-mapped OSM point of interest — name, address, phone and
// website (when the mapper recorded them) come straight from the API response.
//
// Data licence: © OpenStreetMap contributors, ODbL — see https://www.openstreetmap.org/copyright
//
// Usage: node scripts/scrape-osm-listings.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { cities } from "./cities.mjs";

const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const REQUEST_DELAY_MS = 1800;
const MAX_PER_CITY = 24;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function overpassQuery(lat, lng, radius) {
  return `[out:json][timeout:30];(
    node["shop"="massage"](around:${radius},${lat},${lng});
    way["shop"="massage"](around:${radius},${lat},${lng});
    node["amenity"="spa"](around:${radius},${lat},${lng});
    way["amenity"="spa"](around:${radius},${lat},${lng});
    node["leisure"="spa"](around:${radius},${lat},${lng});
  );out center tags;`;
}

async function fetchFromMirror(mirror, query) {
  const response = await fetch(mirror, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`${mirror} -> HTTP ${response.status}`);
  return response.json();
}

async function queryOverpass(lat, lng, radius) {
  const query = overpassQuery(lat, lng, radius);
  let lastError;
  for (const mirror of MIRRORS) {
    try {
      const payload = await fetchFromMirror(mirror, query);
      if (Array.isArray(payload.elements)) return payload.elements;
      lastError = new Error(`${mirror} -> unexpected payload shape`);
    } catch (error) {
      lastError = error;
      console.warn(`  mirror failed: ${error.message}`);
    }
    await sleep(1000);
  }
  throw lastError ?? new Error("all Overpass mirrors failed");
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toRecord(element) {
  const tags = element.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;
  const lat = element.type === "node" ? element.lat : element.center?.lat;
  const lon = element.type === "node" ? element.lon : element.center?.lon;
  return {
    osmType: element.type,
    osmId: element.id,
    name,
    category: tags.shop === "massage" ? "massage" : "spa",
    street: tags["addr:street"] ?? null,
    housenumber: tags["addr:housenumber"] ?? null,
    addrCity: tags["addr:city"] ?? null,
    postcode: tags["addr:postcode"] ?? null,
    phone: tags.phone ?? tags["contact:phone"] ?? null,
    email: tags.email ?? tags["contact:email"] ?? null,
    website: tags.website ?? tags["contact:website"] ?? null,
    openingHours: tags.opening_hours ?? null,
    lat: typeof lat === "number" ? lat : null,
    lon: typeof lon === "number" ? lon : null,
  };
}

async function scrapeCity([countryCode, citySlug, cityName, , , , lat, lng, radius]) {
  console.log(`Scraping ${countryCode}/${citySlug} (${cityName})…`);
  const elements = await queryOverpass(lat, lng, radius ?? 15000);
  const seen = new Set();
  const records = [];
  for (const element of elements) {
    const record = toRecord(element);
    if (!record) continue;
    const key = normalizeName(record.name);
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(record);
  }

  // Prefer the most complete-looking listings first (real phone/website beats a bare pin).
  records.sort((a, b) => {
    const score = (r) => (r.website ? 2 : 0) + (r.phone ? 1 : 0) + (r.street ? 1 : 0);
    return score(b) - score(a);
  });

  const trimmed = records.slice(0, MAX_PER_CITY);
  console.log(`  found ${records.length} real listings, keeping ${trimmed.length}`);
  return trimmed;
}

async function main() {
  const result = {};
  for (const city of cities) {
    const [countryCode, citySlug] = city;
    try {
      result[`${countryCode}/${citySlug}`] = await scrapeCity(city);
    } catch (error) {
      console.error(`  FAILED ${countryCode}/${citySlug}: ${error.message} — leaving previous cache entry untouched if any`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  mkdirSync(new URL("../data", import.meta.url), { recursive: true });
  const outPath = new URL("../data/osm-listings.json", import.meta.url);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "OpenStreetMap Overpass API — © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright)",
        cities: result,
      },
      null,
      2
    ) + "\n"
  );
  const total = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`\nWrote ${total} real listings across ${Object.keys(result).length} cities to data/osm-listings.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
