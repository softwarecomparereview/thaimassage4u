// Daily massage-supply price scanner. For each country the directory covers, fetches
// that country's own eBay site (local sellers → local delivery) for a fixed set of
// supply categories a massage business actually re-buys, parses the cheapest
// buy-it-now offers, and pushes them to the dataset. The Worker pulls the latest
// successful run's dataset once a day and serves it on /supplies.
//
// eBay chosen deliberately: per-country marketplaces (so "deliverable to your city"
// holds), tolerates plain HTTP fetches from Apify egress, no API key required, and
// commerce affiliate programs (eBay Partner Network) can be layered on the outbound
// URLs later without changing this scanner.
//
// Pages are loaded through a real headless browser: eBay's Akamai edge 403s plain
// HTTP fetches from datacenter IPs (verified — every curl-style request came back
// 403), but renders normally for an actual Chrome, the same pattern that made the
// Google Maps scraper work from this account. Two markup generations are parsed
// (legacy .s-item and 2025+ .s-card) because eBay A/B-serves templates per request.

import { Actor } from "apify";
import { chromium } from "playwright";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const EBAY_DOMAINS = { us: "www.ebay.com", au: "www.ebay.com.au", uk: "www.ebay.co.uk", de: "www.ebay.de" };
const CURRENCIES = { us: "USD", au: "AUD", uk: "GBP", de: "EUR" };

/** What a massage business re-buys. Query terms tuned per language market.
 * mustMatch guards against cheapest-first surfacing accessories that merely share a
 * keyword (a $4 "fragrance oil" is not bulk massage oil); minPrice cuts the samples,
 * spares and obvious junk that would otherwise always win a cheapest-first sort. */
const CATEGORIES = [
  { key: "sheets", label: "Massage table sheets & covers", query: { en: "massage table sheet set", de: "massageliege bezug laken" }, mustMatch: /massage|table|liege/i, minPrice: 10 },
  { key: "oil", label: "Massage oil (bulk)", query: { en: "massage oil 5l bulk", de: "massageöl 5l" }, mustMatch: /massage/i, minPrice: 12 },
  { key: "towels", label: "Towels (bulk)", query: { en: "bath towels bulk white salon", de: "handtücher weiß set salon" }, mustMatch: /towel|handt(u|ü)ch/i, minPrice: 15 },
  { key: "face-cradle", label: "Face cradle covers", query: { en: "face cradle covers massage disposable", de: "nasenschlitztücher massage" }, mustMatch: /cradle|face|nasenschlitz/i, minPrice: 8 },
  { key: "massage-gun", label: "Massage guns", query: { en: "massage gun percussion", de: "massagepistole" }, mustMatch: /massage\s*gun|massagepistole|percussion/i, minPrice: 20 },
  { key: "hot-stones", label: "Hot stone sets", query: { en: "hot stone massage set", de: "hot stone massage set" }, mustMatch: /stone|stein/i, minPrice: 12 },
];

function log(...args) { console.log(new Date().toISOString(), ...args); }

function searchUrl(country, category) {
  const lang = country === "de" ? "de" : "en";
  const q = encodeURIComponent(category.query[lang]);
  // LH_BIN=1: buy-it-now only. _sop=15: price+postage lowest first — eBay does the
  // "best and cheapest" sort for us, delivery cost included.
  return `https://${EBAY_DOMAINS[country]}/sch/i.html?_nkw=${q}&LH_BIN=1&_sop=15&_ipg=60`;
}

async function fetchPage(context, url) {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (response && response.status() >= 400) { log(`  HTTP ${response.status()} for ${url}`); return null; }
    await page.waitForTimeout(1200);
    const html = await page.content();
    if (/pardon our interruption|verify you.?re a human|access denied/i.test(html.slice(0, 5000))) {
      log(`  blocked (bot gate) for ${url}`);
      return null;
    }
    return html;
  } catch (error) {
    log(`  page load failed: ${error.message}`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

function parsePrice(text) {
  if (!text) return null;
  // "AU $12.95", "EUR 9,99", "£8.50", "$1,299.00" — normalise decimal comma markets.
  const cleaned = text.replace(/\s/g, "");
  const match = cleaned.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+)/);
  if (!match) return null;
  let raw = match[1];
  if (/,\d{2}$/.test(raw)) raw = raw.replace(/\./g, "").replace(",", ".");
  else raw = raw.replace(/,/g, "");
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

/** Legacy template: <li class="s-item ..."> blocks. */
function parseSItems(html) {
  const items = [];
  const blocks = html.split(/<li class="s-item\b/).slice(1);
  for (const block of blocks.slice(0, 80)) {
    const title = block.match(/class="s-item__title"[^>]*>(?:<[^>]+>)*([^<]{5,200})</)?.[1];
    const url = block.match(/class="s-item__link"[^>]*href="([^"]+)"/)?.[1] ?? block.match(/href="(https:\/\/www\.ebay[^"]+\/itm\/[^"]+)"/)?.[1];
    const priceText = block.match(/class="s-item__price"[^>]*>([\s\S]{0,80}?)<\//)?.[1]?.replace(/<[^>]+>/g, "");
    const shippingText = block.match(/class="s-item__shipping[^"]*"[^>]*>([^<]{0,80})</)?.[1] ?? "";
    const image = block.match(/<img[^>]+src="(https:\/\/i\.ebayimg\.com[^"]+)"/)?.[1] ?? null;
    if (title && url && priceText) items.push({ title, url, priceText, shippingText, image });
  }
  return items;
}

/** 2025+ template: <div class="s-card ..."> blocks with su-styled-text price spans. */
function parseSCards(html) {
  const items = [];
  const blocks = html.split(/class="s-card\b/).slice(1);
  for (const block of blocks.slice(0, 80)) {
    const url = block.match(/href="(https:\/\/www\.ebay[^"]*\/itm\/[^"]+)"/)?.[1];
    const title = block.match(/class="s-card__title"[^>]*>(?:<[^>]+>)*([^<]{5,200})</)?.[1]
      ?? block.match(/<img[^>]+alt="([^"]{5,200})"/)?.[1];
    const priceText = block.match(/class="s-card__price"[^>]*>([^<]{1,60})</)?.[1]
      ?? block.match(/class="[^"]*su-styled-text[^"]*"[^>]*>((?:[£$€]|AU|EUR|USD)[^<]{1,40})</)?.[1];
    const shippingText = block.match(/(?:delivery|Lieferung|postage|shipping)[^<]{0,60}/i)?.[0] ?? "";
    const image = block.match(/<img[^>]+src="(https:\/\/i\.ebayimg\.com[^"]+)"/)?.[1] ?? null;
    if (title && url && priceText) items.push({ title, url, priceText, shippingText, image });
  }
  return items;
}

function toOffers(rawItems, country, category, max) {
  const currency = CURRENCIES[country];
  const seen = new Set();
  const offers = [];
  for (const item of rawItems) {
    const title = decodeEntities(item.title);
    if (/^shop on ebay$/i.test(title)) continue; // eBay's own placeholder card
    const price = parsePrice(item.priceText);
    if (price === null) continue;
    if (price < (category.minPrice ?? 0)) continue;
    if (category.mustMatch && !category.mustMatch.test(title)) continue;
    const freeShipping = /free|kostenlos|gratis/i.test(item.shippingText);
    const shipping = freeShipping ? 0 : parsePrice(item.shippingText);
    const url = item.url.split("?")[0];
    if (seen.has(url)) continue;
    seen.add(url);
    offers.push({
      country,
      categoryKey: category.key,
      categoryLabel: category.label,
      title: title.slice(0, 160),
      price,
      shipping: shipping ?? null,
      total: price + (shipping ?? 0),
      currency,
      freeShipping,
      url,
      image: item.image,
      supplier: "ebay",
    });
  }
  offers.sort((a, b) => a.total - b.total);
  return offers.slice(0, max);
}

async function run() {
  await Actor.init();
  const input = (await Actor.getInput()) ?? {};
  const countries = (input.countries ?? ["us", "au", "uk", "de"]).filter(c => c in EBAY_DOMAINS);
  const maxPerCategory = Math.min(Math.max(Number(input.maxPerCategory ?? 6) || 6, 1), 20);

  // --disable-dev-shm-usage: containers give Chrome a tiny /dev/shm; renderers
  // accumulate shared memory across page loads and die with "Target crashed" on the
  // second navigation without it (exactly the failure pattern the first runs showed).
  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage", "--no-sandbox"] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 }, locale: "en" });
  // eBay search pages carry hundreds of images plus ad/analytics payloads — we only
  // need the HTML, so skip the heavy resource types.
  await context.route("**/*", route => {
    const type = route.request().resourceType();
    if (type === "image" || type === "media" || type === "font") return route.abort();
    return route.continue();
  });

  let pushed = 0;
  for (const country of countries) {
    // Warm the session on the marketplace homepage first — Akamai 403s the very
    // first request from a cold browser but accepts the rest once cookies exist.
    const warm = await context.newPage();
    await warm.goto(`https://${EBAY_DOMAINS[country]}/`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await warm.waitForTimeout(1500);
    await warm.close().catch(() => {});

    for (const category of CATEGORIES) {
      const url = searchUrl(country, category);
      log(`Scanning ${country}/${category.key}: ${url}`);
      let html = await fetchPage(context, url);
      if (!html) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        log(`  retrying ${country}/${category.key}…`);
        html = await fetchPage(context, url);
      }
      if (!html) continue;

      if (input.debugCategory === `${country}/${category.key}`) {
        await Actor.setValue("DEBUG_HTML", html.slice(0, 300_000), { contentType: "text/html" });
        log("  debug HTML saved to key-value store as DEBUG_HTML");
        continue;
      }

      let rawItems = parseSItems(html);
      if (!rawItems.length) rawItems = parseSCards(html);
      const offers = toOffers(rawItems, country, category, maxPerCategory);
      log(`  parsed ${rawItems.length} raw → kept ${offers.length}`);
      for (const offer of offers) await Actor.pushData(offer);
      pushed += offers.length;
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
    }
  }
  await browser.close().catch(() => {});
  log(`Done. Pushed ${pushed} offers.`);
  await Actor.exit();
}

run().catch(async error => {
  console.error(error);
  await Actor.exit({ exitCode: 1 });
});
