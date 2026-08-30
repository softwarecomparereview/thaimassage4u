export type CountryOption = { code: "us" | "uk" | "au" | "de" | "ca" | "nz" | "ie" | "ae"; name: string; flag: string };

export const COUNTRIES: CountryOption[] = [
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "uk", name: "United Kingdom", flag: "🇬🇧" },
  { code: "au", name: "Australia", flag: "🇦🇺" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "ca", name: "Canada", flag: "🇨🇦" },
  { code: "nz", name: "New Zealand", flag: "🇳🇿" },
  { code: "ie", name: "Ireland", flag: "🇮🇪" },
  { code: "ae", name: "UAE", flag: "🇦🇪" },
];

/**
 * Mirrors worker/geo.ts's countryChoiceCookie — remembers a manual country
 * pick client-side too, so the *next* visit to / redirects there without
 * waiting on a round trip through the worker's own cookie-setting routes.
 */
export function setCountryChoice(code: string) {
  if (typeof document === "undefined") return;
  document.cookie = `tmfu_country=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function clearCountryChoice() {
  if (typeof document === "undefined") return;
  document.cookie = "tmfu_country=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "tmfu_intl=1; Path=/; Max-Age=31536000; SameSite=Lax";
}
