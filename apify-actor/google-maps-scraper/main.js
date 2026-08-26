// Custom Google Maps business scraper — built in-house because this Apify account's plan
// (Creator/CUSTOM) can only run actors it owns, not public Store actors like
// lukaskrivka/google-maps-with-contact-details. Output field names deliberately match that
// actor's so scripts/apify-scrape-listings.mjs works unchanged against either one — only the
// ACTOR id constant needs to change.
//
// Input:  { searchStringsArray: string[], locationQuery: string, maxCrawledPlacesPerSearch?: number,
//            language?: string, placeMinimumStars?: "" | "two" | "twoAndHalf" | ... }
// Output (per item, pushed to the default dataset):
//   title, phone, phoneUnformatted, emails[], website, address, street, city, postalCode,
//   location: { lat, lng }, totalScore, reviewsCount, placeId, category, openingHours[], imageUrl
//
// openingHours and imageUrl are ours, beyond the public actor's field list. They were the two
// things the 2026-08-26 listing audit found missing everywhere: 0 listings showed opening
// hours and 94% had no photo, because nothing here ever read them off the page.
//
// This can't be tested locally in this sandbox (its outbound proxy resets connections to
// google.com over a real browser) — it's built defensively, deployed straight to Apify, and
// debugged from there via run logs.

import { Actor } from "apify";
import { chromium } from "playwright";

const STAR_ENUM_TO_MIN = {
  two: 2, twoAndHalf: 2.5, three: 3, threeAndHalf: 3.5, four: 4, fourAndHalf: 4.5,
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
// Detail pages (browser tabs) processed at once — each is its own page under the same
// context, so this trades memory for wall-clock: at ~14s/place sequential, 200 places would
// take 45+ minutes and blow past any sane actor timeout.
const DETAIL_CONCURRENCY = 6;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function dismissConsent(page) {
  try {
    // EU/consent-gate redirect ("Before you continue to Google Maps")
    if (/consent\.google\./.test(page.url())) {
      const btn = page.locator("button:has-text('Accept all'), button:has-text('I agree'), form button[type=submit]").first();
      if (await btn.count()) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
      }
      return;
    }
    // In-page consent dialog on maps.google.com itself
    const inline = page.locator("button:has-text('Accept all'), button[aria-label*='Accept']").first();
    if (await inline.count()) await inline.click({ timeout: 3000 }).catch(() => {});
  } catch { /* best effort */ }
}

async function looksBlocked(page) {
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  return /unusual traffic|verify you.?re a human|detected unusual/i.test(text || "");
}

/** Scrolls the results feed until we have `target` distinct place links or it stalls. */
async function collectPlaceLinks(page, target) {
  const feedSelector = 'div[role="feed"]';
  await page.waitForSelector(feedSelector, { timeout: 20000 });
  const seen = new Set();
  let stall = 0;
  for (let i = 0; i < 40 && seen.size < target && stall < 5; i++) {
    const hrefs = await page.$$eval(`${feedSelector} a[href*="/maps/place/"]`, as => as.map(a => a.href));
    const before = seen.size;
    for (const href of hrefs) seen.add(href);
    if (seen.size === before) stall++; else stall = 0;
    await page.evaluate(sel => {
      const feed = document.querySelector(sel);
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, feedSelector);
    await sleep(1200 + Math.random() * 600);
  }
  return [...seen].slice(0, target);
}

function extractLatLng(url) {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

function extractCid(url) {
  const m = url.match(/0x[0-9a-f]+:0x[0-9a-f]+/i);
  return m ? m[0] : null;
}

// Google Maps detail buttons often wrap an icon glyph ahead of the visible text, which
// innerText() reports as a leading blank line ("\n+61 3 9044 6805") — trim() alone doesn't
// remove that because the blank line is a real line, not leading whitespace. Split into lines
// and drop the empty ones instead.
function cleanText(raw) {
  if (!raw) return null;
  const lines = raw.split("\n").map(s => s.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : null;
}

async function textOf(page, selector) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return null;
  const raw = await el.innerText({ timeout: 3000 }).catch(() => "");
  return cleanText(raw);
}

/**
 * Google renders the hours table collapsed behind a summary button. The whole
 * week is in the table's aria-label ("Sunday, Closed; Monday, 10 am to 8 pm; ...")
 * whether or not it has been expanded, which is far more robust than clicking it
 * open and reading rows.
 */
async function scrapeOpeningHours(page) {
  const labelled = page.locator('div[aria-label*=" am to "], div[aria-label*=" pm to "], div[aria-label*="Closed"]').first();
  if (await labelled.count()) {
    const label = await labelled.getAttribute("aria-label").catch(() => null);
    if (label && label.includes(";")) {
      const days = label
        .split(";")
        .map(part => cleanText(part))
        .filter(part => /^(mon|tue|wed|thu|fri|sat|sun)/i.test(part));
      if (days.length) return days;
    }
  }
  // Expanded table fallback — one row per day.
  const rows = page.locator('table tr:has(td)');
  const count = Math.min(await rows.count().catch(() => 0), 7);
  const out = [];
  for (let index = 0; index < count; index++) {
    const text = cleanText(await rows.nth(index).innerText({ timeout: 2000 }).catch(() => ""));
    if (text) out.push(text.replace(/\n+/g, " "));
  }
  return out.length ? out : null;
}

/**
 * The hero photo. Google serves it as a CSS background on the header button, so
 * the URL has to come out of the inline style rather than an <img src>. The
 * "=w..-h..-k-no" suffix is a size directive — widened to something usable on a
 * listing card rather than the thumbnail Google picked for its own layout.
 */
async function scrapeHeroImage(page) {
  const button = page.locator('button[jsaction*="heroHeaderImage"], button[aria-label^="Photo"], button[aria-label^="Foto"]').first();
  if (!(await button.count())) return null;
  const style = await button.getAttribute("style").catch(() => null);
  const fromStyle = style && style.match(/url\(["']?(https:\/\/[^"')]+)["']?\)/);
  let url = fromStyle ? fromStyle[1] : null;
  if (!url) {
    const img = button.locator("img").first();
    if (await img.count()) url = await img.getAttribute("src").catch(() => null);
  }
  if (!url || !/^https:\/\//.test(url)) return null;
  return url.replace(/=w\d+-h\d+[^=]*$/, "=w800-h600-k-no");
}

async function scrapePlaceDetail(context, url) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(800 + Math.random() * 700);
    if (await looksBlocked(page)) throw new Error("blocked (unusual traffic gate)");

    const name = (await textOf(page, "h1")) ?? null;
    if (!name) return null;

    const category = await textOf(page, "button.DkEaL");

    // NOTE: this block genuinely has two meaningful lines ("4.8" then "(402)") — textOf()/
    // cleanText() would collapse it to just the last line, which is exactly why that mis-parsed
    // rating as review count further down before this fix. Read the raw multi-line text instead.
    const ratingEl = page.locator("div.F7nice").first();
    const ratingBlockText = (await ratingEl.count()) ? (await ratingEl.innerText({ timeout: 3000 }).catch(() => "")) : "";
    const ratingMatch = ratingBlockText.match(/(\d+(?:[.,]\d+)?)\s*(?:\n|$)/) || ratingBlockText.match(/(\d+(?:[.,]\d+)?)/);
    const reviewsMatch = ratingBlockText.match(/\(([\d,.]+)\)/) || ratingBlockText.match(/([\d,.]+)\s+review/i);
    const totalScore = ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null;
    const reviewsCount = reviewsMatch ? Number(reviewsMatch[1].replace(/[.,]/g, "")) : null;

    const address = await textOf(page, 'button[data-item-id="address"]');
    const phoneEl = page.locator('button[data-item-id^="phone:tel:"]').first();
    let phone = null;
    if (await phoneEl.count()) {
      phone = cleanText(await phoneEl.innerText({ timeout: 3000 }).catch(() => ""));
      if (!phone) {
        const itemId = await phoneEl.getAttribute("data-item-id").catch(() => null);
        phone = itemId ? decodeURIComponent(itemId.replace("phone:tel:", "")) : null;
      }
    }
    const websiteEl = page.locator('a[data-item-id="authority"]').first();
    const website = (await websiteEl.count()) ? await websiteEl.getAttribute("href").catch(() => null) : null;

    const openingHours = await scrapeOpeningHours(page);
    const imageUrl = await scrapeHeroImage(page);

    const finalUrl = page.url();
    return {
      title: name,
      category,
      phone,
      phoneUnformatted: phone,
      website,
      address,
      street: null,
      city: null,
      postalCode: address ? (address.match(/\b\d{4,5}\b/)?.[0] ?? null) : null,
      location: extractLatLng(finalUrl),
      totalScore,
      reviewsCount,
      placeId: extractCid(finalUrl),
      openingHours,
      imageUrl,
    };
  } catch (error) {
    log(`  detail scrape failed for ${url}: ${error.message}`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

// Website builders and error-tracking pixels leak machine-generated addresses that look like
// real emails but aren't reachable mailboxes — e.g. Wix embeds a Sentry DSN as a "mailto" on
// every site it hosts. Reject those by domain, and reject any address whose local part is a
// long hex string (a tracking/error ID, not a person typing their own address).
const BAD_EMAIL_DOMAIN = /(^|\.)(wixpress\.com|sentry\.io|schema\.org|w3\.org|godaddy\.com|google(usercontent)?\.com|gstatic\.com|cloudflare\.com|example\.com|domain\.com|yourdomain\.com|test\.com|sentry-next\.wixpress\.com)$/i;
// Template placeholder text left un-filled in a site's HTML source ("mailto:user@domain.com",
// "your@email.com") — a real business email never uses these local parts.
const PLACEHOLDER_LOCAL = /^(user|email|name|yourname|youremail|yourmail|example|test|info|placeholder|someone|address)$/i;
function isPlausibleEmail(email) {
  const at = email.lastIndexOf("@");
  if (at < 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain || BAD_EMAIL_DOMAIN.test(domain)) return false;
  if (/^[0-9a-f]{16,}$/i.test(local)) return false; // hash-like local part — a tracking id, not a mailbox
  if (PLACEHOLDER_LOCAL.test(local) && /^(domain|yourdomain|email|mail)\./i.test(domain)) return false;
  if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(domain)) return false;
  return true;
}

/** Best-effort email lookup on the business's own site — plain HTTP, no browser needed.
 * Kept to two candidate pages with a short timeout each: this runs inside a concurrency pool
 * alongside many other places, so per-place latency adds up fast across the whole batch. */
async function findEmail(website) {
  if (!website) return null;
  const candidates = [website];
  try {
    const u = new URL(website);
    candidates.push(`${u.origin}/contact`);
  } catch { /* malformed URL, just try it raw */ }

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "user-agent": UA } });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const html = await res.text();
      const mailtos = [...html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)].map(m => m[1]);
      const goodMailto = mailtos.find(isPlausibleEmail);
      if (goodMailto) return goodMailto;
      const bares = [...html.matchAll(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g)].map(m => m[0]);
      const goodBare = bares.find(isPlausibleEmail);
      if (goodBare) return goodBare;
    } catch {
      // this candidate failed — try the next one
    }
  }
  return null;
}

/** Runs `worker` over `items` with at most `concurrency` in flight at once. */
async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runNext() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

async function run() {
  await Actor.init();
  const input = (await Actor.getInput()) ?? {};
  const {
    searchStringsArray = ["massage"],
    locationQuery,
    maxCrawledPlacesPerSearch = 60,
    language = "en",
    placeMinimumStars = "",
  } = input;

  if (!locationQuery) throw new Error("locationQuery is required");
  const minStars = STAR_ENUM_TO_MIN[placeMinimumStars] ?? null;
  // Default to no Apify proxy: this account's RESIDENTIAL proxy group has zero available IPs,
  // and Google Maps navigated fine directly from Apify's own datacenter egress in testing.
  // Set useResidentialProxy:true if Google starts rate-limiting/blocking direct traffic later.
  const { useResidentialProxy = false, diagnosticOnly = false } = input;
  const noProxy = !useResidentialProxy;

  // Quick plain-HTTP egress check before ever touching a browser — isolates "no network at all"
  // from "browser/proxy handshake specifically is the problem".
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    const r = await fetch("https://www.google.com/generate_204", { signal: controller.signal });
    clearTimeout(t);
    log(`Diagnostic: plain fetch to google.com -> HTTP ${r.status}`);
  } catch (error) {
    log(`Diagnostic: plain fetch to google.com FAILED -> ${error.message}`);
  }
  if (diagnosticOnly) { await Actor.exit(); return; }

  let proxyConfiguration;
  if (!noProxy) {
    try {
      proxyConfiguration = await Actor.createProxyConfiguration({ groups: ["RESIDENTIAL"] });
    } catch {
      log("RESIDENTIAL proxy group unavailable, falling back to Apify automatic proxy");
      proxyConfiguration = await Actor.createProxyConfiguration().catch(() => undefined);
    }
  } else {
    log("noProxy=true — launching without any Apify proxy");
  }
  const proxyUrl = proxyConfiguration ? await proxyConfiguration.newUrl() : undefined;
  log(`Proxy URL in use: ${proxyUrl ? proxyUrl.replace(/:[^:@]+@/, ":***@") : "(none)"}`);

  const browser = await chromium.launch({
    headless: true,
    proxy: proxyUrl ? { server: proxyUrl } : undefined,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  let pushed = 0;
  try {
    for (const term of searchStringsArray) {
      const context = await browser.newContext({
        userAgent: UA,
        locale: language,
        viewport: { width: 1366, height: 900 },
      });
      const page = await context.newPage();
      const query = `${term} ${locationQuery}`;
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=${encodeURIComponent(language)}`;
      log(`Searching: "${query}" -> ${searchUrl}`);

      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await dismissConsent(page);
        await sleep(1500);
        if (await looksBlocked(page)) {
          log(`  BLOCKED by Google on search for "${query}" — skipping this term`);
          await context.close().catch(() => {});
          continue;
        }

        const links = await collectPlaceLinks(page, maxCrawledPlacesPerSearch);
        log(`  found ${links.length} place links for "${query}" — scraping details (concurrency ${DETAIL_CONCURRENCY})…`);

        await mapPool(links, DETAIL_CONCURRENCY, async link => {
          const item = await scrapePlaceDetail(context, link);
          if (!item) return;
          if (minStars !== null && (typeof item.totalScore !== "number" || item.totalScore < minStars)) return;

          item.emails = [];
          const email = await findEmail(item.website);
          if (email) item.emails = [email];

          await Actor.pushData(item);
          pushed++;
        });
      } catch (error) {
        log(`  search "${query}" failed: ${error.message}`);
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  log(`Done. Pushed ${pushed} items.`);
  await Actor.exit();
}

run().catch(async error => {
  console.error(error);
  await Actor.exit({ exitCode: 1 });
});
