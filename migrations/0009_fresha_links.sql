ALTER TABLE listings ADD COLUMN fresha_url TEXT;
ALTER TABLE listings ADD COLUMN fresha_match_score REAL;
ALTER TABLE listings ADD COLUMN fresha_verified_at TEXT;
CREATE INDEX IF NOT EXISTS idx_listings_fresha_url ON listings(fresha_url);
