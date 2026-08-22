import { getCity, listCities, type City } from "./db";
import { envSecret } from "./secrets";

export type PeopleAlsoAsk = { question: string; answer: string };
export type SerpPlan = {
  query: string;
  title: string;
  h1: string;
  description: string;
  related: string[];
  peopleAlsoAsk: PeopleAlsoAsk[];
  organicTitles: string[];
  capturedAt: string;
};

type SerpPayload = {
  search_parameters?: { q?: string };
  related_searches?: Array<{ query?: string }>;
  people_also_ask?: Array<{ question?: string; snippet?: string; title?: string }>;
  organic_results?: Array<{ title?: string }>;
};

const DEFAULT_QUERY = (city: string) => `thai massage ${city}`;

export function winningQuery(cityName: string, related: string[], organicTitles: string[]): string {
  const haystack = [...related, ...organicTitles].map((item) => item.toLowerCase());
  const candidates = [
    `best thai massage in ${cityName}`,
    `best thai massage ${cityName}`,
    `traditional thai massage ${cityName}`,
    `thai massage near me ${cityName}`,
    `thai massage ${cityName}`,
  ];
  for (const candidate of candidates) {
    if (haystack.some((row) => row.includes(candidate) || candidate.includes(row))) return candidate;
  }
  return DEFAULT_QUERY(cityName);
}

export function buildSerpPlan(cityName: string, countryName: string, payload: unknown, capturedAt = new Date().toISOString()): SerpPlan {
  const body = payload as SerpPayload;
  const related = (body.related_searches ?? [])
    .map((row) => row.query?.trim())
    .filter((row): row is string => Boolean(row))
    .slice(0, 8);
  const peopleAlsoAsk = (body.people_also_ask ?? [])
    .map((row) => ({
      question: (row.question ?? row.title ?? "").trim(),
      answer: (row.snippet ?? "").trim(),
    }))
    .filter((row) => row.question.length > 8)
    .slice(0, 6);
  const organicTitles = (body.organic_results ?? [])
    .map((row) => row.title?.trim())
    .filter((row): row is string => Boolean(row))
    .slice(0, 8);
  const query = winningQuery(cityName, related, organicTitles);
  const pretty = query.replace(/\b\w/g, (char) => char.toUpperCase());
  const h1 = pretty.includes(cityName) ? pretty : `Thai massage in ${cityName}, ${countryName}`;
  const extra = related.slice(0, 2).join(", ");
  return {
    query,
    title: `${h1} | Studios & Spas`,
    h1,
    description: extra
      ? `Compare Thai massage in ${cityName}. Today's SERP also shows demand for ${extra}.`
      : `Compare Thai massage studios in ${cityName}, ${countryName}.`,
    related,
    peopleAlsoAsk,
    organicTitles,
    capturedAt,
  };
}

export async function fetchSerpPayload(env: Env, city: City): Promise<unknown> {
  const key = envSecret(env, "SERPAPI_KEY");
  if (!key) throw new Error("SERPAPI_KEY is not set");
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", DEFAULT_QUERY(city.name));
  url.searchParams.set("hl", city.country_code === "de" ? "de" : "en");
  url.searchParams.set("gl", city.country_code === "uk" ? "gb" : city.country_code);
  url.searchParams.set("location", city.name);
  url.searchParams.set("num", "10");
  url.searchParams.set("api_key", key);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`SerpAPI failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  return response.json();
}

export async function saveSerpPlan(env: Env, city: City, countryName: string, payload: unknown): Promise<SerpPlan> {
  const plan = buildSerpPlan(city.name, countryName, payload);
  await env.DB.prepare(
    `INSERT INTO serp_snapshots
      (id, country_code, city_slug, query, title, h1, description, related_json, paa_json, organic_json, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      city.country_code,
      city.slug,
      plan.query,
      plan.title,
      plan.h1,
      plan.description,
      JSON.stringify(plan.related),
      JSON.stringify(plan.peopleAlsoAsk),
      JSON.stringify(plan.organicTitles),
      JSON.stringify(payload).slice(0, 80_000)
    )
    .run();

  const volume = Math.max(city.monthly_searches, 100);
  for (const [index, keyword] of [plan.query, ...plan.related].slice(0, 6).entries()) {
    await env.DB.prepare(
      `INSERT INTO keyword_stats (country_code, city_slug, keyword, monthly_searches, source)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(city.country_code, city.slug, keyword, Math.max(40, Math.round(volume / (index + 1))), "serpapi daily")
      .run();
  }

  await env.CACHE.delete(`page:/${city.country_code}`);
  await env.CACHE.delete(`page:/${city.country_code}/${city.slug}`);
  await env.CACHE.delete("page:/");
  return plan;
}

export async function latestSerpPlan(db: D1Database, countryCode: string, citySlug: string): Promise<SerpPlan | null> {
  const row = await db
    .prepare(
      `SELECT query, title, h1, description, related_json, paa_json, organic_json, captured_at
       FROM serp_snapshots
       WHERE country_code = ? AND city_slug = ?
       ORDER BY captured_at DESC LIMIT 1`
    )
    .bind(countryCode, citySlug)
    .first<{
      query: string;
      title: string | null;
      h1: string | null;
      description: string | null;
      related_json: string;
      paa_json: string;
      organic_json: string;
      captured_at: string;
    }>();
  if (!row) return null;
  return {
    query: row.query,
    title: row.title ?? row.query,
    h1: row.h1 ?? row.query,
    description: row.description ?? "",
    related: JSON.parse(row.related_json) as string[],
    peopleAlsoAsk: JSON.parse(row.paa_json) as PeopleAlsoAsk[],
    organicTitles: JSON.parse(row.organic_json) as string[],
    capturedAt: row.captured_at,
  };
}

export async function refreshCitySerp(env: Env, countryCode: string, citySlug: string): Promise<SerpPlan> {
  const city = await getCity(env.DB, countryCode, citySlug);
  if (!city) throw new Error(`Unknown city ${countryCode}/${citySlug}`);
  const country = await env.DB.prepare("SELECT name FROM countries WHERE code = ?").bind(countryCode).first<{ name: string }>();
  const payload = await fetchSerpPayload(env, city);
  return saveSerpPlan(env, city, country?.name ?? countryCode, payload);
}

export async function enqueueDailySerp(env: Env): Promise<number> {
  const cities = await listCities(env.DB);
  let queued = 0;
  for (const city of cities) {
    await env.LEADS.send({ kind: "serp-city", countryCode: city.country_code, citySlug: city.slug });
    queued += 1;
  }
  return queued;
}
