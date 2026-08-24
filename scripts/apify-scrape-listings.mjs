// Pulls real massage/spa businesses from Google Maps via the Apify actor
// scrapier/google-maps-scraper, one call per city, and applies the same
// minimum data-quality bar we defined for the OSM scrape: must have a name
// and at least a phone or an email — a listing has to be reachable to be
// worth including, not just a pin on a map.
//
// Auth: reads APIFY_TOKEN from the environment. Never hardcode it here.
// Docs followed: https://apify.com/agents.md, https://apify.com/scrapier/google-maps-scraper
//
// Usage: APIFY_TOKEN=xxx node scripts/apify-scrape-listings.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { cities } from "./cities.mjs";

const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) {
  console.error("APIFY_TOKEN is not set — add it as an environment variable and re-run.");
  process.exit(1);
}

// Pay-per-event, no monthly rental (~$1.50/1k places, plus its website-crawl
// enrichment for emails). Swap this one constant if a different actor is picked —
// nothing else in this script is actor-specific beyond the input/output field names below.
const ACTOR = "lukaskrivka~google-maps-with-contact-details";
const TOTAL_TARGET = 1000;
const PER_CITY_PULL = Math.ceil((TOTAL_TARGET / cities.length) * 1.3); // pull a little extra per city to absorb quality-filter losses

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
  const deadline = Date.now() + 10 * 60 * 1000;
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

function isAdultServiceMatch(name) {
  return /tantra|erotic|escort|happy ending|sensual/i.test(name);
}

function toRecord(item, countryCode, citySlug) {
  const name = item.name?.trim();
  if (!name || isAdultServiceMatch(name)) return null;
  return {
    countryCode,
    citySlug,
    name,
    phone: item.phone ?? null,
    email: item.email ?? null, // rarely present from Google Maps directly — kept in case the actor enriches it from the business's own website
    website: item.website ?? null,
    address: item.fullAddress ?? item.address ?? null,
    street: item.street ?? null,
    suburb: item.city ?? null,
    postcode: item.postalCode ?? item.zip ?? null,
    lat: item.location?.lat ?? item.lat ?? null,
    lon: item.location?.lng ?? item.lng ?? null,
    rating: item.totalScore ?? item.rating ?? null,
    reviewCount: item.reviewsCount ?? item.reviewCount ?? null,
    openingHours: item.openingHours ?? null,
    placeId: item.placeId ?? null,
  };
}

async function scrapeCity([countryCode, citySlug, cityName, region, countryName]) {
  const location = `${cityName}, ${countryName}`;
  console.log(`Scraping ${countryCode}/${citySlug} (${location})…`);
  const input = { locations: [location], keywords: ["massage", "spa"], maxResults: PER_CITY_PULL, proxyConfiguration: { useApifyProxy: true } };
  let items;
  try {
    items = await runActorSync(input);
  } catch (syncError) {
    console.warn(`  sync call failed (${syncError.message}), falling back to async run…`);
    items = await runActorAsync(input);
  }
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

function passesQualityBar(record) {
  return Boolean(record.name) && Boolean((record.phone && record.phone.trim()) || (record.email && record.email.trim()));
}

function completenessScore(record) {
  return (record.phone ? 1 : 0) + (record.email ? 1 : 0) + (record.website ? 1 : 0) + (record.address ? 1 : 0);
}

async function main() {
  const all = [];
  for (const city of cities) {
    try {
      all.push(...(await scrapeCity(city)));
    } catch (error) {
      console.error(`  FAILED ${city[0]}/${city[1]}: ${error.message}`);
    }
  }

  const passed = all.filter(passesQualityBar).sort((a, b) => completenessScore(b) - completenessScore(a));
  const trimmed = passed.slice(0, TOTAL_TARGET);

  mkdirSync(new URL("../data", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("../data/apify-listings.json", import.meta.url),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: "Apify scrapier/google-maps-scraper", raw: all.length, passedQualityBar: passed.length, kept: trimmed.length, listings: trimmed }, null, 2) + "\n",
  );

  console.log(`\nRaw pulled: ${all.length}`);
  console.log(`Passed name+phone/email bar: ${passed.length}`);
  console.log(`Kept (capped at ${TOTAL_TARGET}): ${trimmed.length}`);
  const byCountry = {};
  for (const record of trimmed) byCountry[record.countryCode] = (byCountry[record.countryCode] ?? 0) + 1;
  console.log("By country:", byCountry);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
