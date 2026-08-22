// Talks to the live Thai Massage For U API (/api/v1 on the Cloudflare Worker).
// This is the ONLY place the app reads data from — no bundled/hardcoded listings —
// so whatever changes on the website's D1 database shows up here on next fetch,
// no app-store release needed for content changes.

export const API_BASE = "https://thaimassageforu.com/api/v1";

export type Country = {
  code: string;
  name: string;
  slug: string;
  flag: string;
  tagline: string;
  currency: string;
  listingCount: number;
  imageUrl: string;
};

export type City = {
  countryCode: string;
  slug: string;
  name: string;
  region: string | null;
  intro: string;
  imageUrl: string;
};

export type Listing = {
  slug: string;
  name: string;
  countryCode: string;
  citySlug: string;
  suburb: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  services: string[];
  description: string;
  priceFrom: number | null;
  currency: string | null;
  premium: number;
  claimed: boolean;
  hours: string | null;
  imageUrl: string;
  source: string;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  freshaUrl: string | null;
};

class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status}): ${path}`, response.status);
  }
  return (await response.json()) as T;
}

export function listCountries(): Promise<{ countries: Country[] }> {
  return get(`/countries`);
}

export function listCities(countryCode: string): Promise<{ cities: City[] }> {
  return get(`/countries/${countryCode}/cities`);
}

export function listListings(countryCode: string, citySlug: string): Promise<{ city: City; listings: Listing[] }> {
  return get(`/cities/${countryCode}/${citySlug}/listings`);
}

export function getListing(slug: string): Promise<{ listing: Listing }> {
  return get(`/listings/${encodeURIComponent(slug)}`);
}

export function featuredListings(): Promise<{ listings: Listing[] }> {
  return get(`/listings/featured`);
}

export function searchListings(query: string): Promise<{ listings: Listing[] }> {
  return get(`/search?q=${encodeURIComponent(query)}`);
}

export { ApiError };
