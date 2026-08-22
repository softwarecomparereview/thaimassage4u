import { envSecret } from "./secrets";
import { cacheGet, cachePut } from "./storage";

export type YelpSignal = {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  url: string | null;
};

type YelpSearch = {
  businesses?: Array<{
    name?: string;
    rating?: number;
    review_count?: number;
    url?: string;
  }>;
};

export async function yelpSignal(env: Env, name: string, city: string): Promise<YelpSignal | null> {
  try {
    const key = envSecret(env, "YELP_API_KEY");
    if (!key) return null;
    const cacheKey = `yelp:${name}:${city}`.toLowerCase().slice(0, 180);
    const hit = await cacheGet(env, cacheKey);
    if (hit) {
      try {
        return JSON.parse(hit) as YelpSignal;
      } catch {
        /* rebuild */
      }
    }
    const url = new URL("https://api.yelp.com/v3/businesses/search");
    url.searchParams.set("term", name);
    url.searchParams.set("location", city);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { headers: { authorization: `Bearer ${key}` } });
    if (!response.ok) return null;
    const body = (await response.json()) as YelpSearch;
    const first = body.businesses?.[0];
    if (!first) return null;
    const signal: YelpSignal = {
      name: first.name ?? name,
      rating: typeof first.rating === "number" ? first.rating : null,
      reviewCount: typeof first.review_count === "number" ? first.review_count : null,
      url: first.url ?? null,
    };
    await cachePut(env, cacheKey, JSON.stringify(signal), 60 * 60 * 6);
    return signal;
  } catch {
    return null;
  }
}
