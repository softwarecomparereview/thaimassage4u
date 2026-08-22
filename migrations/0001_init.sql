CREATE TABLE countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL,
  currency TEXT NOT NULL,
  flag TEXT NOT NULL,
  tagline TEXT NOT NULL,
  intro TEXT NOT NULL,
  monthly_searches INTEGER NOT NULL DEFAULT 0,
  search_note TEXT
);

CREATE TABLE cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL REFERENCES countries(code),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  intro TEXT NOT NULL,
  wiki_title TEXT,
  monthly_searches INTEGER NOT NULL DEFAULT 0,
  lat REAL,
  lng REAL,
  UNIQUE (country_code, slug)
);

CREATE TABLE listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  city_slug TEXT NOT NULL,
  suburb TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  services TEXT NOT NULL,
  description TEXT NOT NULL,
  price_from INTEGER,
  currency TEXT,
  premium INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  hours TEXT,
  image_url TEXT,
  source TEXT NOT NULL DEFAULT 'seed',
  source_url TEXT,
  osm_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE keyword_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL,
  city_slug TEXT,
  keyword TEXT NOT NULL,
  monthly_searches INTEGER NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE sale_offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  offer_amount TEXT,
  currency TEXT,
  message TEXT NOT NULL,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  country_hint TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  listing_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE scrape_jobs (
  id TEXT PRIMARY KEY,
  country_code TEXT,
  city_slug TEXT,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  listings_found INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE INDEX idx_listings_city ON listings (country_code, city_slug, premium DESC);
CREATE INDEX idx_listings_name ON listings (name);
CREATE INDEX idx_listings_osm ON listings (osm_id);
CREATE INDEX idx_keyword_country ON keyword_stats (country_code, monthly_searches DESC);
