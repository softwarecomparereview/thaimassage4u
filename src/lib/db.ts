export type Country = {
  code: string;
  name: string;
  slug: string;
  locale: string;
  currency: string;
  flag: string;
  tagline: string;
  intro: string;
  monthly_searches: number;
  search_note: string | null;
};

export type City = {
  id: number;
  country_code: string;
  slug: string;
  name: string;
  region: string | null;
  intro: string;
  wiki_title: string | null;
  monthly_searches: number;
  lat: number | null;
  lng: number | null;
};

export type Listing = {
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
  premium: number;
  claimed: number;
  hours: string | null;
  image_url: string | null;
  source: string;
  source_url: string | null;
  place_id?: string | null;
  rating?: number | null;
  review_count?: number | null;
  maps_url?: string | null;
  photo_name?: string | null;
};

export type KeywordStat = {
  keyword: string;
  monthly_searches: number;
  source: string;
  city_slug: string | null;
};

export async function listCountries(db: D1Database): Promise<Country[]> {
  const { results } = await db.prepare("SELECT * FROM countries ORDER BY monthly_searches DESC").all<Country>();
  return results;
}

export async function getCountry(db: D1Database, code: string): Promise<Country | null> {
  return db.prepare("SELECT * FROM countries WHERE code = ?").bind(code).first<Country>();
}

export async function listCities(db: D1Database, countryCode?: string): Promise<City[]> {
  if (countryCode) {
    const { results } = await db
      .prepare("SELECT * FROM cities WHERE country_code = ? ORDER BY monthly_searches DESC")
      .bind(countryCode)
      .all<City>();
    return results;
  }
  const { results } = await db.prepare("SELECT * FROM cities ORDER BY monthly_searches DESC").all<City>();
  return results;
}

export async function getCity(db: D1Database, countryCode: string, slug: string): Promise<City | null> {
  return db
    .prepare("SELECT * FROM cities WHERE country_code = ? AND slug = ?")
    .bind(countryCode, slug)
    .first<City>();
}

const KNOWN_ROOM_ORDER = `CASE slug
           WHEN 'haruka-japanese-massage' THEN 0
           WHEN 'noir-33-south-yarra' THEN 1
           WHEN 'betty-werribee' THEN 2
           ELSE 9
         END`;

export async function listListings(
  db: D1Database,
  countryCode: string,
  citySlug: string
): Promise<Listing[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM listings WHERE country_code = ? AND city_slug = ?
       ORDER BY premium DESC, ${KNOWN_ROOM_ORDER}, rating DESC, claimed DESC, name ASC LIMIT 20`
    )
    .bind(countryCode, citySlug)
    .all<Listing>();
  return results;
}

export async function getListing(db: D1Database, slug: string): Promise<Listing | null> {
  return db.prepare("SELECT * FROM listings WHERE slug = ?").bind(slug).first<Listing>();
}

export async function getListingById(db: D1Database, id: number): Promise<Listing | null> {
  return db.prepare("SELECT * FROM listings WHERE id = ?").bind(id).first<Listing>();
}

export async function listAdminListings(
  db: D1Database,
  filters: { country?: string; city?: string; q?: string }
): Promise<Listing[]> {
  const clauses = [];
  const binds: Array<string> = [];
  if (filters.country) {
    clauses.push("country_code = ?");
    binds.push(filters.country);
  }
  if (filters.city) {
    clauses.push("city_slug = ?");
    binds.push(filters.city);
  }
  if (filters.q) {
    clauses.push("(name LIKE ? OR slug LIKE ? OR address LIKE ?)");
    const like = `%${filters.q}%`;
    binds.push(like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { results } = await db
    .prepare(`SELECT * FROM listings ${where} ORDER BY id DESC LIMIT 200`)
    .bind(...binds)
    .all<Listing>();
  return results;
}

export type ListingDraft = {
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
  premium: number;
  claimed: number;
  hours: string | null;
  image_url: string | null;
};

export async function createListing(db: D1Database, draft: ListingDraft): Promise<void> {
  await db
    .prepare(
      `INSERT INTO listings
        (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, price_from, currency, premium, claimed, hours, image_url, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')`
    )
    .bind(
      draft.slug,
      draft.name,
      draft.country_code,
      draft.city_slug,
      draft.suburb,
      draft.address,
      draft.phone,
      draft.email,
      draft.website,
      draft.services,
      draft.description,
      draft.price_from,
      draft.currency,
      draft.premium,
      draft.claimed,
      draft.hours,
      draft.image_url
    )
    .run();
}

export async function updateListing(db: D1Database, id: number, draft: ListingDraft): Promise<void> {
  await db
    .prepare(
      `UPDATE listings SET
        slug = ?, name = ?, country_code = ?, city_slug = ?, suburb = ?, address = ?, phone = ?, email = ?, website = ?,
        services = ?, description = ?, price_from = ?, currency = ?, premium = ?, claimed = ?, hours = ?, image_url = ?
       WHERE id = ?`
    )
    .bind(
      draft.slug,
      draft.name,
      draft.country_code,
      draft.city_slug,
      draft.suburb,
      draft.address,
      draft.phone,
      draft.email,
      draft.website,
      draft.services,
      draft.description,
      draft.price_from,
      draft.currency,
      draft.premium,
      draft.claimed,
      draft.hours,
      draft.image_url,
      id
    )
    .run();
}

export async function deleteListing(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM listings WHERE id = ?").bind(id).run();
}

export async function adminInbox(db: D1Database) {
  const [offers, claims, offerCount, claimCount, listingCount] = await Promise.all([
    db.prepare("SELECT id, name, email, offer_amount, currency, status, created_at FROM sale_offers ORDER BY created_at DESC LIMIT 12").all(),
    db.prepare("SELECT id, listing_id, name, email, status, created_at FROM claims ORDER BY created_at DESC LIMIT 12").all(),
    db.prepare("SELECT COUNT(*) AS n FROM sale_offers").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM claims").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM listings").first<{ n: number }>(),
  ]);
  return {
    offers: offers.results,
    claims: claims.results,
    offerCount: offerCount?.n ?? 0,
    claimCount: claimCount?.n ?? 0,
    listingCount: listingCount?.n ?? 0,
  };
}

export async function countListings(db: D1Database, countryCode?: string): Promise<number> {
  const row = countryCode
    ? await db.prepare("SELECT COUNT(*) AS n FROM listings WHERE country_code = ?").bind(countryCode).first<{ n: number }>()
    : await db.prepare("SELECT COUNT(*) AS n FROM listings").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function searchListings(db: D1Database, query: string): Promise<Listing[]> {
  const like = `%${query}%`;
  const { results } = await db
    .prepare(
      `SELECT * FROM listings
       WHERE name LIKE ? OR suburb LIKE ? OR city_slug LIKE ? OR services LIKE ? OR description LIKE ?
       ORDER BY premium DESC LIMIT 40`
    )
    .bind(like, like, like, like, like)
    .all<Listing>();
  return results;
}

export async function keywordStats(db: D1Database, countryCode?: string): Promise<KeywordStat[]> {
  if (countryCode) {
    const { results } = await db
      .prepare(
        "SELECT keyword, monthly_searches, source, city_slug FROM keyword_stats WHERE country_code = ? ORDER BY monthly_searches DESC"
      )
      .bind(countryCode)
      .all<KeywordStat>();
    return results;
  }
  const { results } = await db
    .prepare("SELECT keyword, monthly_searches, source, city_slug FROM keyword_stats ORDER BY monthly_searches DESC LIMIT 16")
    .all<KeywordStat>();
  return results;
}

export async function featuredListings(db: D1Database): Promise<Listing[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM listings WHERE premium >= 1
       ORDER BY premium DESC, ${KNOWN_ROOM_ORDER}, name ASC
       LIMIT 8`
    )
    .all<Listing>();
  return results;
}

export async function featuredListingsByCountry(db: D1Database, countryCode: string, limit = 2): Promise<Listing[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM listings WHERE country_code = ? AND premium >= 1
       ORDER BY premium DESC, ${KNOWN_ROOM_ORDER}, name ASC
       LIMIT ?`
    )
    .bind(countryCode, limit)
    .all<Listing>();
  return results;
}
