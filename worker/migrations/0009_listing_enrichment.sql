-- Background listing enrichment — Workers AI writes a description from the
-- studio's own website, the Worker runs it on a schedule, and the CMS is where
-- it is started, stopped, tuned and watched.
--
-- Two tables and a handful of settings rows. Nothing here publishes anything on
-- its own: a generated description lands as `proposed` and only reaches the
-- public listing when an admin approves it, or when auto-publish is explicitly
-- switched on in the CMS (it ships off).

CREATE TABLE IF NOT EXISTS qh_enrichment_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error', 'disabled', 'capped')),
  attempted INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  note TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS qh_enrichment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER,
  listing_slug TEXT NOT NULL,
  listing_name TEXT,
  -- proposed: waiting for an admin. published: live on the listing.
  -- rejected: an admin said no. failed/skipped: nothing was written.
  status TEXT NOT NULL CHECK (status IN ('proposed', 'published', 'rejected', 'failed', 'skipped')),
  model TEXT,
  source_url TEXT,
  generated_description TEXT,
  previous_description TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS qh_enrichment_items_slug_idx ON qh_enrichment_items(listing_slug, status);
CREATE INDEX IF NOT EXISTS qh_enrichment_items_run_idx ON qh_enrichment_items(run_id);
CREATE INDEX IF NOT EXISTS qh_enrichment_items_created_idx ON qh_enrichment_items(created_at);
CREATE INDEX IF NOT EXISTS qh_enrichment_runs_started_idx ON qh_enrichment_runs(started_at);

-- Every knob the CMS exposes. Ships stopped, so applying this migration does
-- not start spending on inference or touch a single description.
INSERT INTO qh_settings (key, value) VALUES ('enrichment_enabled', '0') ON CONFLICT(key) DO NOTHING;
INSERT INTO qh_settings (key, value) VALUES ('enrichment_auto_publish', '0') ON CONFLICT(key) DO NOTHING;
INSERT INTO qh_settings (key, value) VALUES ('enrichment_batch_size', '8') ON CONFLICT(key) DO NOTHING;
INSERT INTO qh_settings (key, value) VALUES ('enrichment_concurrency', '3') ON CONFLICT(key) DO NOTHING;
INSERT INTO qh_settings (key, value) VALUES ('enrichment_daily_cap', '200') ON CONFLICT(key) DO NOTHING;
INSERT INTO qh_settings (key, value) VALUES ('enrichment_model', '@cf/meta/llama-3.1-8b-instruct') ON CONFLICT(key) DO NOTHING;
INSERT INTO qh_settings (key, value) VALUES ('enrichment_target', 'thin') ON CONFLICT(key) DO NOTHING;
