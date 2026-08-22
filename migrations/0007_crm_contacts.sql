-- A lightweight "who do we still need to reach out to" pipeline over real
-- listings. Populated (and re-populated) from seed/seed.sql via an
-- INSERT ... SELECT keyed off listings.claimed = 0 — this table never itself
-- sends anything; it's just a place to track outreach status by hand.
CREATE TABLE crm_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  business_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  city_slug TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'ready', 'emailed', 'texted', 'responded', 'claimed', 'declined', 'invalid')),
  notes TEXT,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_crm_contacts_listing ON crm_contacts (listing_id);
CREATE INDEX idx_crm_contacts_stage ON crm_contacts (stage);
CREATE INDEX idx_crm_contacts_country_city ON crm_contacts (country_code, city_slug);
