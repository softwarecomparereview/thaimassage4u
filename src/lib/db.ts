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

export async function listListings(
  db: D1Database,
  countryCode: string,
  citySlug: string
): Promise<Listing[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM listings WHERE country_code = ? AND city_slug = ? ORDER BY premium DESC, claimed DESC, name ASC"
    )
    .bind(countryCode, citySlug)
    .all<Listing>();
  return results;
}

export async function getListing(db: D1Database, slug: string): Promise<Listing | null> {
  return db.prepare("SELECT * FROM listings WHERE slug = ?").bind(slug).first<Listing>();
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
    .prepare("SELECT * FROM listings WHERE premium >= 1 ORDER BY premium DESC, name ASC LIMIT 8")
    .all<Listing>();
  return results;
}
