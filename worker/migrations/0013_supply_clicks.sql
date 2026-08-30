-- Outbound click tracking for /supplies (worker/supplies.ts handleSupplyClick).
-- Offer cards link through /api/supplies/go?id=N which records a row here and a
-- point in Analytics Engine, then 302s to the stored offer URL — redirects only
-- ever go to URLs already in qh_supply_offers, so this is not an open redirect.
CREATE TABLE IF NOT EXISTS qh_supply_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER,
  country TEXT NOT NULL,
  category_key TEXT NOT NULL,
  supplier TEXT NOT NULL,
  title TEXT,
  url TEXT NOT NULL,
  clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS qh_supply_clicks_when_idx ON qh_supply_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS qh_supply_clicks_what_idx ON qh_supply_clicks(country, category_key);
