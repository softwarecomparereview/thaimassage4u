// Pulls real massage/spa businesses from Google Maps via the Apify actor
// lukaskrivka/google-maps-with-contact-details, one call per city, and
// applies a minimum data-quality bar: a name, a real email (campaigns only
// send by email — a phone-only listing isn't reachable by this system),
// and a 4-star-plus rating. This actor crawls each business's own website
// afterward to pull that email address, which plain Google Maps data never
// exposes on its own.
//
// Auth: reads APIFY_TOKEN from the environment. Never hardcode it here.
// Docs followed: https://apify.com/agents.md, https://apify.com/lukaskrivka/google-maps-with-contact-details
//
// Usage: APIFY_TOKEN=xxx node scripts/apify-scrape-listings.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { cities } from "./cities.mjs";
import { isAdultServiceMatch } from "./brand-safety.mjs";

const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) {
  console.error("APIFY_TOKEN is not set — add it as an environment variable and re-run.");
  process.exit(1);
}

// Pay-per-event, no monthly rental (~$2.10/1k places, plus its website-crawl
// enrichment for emails). Swap this one constant if a different actor is picked —
// nothing else in this script is actor-specific beyond the input/output field names below.
// This account's Creator/CUSTOM plan can't run that public Store actor ("doesn't include
// permission to run public Actors") — default to the in-house one built under
// apify-actor/google-maps-scraper, deployed to this account as a private actor. Its output
// uses the same field names on purpose. Override with APIFY_ACTOR env var if needed.
const ACTOR = process.env.APIFY_ACTOR || "0wvCeRnRcrfUKYm5q";
const MIN_RATING = Number(process.env.MIN_RATING || 4);
const MIN_RATING_ENUM = { 2: "two", 2.5: "twoAndHalf", 3: "three", 3.5: "threeAndHalf", 4: "four", 4.5: "fourAndHalf" }[MIN_RATING];

// Per-country targets for this pull — de/us/au only, run in this order (au first, per request);
// uk isn't part of this batch. de is 196 (not 400) because Berlin/Munich/Hamburg already ran and
// their 204 quality-passed listings are already imported — SKIP_ALREADY_DONE below skips
// re-scraping those three cities, so only Frankfurt/Cologne split the remaining de budget.
const ALL_COUNTRY_TARGETS = { au: 200, de: 196, us: 400 };
const ONLY_COUNTRIES = process.env.SCRAPE_COUNTRIES ? process.env.SCRAPE_COUNTRIES.split(",").map(s => s.trim()) : null;
const COUNTRY_TARGETS = ONLY_COUNTRIES
  ? Object.fromEntries(Object.entries(ALL_COUNTRY_TARGETS).filter(([code]) => ONLY_COUNTRIES.includes(code)))
  : ALL_COUNTRY_TARGETS;
const SKIP_ALREADY_DONE = new Set(["de/berlin", "de/munich", "de/hamburg"]);
const RUN_CITIES = cities
  .filter(([countryCode, citySlug]) => countryCode in COUNTRY_TARGETS && !SKIP_ALREADY_DONE.has(`${countryCode}/${citySlug}`))
  .sort((a, b) => Object.keys(COUNTRY_TARGETS).indexOf(a[0]) - Object.keys(COUNTRY_TARGETS).indexOf(b[0]));
const citiesByCountry = {};
for (const city of RUN_CITIES) (citiesByCountry[city[0]] ??= []).push(city);
// Pull a third more than the target per city to absorb quality-filter losses (name+phone/email+4-star bar).
function perCityPull(countryCode) {
  return Math.ceil((COUNTRY_TARGETS[countryCode] / citiesByCountry[countryCode].length) * 1.3);
}

async function runActorSync(input) {
  const response = await fetch(`https://api.apify.com/v2/actors/${ACTOR}/run-sync-get-dataset-items?timeout=280`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Apify actor call failed: HTTP ${response.status} — ${await response.text().catch(() => "")}`);
  return response.json();
}

/** Sync endpoint times out at 300s server-side — fall back to the async run+poll flow for a city that doesn't finish in time. */
async function runActorAsync(input) {
  const startResponse = await fetch(`https://api.apify.com/v2/actors/${ACTOR}/runs`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!startResponse.ok) throw new Error(`Apify run start failed: HTTP ${startResponse.status}`);
  const { data: run } = await startResponse.json();
  let status = run.status;
  let runId = run.id;
  // The custom actor's default run timeout is 1800s, and a full city batch (dozens of places,
  // each with a website+email lookup) can genuinely take most of that — 10 minutes wasn't enough.
  const deadline = Date.now() + 32 * 60 * 1000;
  while (!["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(status) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const pollResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, { headers: { authorization: `Bearer ${TOKEN}` } });
    const { data: polled } = await pollResponse.json();
    status = polled.status;
    run.defaultDatasetId = polled.defaultDatasetId;
  }
  if (status !== "SUCCEEDED") throw new Error(`Apify run ended with status ${status}`);
  const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items`, { headers: { authorization: `Bearer ${TOKEN}` } });
  return itemsResponse.json();
}

function toRecord(item, countryCode, citySlug) {
  const name = item.title?.trim();
  const email = Array.isArray(item.emails) ? (item.emails[0] ?? null) : (item.emails ?? null);
  if (!name || isAdultServiceMatch(name, item.website, email)) return null;
  return {
    countryCode,
    citySlug,
    name,
    phone: item.phone ?? item.phoneUnformatted ?? null,
    email,
    website: item.website ?? null,
    address: item.address ?? null,
    street: item.street ?? null,
    suburb: item.city ?? null,
    postcode: item.postalCode ?? null,
    lat: item.location?.lat ?? null,
    lon: item.location?.lng ?? null,
    rating: item.totalScore ?? null,
    reviewCount: item.reviewsCount ?? null,
    openingHours: item.openingHours ?? null,
    imageUrl: item.imageUrl ?? null,
    placeId: item.placeId ?? null,
  };
}

/** Each request is capped at 100, tried up to 4 times (the usage-limit error can be transient —
 * account budget resetting or being raised mid-run), then stepped down to 50 and 25 as smaller,
 * cheaper asks that might still fit under whatever budget remains. Only "Monthly usage hard limit
 * exceeded" triggers a step-down retry — any other error fails the city immediately. */
const BATCH_SIZES = [100, 100, 100, 100, 50, 25];

async function attemptScrape(input) {
  try {
    return await runActorSync(input);
  } catch (syncError) {
    console.warn(`  sync call failed (${syncError.message}), falling back to async run…`);
    return runActorAsync(input);
  }
}

async function scrapeCity([countryCode, citySlug, cityName, region, countryName]) {
  const location = `${cityName}, ${countryName}`;
  const target = perCityPull(countryCode);
  let items = null;
  let lastError;
  for (const rawSize of BATCH_SIZES) {
    const size = Math.min(rawSize, target);
    console.log(`Scraping ${countryCode}/${citySlug} (${location}), batch of ${size}…`);
    try {
      items = await attemptScrape({ searchStringsArray: ["massage", "spa"], locationQuery: location, maxCrawledPlacesPerSearch: size, language: "en", placeMinimumStars: MIN_RATING_ENUM });
      break;
    } catch (error) {
      lastError = error;
      if (!/Monthly usage hard limit exceeded/.test(error.message)) throw error;
      console.warn(`  usage limit hit at batch ${size} — stepping down…`);
    }
  }
  if (!items) throw lastError ?? new Error("all batch sizes failed");

  const seen = new Set();
  const records = [];
  for (const item of items) {
    const record = toRecord(item, countryCode, citySlug);
    if (!record) continue;
    const key = record.placeId ?? record.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(record);
  }
  console.log(`  found ${records.length} unique real listings`);
  return records;
}

// Campaigns only send by email — a phone-only listing can't actually be reached by this system,
// so email is now a hard requirement rather than "phone or email".
function passesQualityBar(record) {
  const hasEmail = Boolean(record.email && record.email.trim());
  const hasRating = typeof record.rating === "number" && record.rating >= MIN_RATING;
  return Boolean(record.name) && hasEmail && hasRating;
}

function completenessScore(record) {
  return (record.phone ? 1 : 0) + (record.email ? 1 : 0) + (record.website ? 1 : 0) + (record.address ? 1 : 0);
}

async function main() {
  const all = [];
  for (const city of RUN_CITIES) {
    try {
      all.push(...(await scrapeCity(city)));
    } catch (error) {
      console.error(`  FAILED ${city[0]}/${city[1]}: ${error.message}`);
    }
  }

  const passed = all.filter(passesQualityBar);
  // Trim per country to that country's own target, not one global cap — otherwise a big
  // early country (de, scraped first) could crowd out us/au's share of a shared 1000 cap.
  const trimmed = [];
  const keptByCountry = {};
  for (const countryCode of Object.keys(COUNTRY_TARGETS)) {
    const countryPassed = passed.filter(r => r.countryCode === countryCode).sort((a, b) => completenessScore(b) - completenessScore(a) || b.rating - a.rating);
    const countryTrimmed = countryPassed.slice(0, COUNTRY_TARGETS[countryCode]);
    trimmed.push(...countryTrimmed);
    keptByCountry[countryCode] = countryTrimmed.length;
  }

  mkdirSync(new URL("../data", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("../data/apify-listings.json", import.meta.url),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: "Apify lukaskrivka/google-maps-with-contact-details", minRating: MIN_RATING, targets: COUNTRY_TARGETS, raw: all.length, passedQualityBar: passed.length, kept: trimmed.length, listings: trimmed }, null, 2) + "\n",
  );

  console.log(`\nRaw pulled: ${all.length}`);
  console.log(`Passed name+phone/email+${MIN_RATING}★ bar: ${passed.length}`);
  console.log(`Kept per country target:`, keptByCountry, `(total ${trimmed.length})`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
