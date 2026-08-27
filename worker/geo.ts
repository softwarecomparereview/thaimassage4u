/**
 * IP-based country detection + manual override, restored from the original
 * (pre-Manus) Worker's src/lib/geo.ts — dropped entirely in the Quiet Hour
 * rebuild along with the /us /uk /au /de country pages themselves.
 */

const COUNTRY_CODES = new Set(["us", "uk", "au", "de", "ca", "nz", "ie", "ae"]);

const BOT =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|applebot|semrush|ahrefsbot|dotbot|crawler|spider/i;

export function isDirectoryCountry(code: string | null | undefined): code is "us" | "uk" | "au" | "de" | "ca" | "nz" | "ie" | "ae" {
  return !!code && COUNTRY_CODES.has(code);
}

/** Cloudflare's edge-provided geolocation — no external API call needed. */
export function requestCountry(request: Request): string | null {
  const cfCountry = (request as Request & { cf?: { country?: string } }).cf?.country;
  const raw = (cfCountry || request.headers.get("CF-IPCountry") || "").toLowerCase();
  if (raw === "gb" || raw === "uk") return "uk";
  if (isDirectoryCountry(raw)) return raw;
  return null;
}

export function cookieCountry(request: Request): string | null {
  const match = (request.headers.get("cookie") ?? "").match(/(?:^|;\s*)tmfu_country=(us|uk|au|de|ca|nz|ie|ae)(?:;|$)/);
  return match?.[1] ?? null;
}

export function isSearchBot(request: Request): boolean {
  return BOT.test(request.headers.get("user-agent") ?? "");
}

/** ?intl=1 or a previously-set "stay on the all-countries page" cookie. */
export function wantsInternational(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("intl") === "1") return true;
  return /(?:^|;\s*)tmfu_intl=1(?:;|$)/.test(request.headers.get("cookie") ?? "");
}

export function countryChoiceCookie(code: string): string {
  return `tmfu_country=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function internationalCookie(): string {
  return "tmfu_intl=1; Path=/; Max-Age=31536000; SameSite=Lax";
}

export function clearCountryCookie(): string {
  return "tmfu_country=; Path=/; Max-Age=0; SameSite=Lax";
}

/**
 * Where GET / should redirect to, or null to render the root "all countries"
 * landing page instead. Bots and anyone who explicitly asked to stay
 * international never get redirected, so / stays crawlable and escapable.
 */
export function geoHomeLocation(request: Request): string | null {
  if (isSearchBot(request) || wantsInternational(request)) return null;
  const chosen = cookieCountry(request);
  if (chosen) return `/${chosen}`;
  const country = requestCountry(request);
  return country ? `/${country}` : null;
}

export const COUNTRY_NAMES: Record<string, string> = {
  us: "United States",
  uk: "United Kingdom",
  au: "Australia",
  de: "Germany",
  ca: "Canada",
  nz: "New Zealand",
  ie: "Ireland",
  ae: "United Arab Emirates",
};
