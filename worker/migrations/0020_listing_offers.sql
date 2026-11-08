-- Owner-configured discount vouchers (worker/offers.ts). One offer per listing, keyed by slug
-- because slug is the join between the public `listings` table and the claim-side `qh_listings`
-- (see worker/claim.ts). Nothing here is public until the owner of a claimed listing saves an
-- offer with active = 1, and only between starts_on and ends_on (YYYY-MM-DD, inclusive, UTC).
-- reveal_count counts customers who pressed "Get voucher" on the listing page, so an owner can see
-- what the voucher is actually doing for them.
CREATE TABLE IF NOT EXISTS listing_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  details TEXT,
  terms TEXT,
  code TEXT NOT NULL,
  starts_on TEXT,
  ends_on TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  reveal_count INTEGER NOT NULL DEFAULT 0,
  owner_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
