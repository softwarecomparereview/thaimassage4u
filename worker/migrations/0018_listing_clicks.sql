-- Outbound click tracking for listing pages' "Book direct" link (worker/outbound.ts
-- handleListingClick). Every listing page's outbound website/booking link used to be a raw
-- <a href> straight to the business's own site — no record of how many visitors this site
-- actually sends anyone, which is both a real gap for showing owners their ROI and the
-- prerequisite for any booking-platform affiliate program (Fresha, Booksy, Vagaro, Treatwell):
-- those programs pay on referred signups/bookings, which needs a redirect to attribute through
-- in the first place. Same pattern as qh_supply_clicks (0013_supply_clicks.sql): a redirect
-- endpoint that only ever forwards to a URL already on file for that listing (never an arbitrary
-- query param), so this can't be used as an open redirect.
CREATE TABLE IF NOT EXISTS qh_listing_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  city_slug TEXT,
  country_code TEXT,
  platform TEXT,
  url TEXT NOT NULL,
  clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS qh_listing_clicks_when_idx ON qh_listing_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS qh_listing_clicks_listing_idx ON qh_listing_clicks(listing_id);
