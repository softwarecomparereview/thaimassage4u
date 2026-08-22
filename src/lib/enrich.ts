import { getCity, getListing, listCities } from "./db";
import { searchPlaces, upsertPlaces } from "./places";
import { thumbnailListing } from "./thumbnails";

export async function enrichCityFromPlaces(env: Env, countryCode: string, citySlug: string): Promise<{ places: number; thumbs: number }> {
  const city = await getCity(env.DB, countryCode, citySlug);
  if (!city) throw new Error(`Unknown city ${countryCode}/${citySlug}`);

  const jobId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO scrape_jobs (id, country_code, city_slug, source, url, status) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(jobId, countryCode, citySlug, "places", `places:searchText:${city.name}`, "running")
    .run();

  try {
    const places = await searchPlaces(env, city.name);
    const slugs = await upsertPlaces(env, city, places);
    let thumbs = 0;
    for (const slug of slugs) {
      const listing = await getListing(env.DB, slug);
      if (!listing) continue;
      const path = await thumbnailListing(env, listing);
      if (path) thumbs += 1;
    }
    await env.DB.prepare(
      "UPDATE scrape_jobs SET status = ?, listings_found = ?, finished_at = datetime('now') WHERE id = ?"
    )
      .bind("done", slugs.length, jobId)
      .run();
    await env.CACHE.delete(`page:/${countryCode}`);
    await env.CACHE.delete(`page:/${countryCode}/${citySlug}`);
    await env.CACHE.delete("page:/");
    await env.CACHE.delete("sitemap");
    return { places: slugs.length, thumbs };
  } catch (error) {
    const message = error instanceof Error ? error.message : "enrich failed";
    await env.DB.prepare(
      "UPDATE scrape_jobs SET status = ?, error = ?, finished_at = datetime('now') WHERE id = ?"
    )
      .bind("error", message.slice(0, 400), jobId)
      .run();
    throw error;
  }
}

export async function enqueueCityEnrichment(env: Env): Promise<number> {
  const cities = await listCities(env.DB);
  let queued = 0;
  for (const city of cities) {
    await env.LEADS.send({ kind: "enrich-city", countryCode: city.country_code, citySlug: city.slug });
    queued += 1;
  }
  return queued;
}
