import type { Env } from "./index";

/**
 * Supplies for listed businesses: "today's best & cheapest, delivered to your
 * country" across the consumables a massage studio re-buys.
 *
 * Data flow: the private Apify actor `quiet-hour-supply-scanner` scans each
 * country's own eBay site cheapest-first (delivery included). The Worker's
 * daily cron calls syncSupplyOffers(): pull the latest successful run's
 * dataset into qh_supply_offers (wholesale replace per country+category so
 * nothing stale survives), then kick off a fresh actor run for tomorrow's
 * sync — a self-sustaining daily loop with no scheduler on the Apify side.
 *
 * Monetization: outbound AliExpress "compare" links are wrapped in an Awin
 * deeplink for countries the owner's Awin programme pays on (AliExpress FR,
 * advertiser 26009 — pays on FR/DE/NL/BE domains, so DE today). Awin
 * publisher/advertiser ids are public in every affiliate URL by design —
 * they are not secrets. eBay links are left bare until an eBay Partner
 * Network account exists.
 */

const SUPPLY_ACTOR_ID = "89nw2kX8J6buTllaK";
const AWIN_PUBLISHER_ID = "2850613";
const AWIN_ALIEXPRESS_ADVERTISER_ID = "26009";
/** Countries the joined Awin AliExpress programme actually pays commission on. */
const AWIN_PAYING_COUNTRIES = new Set(["de"]);

/** Wave 1 + wave 2 markets. ship_to + currency drive the AliExpress affiliate queries. */
const SUPPLY_COUNTRIES = new Set(["us", "au", "uk", "de", "ca", "nz", "ie", "ae"]);
const COUNTRY_CURRENCY: Record<string, string> = { us: "USD", au: "AUD", uk: "GBP", de: "EUR", ca: "CAD", nz: "NZD", ie: "EUR", ae: "AED" };
const COUNTRY_SHIP_TO: Record<string, string> = { us: "US", au: "AU", uk: "GB", de: "DE", ca: "CA", nz: "NZ", ie: "IE", ae: "AE" };

/** Mirrors the scanner's categories — used for the AliExpress compare links. */
const ALIEXPRESS_COMPARE: Array<{ key: string; label: string; query: Record<string, string> }> = [
  { key: "sheets", label: "Massage table sheets & covers", query: { en: "massage table sheet", de: "massageliege bezug" } },
  { key: "oil", label: "Massage oil (bulk)", query: { en: "massage oil bulk", de: "massageöl" } },
  { key: "towels", label: "Towels (bulk)", query: { en: "salon towels white", de: "salon handtücher weiß" } },
  { key: "face-cradle", label: "Face cradle covers", query: { en: "face cradle cover massage", de: "nasenschlitztücher" } },
  { key: "massage-gun", label: "Massage guns", query: { en: "massage gun", de: "massagepistole" } },
  { key: "hot-stones", label: "Hot stone sets", query: { en: "hot stone massage set", de: "hot stone set" } },
];

function aliexpressCompareUrl(country: string, key: string): string | null {
  const category = ALIEXPRESS_COMPARE.find(c => c.key === key);
  if (!category) return null;
  const lang = country === "de" ? "de" : "en";
  const destination = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(category.query[lang])}`;
  if (AWIN_PAYING_COUNTRIES.has(country)) {
    return `https://www.awin1.com/cread.php?awinmid=${AWIN_ALIEXPRESS_ADVERTISER_ID}&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(destination)}`;
  }
  return destination;
}

type ScannerOffer = {
  country: string;
  categoryKey: string;
  categoryLabel: string;
  title: string;
  price: number;
  shipping: number | null;
  total: number;
  currency: string;
  freeShipping: boolean;
  url: string;
  image: string | null;
  supplier: string;
};

async function apifyFetch(env: Env, path: string) {
  const response = await fetch(`https://api.apify.com/v2${path}`, { headers: { authorization: `Bearer ${env.APIFY_TOKEN}` } });
  if (!response.ok) throw new Error(`Apify ${path} → HTTP ${response.status}`);
  return response.json();
}

/* ---------------- AliExpress Affiliates API (primary offer source) ----------------
 * Official signed API (verified live): every product_detail_url it returns carries the
 * owner's affiliate tracking, so a purchase through any card on /supplies earns
 * commission. 6 categories x 8 countries = 48 calls per daily refresh — far inside limits. */

async function signAliExpress(params: Record<string, string>, secret: string): Promise<string> {
  const base = Object.keys(params).sort().map(key => key + params[key]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

type AliProduct = { product_title?: string; target_sale_price?: string; target_sale_price_currency?: string; product_detail_url?: string; product_main_image_url?: string };

async function queryAliExpress(env: Env, country: string, keywords: string): Promise<AliProduct[]> {
  if (!env.ALIEXPRESS_APP_KEY || !env.ALIEXPRESS_APP_SECRET || !env.ALIEXPRESS_TRACKING_ID) return [];
  const params: Record<string, string> = {
    method: "aliexpress.affiliate.product.query",
    app_key: env.ALIEXPRESS_APP_KEY,
    timestamp: String(Date.now()),
    sign_method: "sha256",
    keywords,
    target_currency: COUNTRY_CURRENCY[country],
    target_language: "EN",
    tracking_id: env.ALIEXPRESS_TRACKING_ID,
    ship_to_country: COUNTRY_SHIP_TO[country],
    page_size: "20",
    sort: "SALE_PRICE_ASC",
  };
  params.sign = await signAliExpress(params, env.ALIEXPRESS_APP_SECRET);
  const response = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { aliexpress_affiliate_product_query_response?: { resp_result?: { result?: { products?: { product?: AliProduct[] } } } } };
  return payload.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
}

/** Cheapest-first surfaces samples/spares; hold a floor per category, mirror of the eBay scanner's bar. */
const ALIEXPRESS_MIN_PRICE: Record<string, number> = { sheets: 6, oil: 8, towels: 10, "face-cradle": 5, "massage-gun": 15, "hot-stones": 10 };

export async function refreshAliExpressOffers(env: Env, countries?: string[]): Promise<{ imported: number }> {
  const targets = (countries ?? [...SUPPLY_COUNTRIES]).filter(country => SUPPLY_COUNTRIES.has(country));
  let imported = 0;
  for (const country of targets) {
    for (const category of ALIEXPRESS_COMPARE) {
      let products: AliProduct[] = [];
      try {
        products = await queryAliExpress(env, country, category.query.en);
      } catch { continue; }
      const minPrice = ALIEXPRESS_MIN_PRICE[category.key] ?? 0;
      const offers = products
        .map(product => ({ title: (product.product_title ?? "").trim(), price: Number(product.target_sale_price), url: product.product_detail_url ?? "", image: product.product_main_image_url ?? null }))
        .filter(offer => offer.title && offer.url && Number.isFinite(offer.price) && offer.price >= minPrice)
        .slice(0, 6);
      if (!offers.length) continue;
      const statements = [env.DB.prepare("DELETE FROM qh_supply_offers WHERE country = ? AND category_key = ? AND supplier = 'aliexpress'").bind(country, category.key)];
      for (const offer of offers) {
        statements.push(
          env.DB.prepare("INSERT INTO qh_supply_offers (country, category_key, category_label, title, price, shipping, total, currency, free_shipping, url, image, supplier) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?, 'aliexpress')")
            .bind(country, category.key, category.label, offer.title.slice(0, 160), offer.price, offer.price, COUNTRY_CURRENCY[country], offer.url, offer.image),
        );
      }
      await env.DB.batch(statements);
      imported += offers.length;
    }
  }
  return { imported };
}

/** Pull the newest successful scan into D1, then start the next scan for tomorrow. */
export async function syncSupplyOffers(env: Env): Promise<{ imported: number; startedNextRun: boolean }> {
  if (!env.APIFY_TOKEN) return { imported: 0, startedNextRun: false };

  const runs = (await apifyFetch(env, `/acts/${SUPPLY_ACTOR_ID}/runs?desc=1&limit=10`)) as { data: { items: Array<{ id: string; status: string; defaultDatasetId: string }> } };
  const lastGood = runs.data.items.find(run => run.status === "SUCCEEDED");
  let imported = 0;

  if (lastGood) {
    const items = (await (await fetch(`https://api.apify.com/v2/datasets/${lastGood.defaultDatasetId}/items?limit=1000`, { headers: { authorization: `Bearer ${env.APIFY_TOKEN}` } })).json()) as ScannerOffer[];
    const valid = items.filter(item => SUPPLY_COUNTRIES.has(item.country) && item.title && item.url && Number.isFinite(item.total));
    if (valid.length) {
      // Wholesale-replace only the country+category pairs this run actually produced —
      // a partially-blocked scan must not wipe categories that still hold usable data.
      const touched = [...new Set(valid.map(item => `${item.country}::${item.categoryKey}`))];
      const statements = touched.map(pair => {
        const [country, categoryKey] = pair.split("::");
        return env.DB.prepare("DELETE FROM qh_supply_offers WHERE country = ? AND category_key = ?").bind(country, categoryKey);
      });
      for (const item of valid) {
        statements.push(
          env.DB.prepare("INSERT INTO qh_supply_offers (country, category_key, category_label, title, price, shipping, total, currency, free_shipping, url, image, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(item.country, item.categoryKey, item.categoryLabel, item.title, item.price, item.shipping, item.total, item.currency, item.freeShipping ? 1 : 0, item.url, item.image, item.supplier),
        );
      }
      for (let i = 0; i < statements.length; i += 50) await env.DB.batch(statements.slice(i, i + 50));
      imported = valid.length;
    }
  }

  let startedNextRun = false;
  try {
    await fetch(`https://api.apify.com/v2/acts/${SUPPLY_ACTOR_ID}/runs`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.APIFY_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ countries: ["us", "au", "uk", "de"], maxPerCategory: 6 }),
    });
    startedNextRun = true;
  } catch {
    // Next sync will still import whatever the last successful run held.
  }
  return { imported, startedNextRun };
}

export async function handleSupplies(request: Request, env: Env) {
  const url = new URL(request.url);
  const country = (url.searchParams.get("country") ?? "au").toLowerCase();
  if (!SUPPLY_COUNTRIES.has(country)) return Response.json({ error: "Unknown country." }, { status: 400 });

  const { results } = await env.DB.prepare(
    "SELECT id, category_key AS categoryKey, category_label AS categoryLabel, title, price, shipping, total, currency, free_shipping AS freeShipping, url, image, supplier, fetched_at AS fetchedAt FROM qh_supply_offers WHERE country = ? ORDER BY category_key, total LIMIT 120",
  ).bind(country).all<{ id: number; categoryKey: string; categoryLabel: string; title: string; price: number; shipping: number | null; total: number; currency: string; freeShipping: number; url: string; image: string | null; supplier: string; fetchedAt: string }>();

  const categories: Record<string, { key: string; label: string; compareUrl: string | null; offers: unknown[] }> = {};
  for (const { key, label } of ALIEXPRESS_COMPARE) {
    categories[key] = { key, label, compareUrl: aliexpressCompareUrl(country, key), offers: [] };
  }
  for (const row of results) {
    (categories[row.categoryKey] ??= { key: row.categoryKey, label: row.categoryLabel, compareUrl: aliexpressCompareUrl(country, row.categoryKey), offers: [] }).offers.push({ ...row, freeShipping: Boolean(row.freeShipping) });
  }
  const updatedAt = results[0]?.fetchedAt ?? null;
  return Response.json({ country, updatedAt, categories: Object.values(categories) });
}

export async function handleSuppliesSync(env: Env) {
  try {
    const aliexpress = await refreshAliExpressOffers(env);
    const ebay = await syncSupplyOffers(env).catch(error => ({ imported: 0, startedNextRun: false, error: String(error) }));
    return Response.json({ aliexpress, ebay });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}

/** Tracked outbound redirect: /api/supplies/go?id=N → record click → 302 to the stored URL.
 * Redirecting only to URLs already in qh_supply_offers keeps this from being an open redirect. */
export async function handleSupplyClick(request: Request, env: Env) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new Response("Bad offer id", { status: 400 });
  const offer = await env.DB.prepare("SELECT id, country, category_key, supplier, title, url FROM qh_supply_offers WHERE id = ? LIMIT 1").bind(id)
    .first<{ id: number; country: string; category_key: string; supplier: string; title: string; url: string }>();
  if (!offer) return new Response("Offer not found", { status: 404 });
  await env.DB.prepare("INSERT INTO qh_supply_clicks (offer_id, country, category_key, supplier, title, url) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(offer.id, offer.country, offer.category_key, offer.supplier, offer.title, offer.url).run();
  env.ANALYTICS?.writeDataPoint({ blobs: ["supply_click", offer.country, offer.category_key, offer.supplier], doubles: [1], indexes: [offer.category_key] });
  return Response.redirect(offer.url, 302);
}

/** Admin: click totals for the CMS — which categories/offers are actually being watched. */
export async function handleSupplyClickStats(env: Env) {
  const [byCategory, topOffers, last7] = await Promise.all([
    env.DB.prepare("SELECT country, category_key AS categoryKey, supplier, COUNT(*) AS clicks FROM qh_supply_clicks GROUP BY country, category_key, supplier ORDER BY clicks DESC LIMIT 40").all(),
    env.DB.prepare("SELECT title, country, supplier, COUNT(*) AS clicks FROM qh_supply_clicks GROUP BY url ORDER BY clicks DESC LIMIT 15").all(),
    env.DB.prepare("SELECT DATE(clicked_at) AS day, COUNT(*) AS clicks FROM qh_supply_clicks WHERE clicked_at >= DATETIME('now', '-7 days') GROUP BY day ORDER BY day").all(),
  ]);
  return Response.json({ byCategory: byCategory.results, topOffers: topOffers.results, last7: last7.results });
}
