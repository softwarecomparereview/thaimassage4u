-- Real contact fields for the affiliate signup kit — phone, a location (city/suburb
-- level, not necessarily a precise street address), and a short business bio — so
-- the kit cards in /admin/affiliates are genuinely copy-paste ready instead of
-- leaving the human to compose these on the spot for every platform.
ALTER TABLE affiliate_defaults ADD COLUMN phone TEXT;
ALTER TABLE affiliate_defaults ADD COLUMN address TEXT;
ALTER TABLE affiliate_defaults ADD COLUMN bio TEXT;
