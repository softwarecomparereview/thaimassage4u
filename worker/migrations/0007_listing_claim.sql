-- One-time codes for claiming a listing via email or SMS — no password,
-- no separate account signup. A code is scoped to one listing + one
-- contact address and expires quickly.
CREATE TABLE IF NOT EXISTS qh_otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  address TEXT NOT NULL,
  code TEXT NOT NULL,
  listing_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS qh_otp_codes_lookup_idx ON qh_otp_codes(listing_id, address, consumed_at);
