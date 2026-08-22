// Public read-only JSON API for the native apps (Android first, iOS later — both
// share this same endpoint set). Mounted at /api/v1 in src/index.ts. Same D1 data
// the website reads, so the app updates automatically whenever the site's data
// changes — no app-store release needed for content changes, just for app-code
// changes.
import { Hono } from "hono";
import {
  countListings,
  featuredListings,
  getCity,
  getCountry,
  getListing,
  listCities,
  listCountries,
  listListings,
  searchListings,
  type City,
  type Country,
  type Listing,
} from "./lib/db";
import { listingPhoto, cityPhoto, countryPhoto } from "./lib/photos";

type AppEnv = { Bindings: Env };

function serializeListing(env: Env, listing: Listing) {
  return {
    slug: listing.slug,
    name: listing.name,
    countryCode: listing.country_code,
    citySlug: listing.city_slug,
    suburb: listing.suburb,
    address: listing.address,
    phone: listing.phone,
    email: listing.email,
    website: listing.website,
    services: listing.services.split(",").map((s) => s.trim()).filter(Boolean),
    description: listing.description,
    priceFrom: listing.price_from,
    currency: listing.currency,
    premium: listing.premium,
    claimed: Boolean(listing.claimed),
    hours: listing.hours,
    imageUrl: absoluteImage(env, listingPhoto(listing)),
    source: listing.source,
    rating: listing.rating ?? null,
    reviewCount: listing.review_count ?? null,
    mapsUrl: listing.maps_url ?? null,
    freshaUrl: listing.fresha_url ?? null,
  };
}

function absoluteImage(env: Env, path: string): string {
  return path.startsWith("http") ? path : `${env.SITE_URL}${path}`;
}

function serializeCountry(country: Country, listingCount: number) {
  return {
    code: country.code,
    name: country.name,
    slug: country.slug,
    flag: country.flag,
    tagline: country.tagline,
    currency: country.currency,
    listingCount,
  };
}

function serializeCity(env: Env, city: City) {
  return {
    countryCode: city.country_code,
    slug: city.slug,
    name: city.name,
    region: city.region,
    intro: city.intro,
    imageUrl: absoluteImage(env, cityPhoto(city.country_code, city.slug)),
  };
}

export function apiApp() {
  const api = new Hono<AppEnv>();

  api.use("*", async (c, next) => {
    await next();
    c.res.headers.set("access-control-allow-origin", "*");
    c.res.headers.set("cache-control", "public, max-age=60");
  });

  api.get("/countries", async (c) => {
    const countries = await listCountries(c.env.DB);
    const withCounts = await Promise.all(
      countries.map(async (country) => ({
        ...serializeCountry(country, await countListings(c.env.DB, country.code)),
        imageUrl: absoluteImage(c.env, countryPhoto(country.code)),
      }))
    );
    return c.json({ countries: withCounts });
  });

  api.get("/countries/:code", async (c) => {
    const country = await getCountry(c.env.DB, c.req.param("code").toLowerCase());
    if (!country) return c.json({ error: "not_found" }, 404);
    const count = await countListings(c.env.DB, country.code);
    return c.json({ country: { ...serializeCountry(country, count), imageUrl: absoluteImage(c.env, countryPhoto(country.code)) } });
  });

  api.get("/countries/:code/cities", async (c) => {
    const code = c.req.param("code").toLowerCase();
    const country = await getCountry(c.env.DB, code);
    if (!country) return c.json({ error: "not_found" }, 404);
    const cities = await listCities(c.env.DB, code);
    return c.json({ cities: cities.map((city) => serializeCity(c.env, city)) });
  });

  api.get("/cities/:country/:city", async (c) => {
    const city = await getCity(c.env.DB, c.req.param("country").toLowerCase(), c.req.param("city"));
    if (!city) return c.json({ error: "not_found" }, 404);
    return c.json({ city: serializeCity(c.env, city) });
  });

  api.get("/cities/:country/:city/listings", async (c) => {
    const countryCode = c.req.param("country").toLowerCase();
    const citySlug = c.req.param("city");
    const city = await getCity(c.env.DB, countryCode, citySlug);
    if (!city) return c.json({ error: "not_found" }, 404);
    const listings = await listListings(c.env.DB, countryCode, citySlug);
    return c.json({ city: serializeCity(c.env, city), listings: listings.map((l) => serializeListing(c.env, l)) });
  });

  api.get("/listings/featured", async (c) => {
    const listings = await featuredListings(c.env.DB);
    return c.json({ listings: listings.map((l) => serializeListing(c.env, l)) });
  });

  api.get("/listings/:slug", async (c) => {
    const listing = await getListing(c.env.DB, c.req.param("slug"));
    if (!listing) return c.json({ error: "not_found" }, 404);
    return c.json({ listing: serializeListing(c.env, listing) });
  });

  api.get("/search", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json({ listings: [] });
    const listings = await searchListings(c.env.DB, q);
    return c.json({ listings: listings.map((l) => serializeListing(c.env, l)) });
  });

  return api;
}
