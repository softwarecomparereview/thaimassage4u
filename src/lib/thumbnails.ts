import { envSecret } from "./secrets";
import { fetchPlacePhoto } from "./places";
import type { Listing } from "./db";
import { mediaPut } from "./storage";

const BLOCKED_THUMB_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "www.google.com.au",
  "www.google.co.uk",
  "www.google.de",
  "maps.googleapis.com",
]);

export function extractOgImage(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      const url = new URL(match[1], baseUrl);
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch {
      continue;
    }
  }
  return null;
}

export function isAllowedWebsite(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (BLOCKED_THUMB_HOSTS.has(host) || host.endsWith(".google.com") || host.endsWith(".gstatic.com")) return null;
    return url;
  } catch {
    return null;
  }
}

function extFor(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

export async function putListingThumb(
  env: Env,
  slug: string,
  bytes: ArrayBuffer,
  type: string
): Promise<string> {
  const key = `listings/${slug}.${extFor(type)}`;
  await mediaPut(env, key, bytes, { httpMetadata: { contentType: type } });
  const path = `/media/${key}`;
  await env.DB.prepare("UPDATE listings SET image_url = ? WHERE slug = ?").bind(path, slug).run();
  return path;
}

async function fetchImage(url: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
  });
  if (!response.ok) return null;
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return null;
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 2000 || bytes.byteLength > 4_000_000) return null;
  return { bytes, type };
}

async function ogImageFromWebsite(website: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const page = isAllowedWebsite(website);
  if (!page) return null;
  const response = await fetch(page, {
    redirect: "follow",
    headers: { accept: "text/html", "user-agent": "ThaiMassageForUBot/1.0 (+https://thaimassageforu.com)" },
  });
  if (!response.ok) return null;
  const html = (await response.text()).slice(0, 80_000);
  const imageUrl = extractOgImage(html, page.toString());
  if (!imageUrl) return null;
  return fetchImage(imageUrl);
}

async function screenshotWebsite(env: Env, website: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const page = isAllowedWebsite(website);
  if (!page) return null;
  const response = await env.BROWSER.quickAction("screenshot", {
    url: page.toString(),
    viewport: { width: 1280, height: 720 },
    screenshotOptions: { type: "jpeg", quality: 72 },
    gotoOptions: { waitUntil: "domcontentloaded", timeout: 20000 },
  });
  if (!response.ok) return null;
  const type = response.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) return null;
  return { bytes: await response.arrayBuffer(), type };
}

export async function thumbnailListing(env: Env, listing: Listing): Promise<string | null> {
  if (listing.image_url?.startsWith("/media/")) return listing.image_url;

  if (listing.photo_name && envSecret(env, "GOOGLE_PLACES_API_KEY")) {
    const photo = await fetchPlacePhoto(env, listing.photo_name);
    if (photo) return putListingThumb(env, listing.slug, photo.bytes, photo.type);
  }

  if (listing.website) {
    const og = await ogImageFromWebsite(listing.website);
    if (og) return putListingThumb(env, listing.slug, og.bytes, og.type);
    try {
      const shot = await screenshotWebsite(env, listing.website);
      if (shot) return putListingThumb(env, listing.slug, shot.bytes, shot.type);
    } catch (error) {
      console.warn(JSON.stringify({ event: "website-screenshot-skipped", slug: listing.slug, error: String(error) }));
    }
  }

  return null;
}
