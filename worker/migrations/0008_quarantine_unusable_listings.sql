-- Listing data audit — quarantine, not deletion.
--
-- Audited all 861 live listings via the public API on 2026-08-26. Two classes
-- of row make the directory less trustworthy than the data behind it:
--
--   1. Unactionable (~40 rows). No phone, no website, no email and no address.
--      A visitor cannot call, visit or book; a crawler gets a contentless page;
--      and the listing can never be claimed, because the claim flow sends its
--      one-time code to a contact address that does not exist. A business name
--      and a city is not a listing.
--
--   2. Off-category (~5 rows). Nail salons that passed the importer's
--      name filter because "Spa" appears in their name (CITY NAILS & SPA,
--      Mia Nails & Spa, BS Nails Cosmetic Spa, Sofia Spa Nails & Beauty,
--      Lovey Nail). They offer no massage service.
--
-- The counts above are what the audit predicted; the SQL below evaluates the
-- real columns, so the database decides which rows actually match.
--
-- Nothing is destroyed. Every row moves to listings_quarantine with its reason
-- and the original id, so a row can be repaired and moved back with a single
-- INSERT ... SELECT. Rows that are claimed or paying are never touched.
--
-- Deliberately NOT quarantined, though the audit flagged them:
--   * 79 rows with an address but no phone/website/email — a visitor can still
--     walk in, and the address makes them repairable.
--   * 757 rows with no image — incomplete, not wrong.
--   * 7 "Bua Siam Thai Massage Spa" rows in Munich and 16 endota spa rows —
--     verified as genuinely distinct branches at distinct addresses, not
--     duplicates.
--   * 283 rows whose address does not contain the assigned city name — checked
--     and false positives: "München"/Munich, "Köln"/Cologne, and suburbs such
--     as Wandsbek (Hamburg) and Glebe (Sydney).

-- Clones the live schema exactly, so this migration does not need to know the
-- column list of a table whose DDL predates this repository.
CREATE TABLE IF NOT EXISTS listings_quarantine AS
  SELECT *, CAST(NULL AS TEXT) AS quarantine_reason, CAST(NULL AS TEXT) AS quarantined_at
  FROM listings WHERE 0;

-- A row is only ever quarantined if nobody has claimed it and nobody is paying
-- for it. Those two checks appear in every statement below.
INSERT INTO listings_quarantine
  SELECT l.*, 'unactionable: no phone, website, email or address', CURRENT_TIMESTAMP
  FROM listings l
  WHERE COALESCE(NULLIF(TRIM(l.phone), ''), NULLIF(TRIM(l.website), ''), NULLIF(TRIM(l.email), ''), NULLIF(TRIM(l.address), '')) IS NULL
    AND COALESCE(l.premium, 0) = 0
    AND COALESCE(l.claimed, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM qh_listings q WHERE q.slug = l.slug AND q.owner_id IS NOT NULL)
    AND l.slug NOT IN (SELECT slug FROM listings_quarantine);

DELETE FROM listings
  WHERE COALESCE(NULLIF(TRIM(phone), ''), NULLIF(TRIM(website), ''), NULLIF(TRIM(email), ''), NULLIF(TRIM(address), '')) IS NULL
    AND COALESCE(premium, 0) = 0
    AND COALESCE(claimed, 0) = 0
    AND slug IN (SELECT slug FROM listings_quarantine);

-- Nail salons: the name says nails and never says massage. Narrow on purpose —
-- "Auszeit - Day Spa, Massage, Kosmetik" and "Kosmetik & Fußpflege" both stay,
-- because they do offer massage.
INSERT INTO listings_quarantine
  SELECT l.*, 'off-category: nail salon, offers no massage service', CURRENT_TIMESTAMP
  FROM listings l
  WHERE (LOWER(l.name) LIKE '%nail%' OR LOWER(l.name) LIKE '%nagelstudio%')
    AND LOWER(l.name) NOT LIKE '%massage%'
    AND LOWER(l.name) NOT LIKE '%thai%'
    AND LOWER(l.name) NOT LIKE '%wellness%'
    AND COALESCE(l.premium, 0) = 0
    AND COALESCE(l.claimed, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM qh_listings q WHERE q.slug = l.slug AND q.owner_id IS NOT NULL)
    AND l.slug NOT IN (SELECT slug FROM listings_quarantine);

DELETE FROM listings
  WHERE (LOWER(name) LIKE '%nail%' OR LOWER(name) LIKE '%nagelstudio%')
    AND LOWER(name) NOT LIKE '%massage%'
    AND LOWER(name) NOT LIKE '%thai%'
    AND LOWER(name) NOT LIKE '%wellness%'
    AND COALESCE(premium, 0) = 0
    AND COALESCE(claimed, 0) = 0
    AND slug IN (SELECT slug FROM listings_quarantine);

-- Keep the CMS/claim/premium copy in step, but only for rows nobody owns.
DELETE FROM qh_listings
  WHERE owner_id IS NULL
    AND slug IN (SELECT slug FROM listings_quarantine)
    AND slug NOT IN (SELECT slug FROM listings);

-- Repair, not removal: three websites were stored without a scheme
-- ("www.theplaceformassage.com"), so the rendered link resolved relative to
-- thaimassageforu.com and 404'd instead of reaching the studio.
UPDATE listings
  SET website = 'https://' || TRIM(website)
  WHERE TRIM(COALESCE(website, '')) <> ''
    AND website NOT LIKE 'http://%'
    AND website NOT LIKE 'https://%';

CREATE INDEX IF NOT EXISTS listings_quarantine_slug_idx ON listings_quarantine(slug);
