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
  phone: string | null;
  email: string | null;
  website: string | null;
  services: string;
  description: string;
  price_from: number | null;
  currency: string | null;
  rating: number | null;
  review_count: number | null;
  premium: number | null;
  claimed: number | null;
  image_url: string | null;
  /** AI-written one-liner (worker/enrich.ts); null until a listing has been enriched. */
  descriptor: string | null;
  phone: string | null;
  lat: number | null;
  lon: number | null;
  rating: number | null;
  review_count: number | null;
};

/**
 * One definition of "an article the public can read", shared with the sitemap.
 * The two drifted before: pages served 'review' and 'published', the sitemap
 * listed only 'published', so 20 readable articles were never submitted.
 */
export const PUBLIC_ARTICLE_STATUSES = "'review', 'published'";

const category = { id: 1, name: "Massage & wellness", slug: "massage-wellness" };

/**
 * The importer writes phone, rating, review_count, price_from and currency for
 * every place it can (scripts/import-apify-listings.mjs), but the read queries
 * here selected none of them — so the site collected the phone numbers and
 * Google ratings it needed to be worth visiting and then rendered a name, a
 * paragraph and a link out. Selecting one shared list keeps that from
 * happening again.
 */
const LISTING_COLUMNS =
  "id, slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, descriptor, price_from, currency, rating, review_count, premium, claimed, image_url, lat, lon";

/** Every public read filters on this. See worker/migrations/0010_listing_publish_status.sql. */
export const PUBLISHED = "status = 'published'";

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
    descriptor: row.descriptor || "Independently listed wellness place",
    neighbourhood: row.suburb,
    imageUrl: row.image_url,
    phone: row.phone,
    rating: row.rating,
    reviewCount: row.review_count,
    /** Raw `listings.price_from`; unit is unverified in the legacy table and every row is currently NULL, so nothing renders it yet. */
    priceFrom: row.price_from,
    currency: row.currency ?? "USD",
    /** Paid placement, and labelled as such wherever it is shown. */
    isFeatured: Boolean(row.premium),
    isClaimed: Boolean(row.claimed),
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
      env.DB.prepare(`SELECT ${LISTING_COLUMNS} FROM listings WHERE ${PUBLISHED} ORDER BY premium DESC, created_at DESC LIMIT 180`).all<LegacyListing>(),
      env.DB.prepare(`SELECT id, title, slug, excerpt, body, topic, cover_image_url AS coverImageUrl, status, published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt FROM qh_articles WHERE status IN (${PUBLIC_ARTICLE_STATUSES}) ORDER BY created_at DESC`).all(),
    ]);
    const cityNames = new Map(cities.results.map(city => [city.slug, city.name]));
    return {
      listings: listings.results.map(row => toPlaceCard(row, cityNames.get(row.city_slug))),
      articles: articles.results,
      cities: cities.results.map(city => ({ id: city.id, name: city.name, slug: city.slug, country: city.country_code, countryCode: city.country_code, primaryLocale: "en", introduction: city.intro, isActive: true })),
      categories: [category],
      premiumListings: listings.results.filter(row => Boolean(row.premium)).map(row => toPlaceCard(row, cityNames.get(row.city_slug))),
      verifiedEvents: [],
      cityMetrics: [],
    };
  } catch (error) {
    console.warn("[Worker directory] Legacy records are unavailable in this environment", error);
    const articles = await env.DB.prepare(`SELECT id, title, slug, excerpt, body, topic, cover_image_url AS coverImageUrl, status, published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt FROM qh_articles WHERE status IN (${PUBLIC_ARTICLE_STATUSES}) ORDER BY created_at DESC`).all();
    return { listings: [], articles: articles.results, cities: [], categories: [category], premiumListings: [], verifiedEvents: [], cityMetrics: [] };
  }
}

export async function getCityGuide(env: Env, slug: string) {
  try {
    const city = await env.DB.prepare("SELECT id, country_code, slug, name, intro FROM cities WHERE slug = ? LIMIT 1").bind(slug).first<LegacyCity>();
    if (!city) return null;
    const listings = await env.DB.prepare(`SELECT ${LISTING_COLUMNS} FROM listings WHERE city_slug = ? AND ${PUBLISHED} ORDER BY premium DESC, created_at DESC LIMIT 100`).bind(slug).all<LegacyListing>();
    const cards = listings.results.map(row => toPlaceCard(row, city.name));
    return { city: { id: city.id, name: city.name, slug: city.slug, country: city.country_code, countryCode: city.country_code, primaryLocale: "en", introduction: city.intro, isActive: true }, listings: cards, premiumListings: cards.filter(card => card.isFeatured), events: [], metrics: [] };
  } catch {
    return null;
  }
}

export async function getCountryGuide(env: Env, code: string) {
  if (!isDirectoryCountry(code)) return null;
  try {
    const [cities, listings] = await Promise.all([
      env.DB.prepare("SELECT id, country_code, slug, name, intro FROM cities WHERE country_code = ? ORDER BY name").bind(code).all<LegacyCity>(),
      env.DB.prepare(`SELECT ${LISTING_COLUMNS} FROM listings WHERE country_code = ? AND ${PUBLISHED} ORDER BY premium DESC, created_at DESC`).bind(code).all<LegacyListing>(),
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
    // A held-back listing 404s outright, same as a slug that never existed — publish status is not a lesser "hidden from lists" state.
    const listing = await env.DB.prepare(`SELECT ${LISTING_COLUMNS} FROM listings WHERE slug = ? AND ${PUBLISHED} LIMIT 1`).bind(slug).first<LegacyListing>();
    if (!listing) return null;
    const city = await env.DB.prepare("SELECT id, country_code, slug, name, intro FROM cities WHERE slug = ? LIMIT 1").bind(listing.city_slug).first<LegacyCity>();
    // qh_listings is the separate, slug-joined copy the claim/premium flows read — see worker/claim.ts and worker/stripe.ts.
    const qhListing = await env.DB.prepare("SELECT id, owner_id AS ownerId FROM qh_listings WHERE slug = ? LIMIT 1").bind(slug).first<{ id: number; ownerId: number | null }>();
    const subscribed = qhListing ? Boolean(await env.DB.prepare("SELECT 1 FROM qh_premium_subscriptions WHERE listing_id = ? AND placement_eligible = 1 LIMIT 1").bind(qhListing.id).first()) : false;
    // `listings.premium` is what every public ORDER BY reads, so it is the column
    // that decides placement; the subscription row is the billing record behind it.
    const isPremium = Boolean(listing.premium) || subscribed;
    return { listing: { id: listing.id, name: listing.name, slug: listing.slug, descriptor: listing.descriptor || "Independently listed wellness place", description: listing.description, neighbourhood: listing.suburb, address: listing.address, phone: listing.phone, bookingUrl: listing.website, contactEmail: listing.email, imageUrl: listing.image_url, rating: listing.rating, reviewCount: listing.review_count, priceFrom: listing.price_from, currency: listing.currency ?? "USD", lat: listing.lat, lon: listing.lon, isPremium, isClaimed: Boolean(listing.claimed) || Boolean(qhListing?.ownerId) }, city: { id: city?.id ?? 0, name: city?.name ?? listing.city_slug, slug: listing.city_slug, country: city?.country_code ?? listing.country_code, countryCode: city?.country_code ?? listing.country_code, primaryLocale: "en", introduction: city?.intro ?? null, isActive: true }, category, services: parseServices(listing.services) };
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
