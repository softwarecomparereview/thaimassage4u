import type { Env } from "./index";
import { COUNTRY_NAMES, isDirectoryCountry } from "./geo";

type LegacyCity = {
  id: number;
  country_code: string;
  slug: string;
  name: string;
  intro: string;
};

type LegacyListing = {
  id: number;
  slug: string;
  name: string;
  country_code: string;
  city_slug: string;
  suburb: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  services: string;
  description: string;
  price_from: number | null;
  image_url: string | null;
};

const category = { id: 1, name: "Massage & wellness", slug: "massage-wellness" };

function parseServices(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item, index) => ({ id: index + 1, title: typeof item === "string" ? item : item?.name ?? "Wellness session", durationMinutes: null, priceFromCents: null, description: "" }));
  } catch {
    // The legacy data also contains plain-text service lists.
  }
  return raw
    .split(/[,|/]/)
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((title, index) => ({ id: index + 1, title, durationMinutes: null, priceFromCents: null, description: "" }));
}

function toPlaceCard(row: LegacyListing, cityName?: string) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    descriptor: "Independently listed wellness place",
    neighbourhood: row.suburb,
    imageUrl: row.image_url,
    isFeatured: false,
    cityName: cityName ?? row.city_slug,
    citySlug: row.city_slug,
    countryCode: row.country_code,
    categoryName: category.name,
    categorySlug: category.slug,
  };
}

export async function getDirectoryHome(env: Env) {
  try {
    const [cities, listings, articles] = await Promise.all([
      env.DB.prepare("SELECT id, country_code, slug, name, intro FROM cities ORDER BY name LIMIT 250").all<LegacyCity>(),
      env.DB.prepare("SELECT id, slug, name, country_code, city_slug, suburb, address, email, website, services, description, price_from, image_url FROM listings ORDER BY premium DESC, created_at DESC LIMIT 180").all<LegacyListing>(),
      env.DB.prepare("SELECT id, title, slug, excerpt, body, topic, cover_image_url AS coverImageUrl, status, published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt FROM qh_articles WHERE status IN ('review', 'published') ORDER BY created_at DESC").all(),
    ]);
    const cityNames = new Map(cities.results.map(city => [city.slug, city.name]));
    return {
      listings: listings.results.map(row => toPlaceCard(row, cityNames.get(row.city_slug))),
      articles: articles.results,
      cities: cities.results.map(city => ({ id: city.id, name: city.name, slug: city.slug, country: city.country_code, countryCode: city.country_code, primaryLocale: "en", introduction: city.intro, isActive: true })),
      categories: [category],
      premiumListings: [],
      verifiedEvents: [],
      cityMetrics: [],
    };
  } catch (error) {
    console.warn("[Worker directory] Legacy records are unavailable in this environment", error);
    const articles = await env.DB.prepare("SELECT id, title, slug, excerpt, body, topic, cover_image_url AS coverImageUrl, status, published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt FROM qh_articles WHERE status IN ('review', 'published') ORDER BY created_at DESC").all();
    return { listings: [], articles: articles.results, cities: [], categories: [category], premiumListings: [], verifiedEvents: [], cityMetrics: [] };
  }
}

export async function getCityGuide(env: Env, slug: string) {
  try {
    const city = await env.DB.prepare("SELECT id, country_code, slug, name, intro FROM cities WHERE slug = ? LIMIT 1").bind(slug).first<LegacyCity>();
    if (!city) return null;
    const listings = await env.DB.prepare("SELECT id, slug, name, country_code, city_slug, suburb, address, email, website, services, description, price_from, image_url FROM listings WHERE city_slug = ? ORDER BY premium DESC, created_at DESC LIMIT 100").bind(slug).all<LegacyListing>();
    return { city: { id: city.id, name: city.name, slug: city.slug, country: city.country_code, countryCode: city.country_code, primaryLocale: "en", introduction: city.intro, isActive: true }, listings: listings.results.map(row => toPlaceCard(row, city.name)), events: [], metrics: [] };
  } catch {
    return null;
  }
}

export async function getCountryGuide(env: Env, code: string) {
  if (!isDirectoryCountry(code)) return null;
  try {
    const [cities, listings] = await Promise.all([
      env.DB.prepare("SELECT id, country_code, slug, name, intro FROM cities WHERE country_code = ? ORDER BY name").bind(code).all<LegacyCity>(),
      env.DB.prepare("SELECT id, slug, name, country_code, city_slug, suburb, address, email, website, services, description, price_from, image_url FROM listings WHERE country_code = ? ORDER BY premium DESC, created_at DESC").bind(code).all<LegacyListing>(),
    ]);
    if (!cities.results.length && !listings.results.length) return null;
    const cityNames = new Map(cities.results.map(city => [city.slug, city.name]));
    return {
      country: { code, name: COUNTRY_NAMES[code] ?? code.toUpperCase(), listingCount: listings.results.length },
      cities: cities.results.map(city => ({ id: city.id, name: city.name, slug: city.slug, country: city.country_code, countryCode: city.country_code, primaryLocale: "en", introduction: city.intro, isActive: true })),
      listings: listings.results.map(row => toPlaceCard(row, cityNames.get(row.city_slug))),
    };
  } catch {
    return null;
  }
}

export async function getListing(env: Env, slug: string) {
  try {
    const listing = await env.DB.prepare("SELECT id, slug, name, country_code, city_slug, suburb, address, email, website, services, description, price_from, image_url FROM listings WHERE slug = ? LIMIT 1").bind(slug).first<LegacyListing>();
    if (!listing) return null;
    const city = await env.DB.prepare("SELECT id, country_code, slug, name, intro FROM cities WHERE slug = ? LIMIT 1").bind(listing.city_slug).first<LegacyCity>();
    return { listing: { id: listing.id, name: listing.name, slug: listing.slug, descriptor: "Independently listed wellness place", description: listing.description, neighbourhood: listing.suburb, address: listing.address, bookingUrl: listing.website, contactEmail: listing.email, imageUrl: listing.image_url }, city: { id: city?.id ?? 0, name: city?.name ?? listing.city_slug, slug: listing.city_slug, country: city?.country_code ?? listing.country_code, countryCode: city?.country_code ?? listing.country_code, primaryLocale: "en", introduction: city?.intro ?? null, isActive: true }, category, services: parseServices(listing.services) };
  } catch {
    return null;
  }
}

export async function getArticle(env: Env, slug: string) {
  return env.DB.prepare("SELECT id, title, slug, excerpt, body, topic, cover_image_url AS coverImageUrl, status, published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt FROM qh_articles WHERE slug = ? AND status IN ('review', 'published') LIMIT 1")
    .bind(slug)
    .first();
}

export async function createInquiry(env: Env, input: { listingId?: number; name: string; email: string; phone?: string; message: string; consentEmail: boolean; consentSms: boolean }) {
  const result = await env.DB.prepare("INSERT INTO qh_inquiries (listing_id, name, email, phone, message, consent_email, consent_sms) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(input.listingId ?? null, input.name, input.email, input.phone ?? null, input.message, input.consentEmail ? 1 : 0, input.consentSms ? 1 : 0)
    .run();
  const inquiryId = Number(result.meta.last_row_id);
  const now = new Date().toISOString();
  const consentWrites = [];
  if (input.consentEmail) consentWrites.push(env.DB.prepare("INSERT INTO qh_contact_consents (inquiry_id, channel, topic, consent_source, consented_at) VALUES (?, 'email', ?, ?, ?)").bind(inquiryId, "Quiet Hour introductions", "directory inquiry form", now));
  if (input.consentSms) consentWrites.push(env.DB.prepare("INSERT INTO qh_contact_consents (inquiry_id, channel, topic, consent_source, consented_at) VALUES (?, 'sms', ?, ?, ?)").bind(inquiryId, "Quiet Hour introductions", "directory inquiry form", now));
  if (consentWrites.length) await env.DB.batch(consentWrites);
  return { inquiryId };
}
