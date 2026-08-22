import { slugify } from "./lib/escape";
import { getCity, listCities, type City } from "./lib/db";
import type { LeadMessage } from "./lib/messages";
import { cacheDelete } from "./lib/storage";

export type { LeadMessage };

const ALLOWED_HOSTS = new Set(["www.openstreetmap.org", "openstreetmap.org", "en.wikipedia.org"]);

type ScrapeElement = {
  selector: string;
  results?: Array<{ text?: string; html?: string; attributes?: Array<{ name: string; value: string }> }>;
};

function assertAllowed(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only HTTPS scrape targets are allowed");
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error(`Host not allowlisted: ${url.hostname}`);
  return url;
}

async function assertBrowserOk(action: string, response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`Browser Run ${action} failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export function parseOsmNames(payload: unknown): string[] {
  const envelope = payload as { success?: boolean; result?: ScrapeElement[] };
  const groups = Array.isArray(envelope) ? (envelope as ScrapeElement[]) : envelope.result ?? [];
  const names = new Set<string>();
  for (const group of groups) {
    for (const item of group.results ?? []) {
      const text = (item.text ?? "").replaceAll(/\s+/g, " ").trim();
      if (text.length < 4 || text.length > 80) continue;
      if (!/thai|massage|spa|sala|nuru/i.test(text)) continue;
      if (/search|openstreetmap|nominatim|results/i.test(text)) continue;
      names.add(text);
    }
  }
  return [...names].slice(0, 20);
}

export function wikiIntroFromMarkdown(markdown: string, cityName: string): string | null {
  const cleaned = markdown
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replaceAll(/[#*_`]/g, "")
    .replaceAll(/\n+/g, " ")
    .trim();
  if (cleaned.length < 80) return null;
  const sentence = cleaned.split(/(?<=\.)\s+/).slice(0, 3).join(" ");
  if (!sentence.toLowerCase().includes(cityName.toLowerCase().slice(0, 4))) {
    return `${cityName} overview for local Thai massage landing pages. ${sentence}`.slice(0, 480);
  }
  return sentence.slice(0, 480);
}

export function osmSearchUrl(cityName: string): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(`Thai massage ${cityName}`)}`;
}

export function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
}

export async function scrapeCityDirectory(env: Env, countryCode: string, citySlug: string): Promise<{ names: number; wiki: boolean }> {
  const city = await getCity(env.DB, countryCode, citySlug);
  if (!city) throw new Error(`Unknown city ${countryCode}/${citySlug}`);

  const jobId = crypto.randomUUID();
  const target = osmSearchUrl(city.name);
  await env.DB.prepare(
    "INSERT INTO scrape_jobs (id, country_code, city_slug, source, url, status) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(jobId, countryCode, citySlug, "openstreetmap", target, "running")
    .run();

  try {
    const osmUrl = assertAllowed(target);
    const scraped = await assertBrowserOk(
      "scrape",
      await env.BROWSER.quickAction("scrape", {
        url: osmUrl.toString(),
        elements: [{ selector: ".search_results_entry" }, { selector: "li" }, { selector: ".name" }],
        gotoOptions: { waitUntil: "domcontentloaded", timeout: 25000 },
      })
    );
    const names = parseOsmNames(scraped);
    let inserted = 0;

    for (const name of names) {
      const slug = `${slugify(name)}-${city.slug}`.slice(0, 80);
      const description = `${name} was discovered from a public OpenStreetMap search for “Thai massage ${city.name}”. Address and phone are unconfirmed until the owner claims this listing. Map data © OpenStreetMap contributors (ODbL).`;
      const result = await env.DB.prepare(
        `INSERT OR IGNORE INTO listings
          (slug, name, country_code, city_slug, suburb, services, description, currency, premium, claimed, hours, image_url, source, source_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Hours unconfirmed', '/images/suburb.svg', 'openstreetmap', ?)`
      )
        .bind(
          slug,
          name.slice(0, 80),
          countryCode,
          citySlug,
          city.name,
          "Traditional Thai",
          description,
          countryCode === "us" ? "USD" : countryCode === "uk" ? "GBP" : countryCode === "de" ? "EUR" : "AUD",
          osmUrl.toString()
        )
        .run();
      if (result.meta.changes) inserted += 1;
    }

    let wikiUpdated = false;
    if (city.wiki_title) {
      const page = assertAllowed(wikiUrl(city.wiki_title));
      const markdownPayload = (await assertBrowserOk(
        "markdown",
        await env.BROWSER.quickAction("markdown", {
          url: page.toString(),
          gotoOptions: { waitUntil: "domcontentloaded", timeout: 25000 },
        })
      )) as { result?: string; success?: boolean };
      const markdown = typeof markdownPayload.result === "string" ? markdownPayload.result : "";
      const intro = wikiIntroFromMarkdown(markdown, city.name);
      if (intro) {
        await env.DB.prepare("UPDATE cities SET intro = ? WHERE id = ?").bind(intro, city.id).run();
        wikiUpdated = true;
      }
    }

    await env.DB.prepare(
      "UPDATE scrape_jobs SET status = ?, listings_found = ?, finished_at = datetime('now') WHERE id = ?"
    )
      .bind("done", inserted, jobId)
      .run();

    await cacheDelete(env, `page:/${countryCode}`, `page:/${countryCode}/${citySlug}`, "page:/", "sitemap");

    return { names: inserted, wiki: wikiUpdated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "scrape failed";
    await env.DB.prepare(
      "UPDATE scrape_jobs SET status = ?, error = ?, finished_at = datetime('now') WHERE id = ?"
    )
      .bind("error", message.slice(0, 400), jobId)
      .run();
    throw error;
  }
}

export async function enqueueCityScrapes(env: Env): Promise<number> {
  const cities = await listCities(env.DB);
  let queued = 0;
  for (const city of cities) {
    await env.LEADS.send({ kind: "scrape-city", countryCode: city.country_code, citySlug: city.slug } satisfies LeadMessage);
    queued += 1;
  }
  return queued;
}

export function cityTargets(cities: City[]) {
  return cities.map((city) => ({
    countryCode: city.country_code,
    citySlug: city.slug,
    osm: osmSearchUrl(city.name),
    wiki: city.wiki_title ? wikiUrl(city.wiki_title) : null,
  }));
}
