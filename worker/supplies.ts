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

const SUPPLY_COUNTRIES = new Set(["us", "au", "uk", "de"]);

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
    "SELECT category_key AS categoryKey, category_label AS categoryLabel, title, price, shipping, total, currency, free_shipping AS freeShipping, url, image, supplier, fetched_at AS fetchedAt FROM qh_supply_offers WHERE country = ? ORDER BY category_key, total LIMIT 120",
  ).bind(country).all<{ categoryKey: string; categoryLabel: string; title: string; price: number; shipping: number | null; total: number; currency: string; freeShipping: number; url: string; image: string | null; supplier: string; fetchedAt: string }>();

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
    return Response.json(await syncSupplyOffers(env));
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
