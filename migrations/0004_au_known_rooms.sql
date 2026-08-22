-- Two Melbourne rooms the editor actually knows. Not adverts.
UPDATE listings
  SET premium = 0
  WHERE country_code = 'au'
    AND slug NOT IN ('haruka-japanese-massage', 'noir-33-south-yarra');

INSERT INTO listings (
  slug, name, country_code, city_slug, suburb, address, phone, email, website,
  services, description, price_from, currency, premium, claimed, hours, image_url, source
) VALUES (
  'haruka-japanese-massage',
  'Haruka Japanese Massage',
  'au',
  'melbourne',
  'Melbourne CBD',
  '413/365 Little Collins St, Melbourne VIC 3000',
  '+61 468 480 365',
  NULL,
  NULL,
  'Japanese massage, Relaxation, Beauty & spa',
  'The Japanese room on Little Collins I send people to when they are already in the CBD and do not want a tourist spa. Close enough after a meeting that you walk, sit, and walk home.',
  NULL,
  'AUD',
  2,
  1,
  'From 11:00',
  '/images/partners/haruka.jpg',
  'editor'
), (
  'noir-33-south-yarra',
  'NOIR 33 Massage & Spa',
  'au',
  'melbourne',
  'South Yarra',
  '10/209 Toorak Rd, South Yarra VIC 3141',
  '+61 481 333 209',
  'bookings@noir33.com.au',
  'https://noir33.com.au',
  'Private lounge, Specialty wellness, Premium packages',
  'South Yarra, not the CBD. Low lights, a lounge on Toorak Road, the room I mention when someone wants to disappear for an hour rather than sit in a shopfront on Collins.',
  NULL,
  'AUD',
  2,
  1,
  'Closes 20:00',
  '/images/partners/noir33.jpg',
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
