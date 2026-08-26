-- Workers AI enrichment support (worker/enrich.ts).
-- descriptor: the short one-line profile the model writes (legacy listings had
--   no descriptor column at all — the site hard-coded one string for everyone).
-- enriched_at: stamped whenever an enrichment attempt ran, success or not, so
--   the batch picker (WHERE enriched_at IS NULL) never retries the same row forever.
ALTER TABLE listings ADD COLUMN descriptor TEXT;
ALTER TABLE listings ADD COLUMN enriched_at TEXT;
-- Geo coordinates for schema.org GeoCoordinates in listing JSON-LD. The scrapes
-- capture lat/lng but the import pipeline never stored them before this.
ALTER TABLE listings ADD COLUMN lat REAL;
ALTER TABLE listings ADD COLUMN lon REAL;
