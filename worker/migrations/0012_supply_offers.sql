-- Daily-refreshed massage-business supply offers (worker/supplies.ts).
-- Rows are wholesale-replaced per country+category on each sync from the
-- supply-scanner Apify actor's latest successful run, so the table always
-- holds "today's best & cheapest, delivered locally" and nothing stale.

CREATE TABLE IF NOT EXISTS qh_supply_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country TEXT NOT NULL,
  category_key TEXT NOT NULL,
  category_label TEXT NOT NULL,
  title TEXT NOT NULL,
  price REAL NOT NULL,
  shipping REAL,
  total REAL NOT NULL,
  currency TEXT NOT NULL,
  free_shipping INTEGER NOT NULL DEFAULT 0,
  url TEXT NOT NULL,
  image TEXT,
  supplier TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS qh_supply_offers_lookup_idx ON qh_supply_offers(country, category_key, total);
