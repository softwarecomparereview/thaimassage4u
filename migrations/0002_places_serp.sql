ALTER TABLE listings ADD COLUMN place_id TEXT;
ALTER TABLE listings ADD COLUMN rating REAL;
ALTER TABLE listings ADD COLUMN review_count INTEGER;
ALTER TABLE listings ADD COLUMN maps_url TEXT;
ALTER TABLE listings ADD COLUMN photo_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_place ON listings (place_id) WHERE place_id IS NOT NULL;

CREATE TABLE serp_snapshots (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  city_slug TEXT,
  query TEXT NOT NULL,
  title TEXT,
  h1 TEXT,
  description TEXT,
  related_json TEXT NOT NULL DEFAULT '[]',
  paa_json TEXT NOT NULL DEFAULT '[]',
  organic_json TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_serp_city ON serp_snapshots (country_code, city_slug, captured_at DESC);
CREATE INDEX idx_serp_query ON serp_snapshots (query, captured_at DESC);
