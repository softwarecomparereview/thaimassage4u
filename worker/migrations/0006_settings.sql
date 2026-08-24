-- Generic key/value settings table, starting with the Stripe test/live
-- toggle. Defaults to test mode so a fresh row (or a missing one) never
-- accidentally reads as live.
CREATE TABLE IF NOT EXISTS qh_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO qh_settings (key, value) VALUES ('stripe_mode', 'test')
ON CONFLICT(key) DO NOTHING;
