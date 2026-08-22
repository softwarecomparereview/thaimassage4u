-- Independent masseuse in Werribee: third Australia room the editor knows.
UPDATE listings
  SET premium = 0
  WHERE country_code = 'au'
    AND slug NOT IN ('haruka-japanese-massage', 'noir-33-south-yarra', 'betty-werribee');

INSERT INTO listings (
  slug, name, country_code, city_slug, suburb, address, phone, email, website,
  services, description, price_from, currency, premium, claimed, hours, image_url, source
) VALUES (
  'betty-werribee',
  'Betty — independent masseuse',
  'au',
  'melbourne',
  'Werribee',
  'Werribee, western suburbs, Melbourne VIC',
  '+61 478 898 557',
  NULL,
  NULL,
  'Independent massage, Personal massage, Relaxation',
  'The independent masseuse I name in the west. Werribee — one person, one room. Call 0478 898 557. For people who live west of the river and should not have to come into the CBD for a proper hour.',
  NULL,
  'AUD',
  2,
  1,
  'Call to book',
  '/images/partners/betty.jpg',
  'editor'
)
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  country_code = excluded.country_code,
  city_slug = excluded.city_slug,
  suburb = excluded.suburb,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  website = excluded.website,
  services = excluded.services,
  description = excluded.description,
  price_from = excluded.price_from,
  currency = excluded.currency,
  premium = excluded.premium,
  claimed = excluded.claimed,
  hours = excluded.hours,
  image_url = excluded.image_url,
  source = excluded.source;
