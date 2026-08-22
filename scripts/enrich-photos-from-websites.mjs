// For every OSM-scraped listing that has a real website, fetch that business's own
// public page and pull its og:image (the photo it already publishes for link
// previews/social shares — exactly what this is for). This replaces the generic
// rotating stock-photo fallback with a real photo of that specific business,
// without touching Google Maps/Search at all.
//
// This mirrors the *primary* code path of the production thumbnail pipeline
// (src/lib/thumbnails.ts: og:image via fetch first, browser screenshot only as a
// last-resort fallback) — a full browser wasn't usable for outbound HTTPS in this
// sandbox (proxy/TLS limitation, confirmed and not worked around), so this script
// sticks to the fetch-based path, same as production does for the common case.
//
// Usage: node scripts/enrich-photos-from-websites.mjs

import { readFileSync, writeFileSync } from "node:fs";

const UA = "ThaiMassageForUBot/1.0 (+https://thaimassageforu.com)";
const FETCH_TIMEOUT_MS = 9000;
const CONCURRENCY = 8;
const BLOCKED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "facebook.com",
  "www.facebook.com",
  "instagram.com",
  "www.instagram.com",
]);

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

function extractOgImage(html, baseUrl) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      const url = new URL(match[1], baseUrl);
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchText(url) {
  const { signal, cleanup } = withTimeout(null, FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal,
      headers: { "user-agent": UA, accept: "text/html" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;
    const text = await response.text();
    return { text: text.slice(0, 200_000), finalUrl: response.url };
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

async function verifyImage(url) {
  const { signal, cleanup } = withTimeout(null, FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal, headers: { "user-agent": UA } });
    if (!response.ok) return false;
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return false;
    return true;
  } catch {
    return false;
  } finally {
    cleanup();
  }
}

function isAllowed(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return !BLOCKED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function enrichOne(record) {
  if (!record.website || !isAllowed(record.website)) return null;
  const page = await fetchText(record.website);
  if (!page) return null;
  const imageUrl = extractOgImage(page.text, page.finalUrl);
  if (!imageUrl || !isAllowed(imageUrl)) return null;
  const ok = await verifyImage(imageUrl);
  return ok ? imageUrl : null;
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

async function main() {
  const data = JSON.parse(readFileSync(new URL("../data/osm-listings.json", import.meta.url), "utf8"));
  const flat = [];
  for (const [cityKey, records] of Object.entries(data.cities)) {
    for (const record of records) flat.push({ cityKey, record });
  }
  const withWebsite = flat.filter((r) => r.record.website);
  console.log(`${withWebsite.length} of ${flat.length} scraped listings have a website to check`);

  let done = 0;
  const photos = {};
  await runPool(
    withWebsite,
    async ({ cityKey, record }) => {
      const key = `${record.osmType}/${record.osmId}`;
      try {
        const imageUrl = await enrichOne(record);
        if (imageUrl) photos[key] = imageUrl;
      } catch {
        // skip — a broken business site shouldn't stop the run
      }
      done += 1;
      if (done % 25 === 0) console.log(`  checked ${done}/${withWebsite.length}, found ${Object.keys(photos).length} real photos so far`);
    },
    CONCURRENCY
  );

  writeFileSync(
    new URL("../data/osm-listing-photos.json", import.meta.url),
    JSON.stringify({ generatedAt: new Date().toISOString(), photos }, null, 2) + "\n"
  );
  console.log(`\nFound real photos for ${Object.keys(photos).length}/${withWebsite.length} listings with a website. Wrote data/osm-listing-photos.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
