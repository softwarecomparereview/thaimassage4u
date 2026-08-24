-- One-time sync of the real 494+4 business listings (already live on the
-- public site via the legacy `listings`/`cities` tables) into the qh_*
-- tables the CMS dashboard and premium-checkout code actually read. Those
-- two table sets have been disconnected since the Quiet Hour migration —
-- the public site was always showing real data, but the CMS dashboard read
-- an empty qh_listings and showed "0 published listings".
--
-- Purely additive: nothing in the legacy tables is touched, and every
-- INSERT is guarded so this migration is safe to re-run.

INSERT INTO qh_categories (name, slug, short_description, is_active)
SELECT 'Massage & wellness', 'massage-wellness', 'Independently listed wellness places.', 1
WHERE NOT EXISTS (SELECT 1 FROM qh_categories WHERE slug = 'massage-wellness');

INSERT INTO qh_cities (name, slug, country, country_code, primary_locale, introduction, is_active)
SELECT
  c.name,
  c.slug,
  CASE c.country_code
    WHEN 'us' THEN 'United States'
    WHEN 'uk' THEN 'United Kingdom'
    WHEN 'au' THEN 'Australia'
    WHEN 'de' THEN 'Germany'
    ELSE c.country_code
  END,
  c.country_code,
  'en',
  c.intro,
  1
FROM cities c
WHERE NOT EXISTS (SELECT 1 FROM qh_cities WHERE qh_cities.slug = c.slug);

INSERT INTO qh_listings (city_id, category_id, name, slug, descriptor, description, neighbourhood, address, booking_url, contact_email, image_url, status, is_featured)
SELECT
  qc.id,
  (SELECT id FROM qh_categories WHERE slug = 'massage-wellness'),
  l.name,
  l.slug,
  'Independently listed wellness place',
  l.description,
  l.suburb,
  l.address,
  l.website,
  l.email,
  l.image_url,
  'published',
  0
FROM listings l
JOIN qh_cities qc ON qc.slug = l.city_slug
WHERE NOT EXISTS (SELECT 1 FROM qh_listings WHERE qh_listings.slug = l.slug);
