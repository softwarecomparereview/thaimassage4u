/** Local photography served from /public/images. City frames are Wikipedia lead images; spa interiors are Unsplash. */

const SPA_PHOTOS = [
  "/images/spa/spa-1.jpg",
  "/images/spa/spa-2.jpg",
  "/images/spa/spa-3.jpg",
  "/images/spa/spa-4.jpg",
  "/images/spa/spa-5.jpg",
  "/images/spa/spa-6.jpg",
  "/images/spa/spa-7.jpg",
  "/images/spa/spa-8.jpg",
  "/images/spa/spa-11.jpg",
  "/images/spa/spa-12.jpg",
] as const;

export const HERO_PHOTO = "/images/spa/hero.jpg";

function hashKey(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function spaPhoto(seed: string | number): string {
  const index = typeof seed === "number" ? seed : hashKey(seed);
  return SPA_PHOTOS[index % SPA_PHOTOS.length];
}

export function isPlaceholderImage(url?: string | null): boolean {
  if (!url) return true;
  return url.endsWith(".svg") || url.includes("room.svg") || url.includes("hero.svg") || url.includes("suburb.svg");
}

export function listingPhoto(listing: { slug: string; image_url?: string | null }): string {
  if (listing.image_url && !isPlaceholderImage(listing.image_url)) return listing.image_url;
  return spaPhoto(listing.slug);
}

export function countryPhoto(countryCode: string): string {
  return `/images/cities/${countryCode}.jpg`;
}

export function cityPhoto(countryCode: string, citySlug?: string | null): string {
  if (citySlug) return `/images/cities/${countryCode}-${citySlug}.jpg`;
  return countryPhoto(countryCode);
}

export function placePhotoAlt(placeName: string): string {
  return placeName;
}
