const COUNTRY_CODES = new Set(["us", "uk", "au", "de"]);

const BOT =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|applebot|semrush|ahrefsbot|dotbot|crawler|spider/i;

export function isDirectoryCountry(code: string | null | undefined): code is "us" | "uk" | "au" | "de" {
  return !!code && COUNTRY_CODES.has(code);
}

export function requestCountry(request: Request): string | null {
  const cfCountry = (request as Request & { cf?: { country?: string } }).cf?.country;
  const raw = (cfCountry || request.headers.get("CF-IPCountry") || "").toLowerCase();
  if (raw === "gb" || raw === "uk") return "uk";
  if (isDirectoryCountry(raw)) return raw;
  return null;
}

export function pathCountry(pathname: string): string | null {
  const match = pathname.match(/^\/(us|uk|au|de)(?:\/|$)/);
  return match?.[1] ?? null;
}

export function cookieCountry(request: Request): string | null {
  const match = (request.headers.get("cookie") ?? "").match(/(?:^|;\s*)tmfu_country=(us|uk|au|de)(?:;|$)/);
  return match?.[1] ?? null;
}

export function isSearchBot(request: Request): boolean {
  return BOT.test(request.headers.get("user-agent") ?? "");
}

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

export function clearInternationalCookie(): string {
  return "tmfu_intl=; Path=/; Max-Age=0; SameSite=Lax";
}

export function geoHomeLocation(request: Request): string | null {
  if (isSearchBot(request) || wantsInternational(request)) return null;
  const chosen = cookieCountry(request);
  if (chosen) return `/${chosen}`;
  const country = requestCountry(request);
  return country ? `/${country}` : null;
}
