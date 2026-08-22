import { slugify } from "./escape";
import { envSecret } from "./secrets";
import type { City } from "./db";

export type PlaceRecord = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  photoName: string | null;
};

type PlacesSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    photos?: Array<{ name?: string }>;
  }>;
};

export function parsePlacesResponse(payload: unknown): PlaceRecord[] {
  const body = payload as PlacesSearchResponse;
  const out: PlaceRecord[] = [];
  for (const place of body.places ?? []) {
    const name = place.displayName?.text?.trim();
    if (!place.id || !name) continue;
    if (!/massage|spa|thai|wellness|sala/i.test(name + " " + (place.formattedAddress ?? ""))) continue;
    out.push({
      placeId: place.id,
      name: name.slice(0, 80),
      address: place.formattedAddress ?? null,
      phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
      website: place.websiteUri ?? null,
      rating: typeof place.rating === "number" ? place.rating : null,
      reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      mapsUrl: place.googleMapsUri ?? null,
      photoName: place.photos?.[0]?.name ?? null,
    });
  }
  return out.slice(0, 20);
}

export function placesSearchQuery(cityName: string): string {
  return `Thai massage ${cityName}`;
}

export async function searchPlaces(env: Env, cityName: string): Promise<PlaceRecord[]> {
  const key = envSecret(env, "GOOGLE_PLACES_API_KEY");
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set");

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.photos",
    },
    body: JSON.stringify({ textQuery: placesSearchQuery(cityName), maxResultCount: 20 }),
  });
  if (!response.ok) {
    throw new Error(`Places search failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  }
  return parsePlacesResponse(await response.json());
}

export async function fetchPlacePhoto(env: Env, photoName: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const key = envSecret(env, "GOOGLE_PLACES_API_KEY");
  if (!key || !photoName.startsWith("places/")) return null;
  const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  url.searchParams.set("maxHeightPx", "640");
  url.searchParams.set("maxWidthPx", "960");
  url.searchParams.set("key", key);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) return null;
  const type = response.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) return null;
  return { bytes: await response.arrayBuffer(), type };
}

function currencyFor(countryCode: string): string {
  return countryCode === "us" ? "USD" : countryCode === "uk" ? "GBP" : countryCode === "de" ? "EUR" : "AUD";
}

export async function upsertPlaces(env: Env, city: City, places: PlaceRecord[]): Promise<string[]> {
  const slugs: string[] = [];
  for (const place of places) {
    const slug = `${slugify(place.name)}-${city.slug}`.slice(0, 80);
    const description = `${place.name} is a Thai massage or spa listing in ${city.name}, sourced from Google Places. ${
      place.rating ? `Rated ${place.rating.toFixed(1)}` : "Rating pending"
    }${place.reviewCount ? ` from ${place.reviewCount} reviews` : ""}. Details should be claimed by the owner before booking.`;
    await env.DB.prepare(
      `INSERT INTO listings
        (slug, name, country_code, city_slug, suburb, address, phone, website, services, description, currency, premium, claimed, hours, image_url, source, source_url, place_id, rating, review_count, maps_url, photo_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Traditional Thai', ?, ?, 0, 0, 'See Google listing for hours', '/images/room.svg', 'places', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         address = excluded.address,
         phone = excluded.phone,
         website = excluded.website,
         description = excluded.description,
         source = 'places',
         source_url = excluded.source_url,
         place_id = excluded.place_id,
         rating = excluded.rating,
         review_count = excluded.review_count,
         maps_url = excluded.maps_url,
         photo_name = excluded.photo_name`
    )
      .bind(
        slug,
        place.name,
        city.country_code,
        city.slug,
        city.name,
        place.address,
        place.phone,
        place.website,
        description,
        currencyFor(city.country_code),
        place.mapsUrl,
        place.placeId,
        place.rating,
        place.reviewCount,
        place.mapsUrl,
        place.photoName
      )
      .run();
    slugs.push(slug);
  }
  return slugs;
}
