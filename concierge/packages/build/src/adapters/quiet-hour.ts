// §5 step 1 (Extract). Reads straight from the live `listings`/`cities` tables via D1 — the
// same source worker/directory.ts's public queries read, filtered the same way
// (status = 'published', mirroring PUBLISHED in worker/directory.ts) so the index never
// contains a listing the site itself wouldn't show.

import type { D1Config } from "../d1.js";
import { d1Query } from "../d1.js";

export interface RawListing {
  id: number;
  slug: string;
  name: string;
  descriptor: string | null;
  description: string | null;
  city_slug: string;
  country_code: string;
  suburb: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  image_url: string | null;
  services: string | null;
  price_from: number | null;
  currency: string | null;
  rating: number | null;
  review_count: number | null;
  premium: number | null;
  claimed: number | null;
  lat: number | null;
  lon: number | null;
}

export interface RawPlace {
  slug: string;
  name: string;
  country_code: string;
  lat: number | null;
  lng: number | null;
}

export async function extractQuietHour(config: D1Config): Promise<{ listings: RawListing[]; places: RawPlace[] }> {
  const listings = await d1Query<RawListing>(
    config,
    `SELECT id, slug, name, descriptor, description, city_slug, country_code, suburb, address, phone, website,
            image_url, services, price_from, currency, rating, review_count, premium, claimed, lat, lon
     FROM listings WHERE status = 'published'`,
  );
  const places = await d1Query<RawPlace>(config, `SELECT slug, name, country_code, lat, lng FROM cities`);
  return { listings, places };
}
