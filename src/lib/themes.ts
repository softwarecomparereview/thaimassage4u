import { escapeAttr, escapeHtml } from "./escape";
import { cityPhoto, countryPhoto, HERO_PHOTO, placePhotoAlt } from "./photos";

export type ThemeLayer = {
  id: string;
  label: string;
  kicker: string;
  greeting: string;
  note: string;
};

const COUNTRY_LAYERS: Record<string, ThemeLayer> = {
  us: {
    id: "us",
    label: "United States",
    kicker: "United States",
    greeting: "Book a Thai massage in the States",
    note: "After-work rooms in the big cities — Midtown, the Valley, the Loop, a walk from the hotel.",
  },
  uk: {
    id: "uk",
    label: "United Kingdom",
    kicker: "United Kingdom",
    greeting: "Find a treatment room in Britain",
    note: "High streets, quieter corners, a mat room above the restaurant you already know.",
  },
  au: {
    id: "au",
    label: "Australia",
    kicker: "Australia",
    greeting: "Thai massage across the capitals",
    note: "The home market. Laneways in Melbourne, harbour light in Sydney, river heat in Brisbane.",
  },
  de: {
    id: "de",
    label: "Germany",
    kicker: "Germany",
    greeting: "Thai-Massage in Deutschland",
    note: "Neighbourhood rooms first — Berlin kiez by kiez, then Munich, Hamburg, Frankfurt and Cologne.",
  },
};

const CITY_LAYERS: Record<string, ThemeLayer> = {
  "us-new-york": {
    id: "new-york",
    label: "New York",
    kicker: "City layer",
    greeting: "Midtown pace, Downtown recovery",
    note: "Sharper corners and taxi-yellow signals for lunch-break and after-commute bookings.",
  },
  "us-los-angeles": {
    id: "los-angeles",
    label: "Los Angeles",
    kicker: "City layer",
    greeting: "Sunset-strip calm, valley stretch",
    note: "Softer peach light and wider radius — wellness studios from Santa Monica to Downtown.",
  },
  "us-chicago": {
    id: "chicago",
    label: "Chicago",
    kicker: "City layer",
    greeting: "Loop steel, neighbourhood warmth",
    note: "Architectural blues for winter indoor demand around the Loop and Lincoln Park.",
  },
  "us-miami": {
    id: "miami",
    label: "Miami",
    kicker: "City layer",
    greeting: "Brickell mornings, South Beach nights",
    note: "Aqua and art-deco curves for hotel guests and residents.",
  },
  "us-san-francisco": {
    id: "san-francisco",
    label: "San Francisco",
    kicker: "City layer",
    greeting: "Fog, hills, SoMa lunch hours",
    note: "Cool grey with bridge gold for Financial District and Mission studios.",
  },
  "us-las-vegas": {
    id: "las-vegas",
    label: "Las Vegas",
    kicker: "City layer",
    greeting: "Strip nights, local days",
    note: "Night purple and neon gold for shift workers and visitor stays.",
  },
  "uk-london": {
    id: "london",
    label: "London",
    kicker: "City layer",
    greeting: "Borough by borough",
    note: "Royal navy and brass for Soho, Shoreditch and Chelsea storefronts.",
  },
  "uk-manchester": {
    id: "manchester",
    label: "Manchester",
    kicker: "City layer",
    greeting: "Northern Quarter recovery",
    note: "Northern Quarter recoveries, mill brick, a walkable centre that is not London.",
  },
  "uk-birmingham": {
    id: "birmingham",
    label: "Birmingham",
    kicker: "City layer",
    greeting: "Jewellery Quarter and the city core",
    note: "Canal teal sitting on the British heritage frame.",
  },
  "uk-edinburgh": {
    id: "edinburgh",
    label: "Edinburgh",
    kicker: "City layer",
    greeting: "Old Town stone, New Town calm",
    note: "Sandstone and thistle green, with festival-season lift.",
  },
  "uk-glasgow": {
    id: "glasgow",
    label: "Glasgow",
    kicker: "City layer",
    greeting: "West End and the merchant city",
    note: "Clyde navy over the UK layer for after-work bookings.",
  },
  "uk-bristol": {
    id: "bristol",
    label: "Bristol",
    kicker: "City layer",
    greeting: "Harbour and the South West",
    note: "Harbour teal and balloon-warm accents on the national frame.",
  },
  "au-melbourne": {
    id: "melbourne",
    label: "Melbourne",
    kicker: "City layer",
    greeting: "Laneways, CBD and the bay",
    note: "Coffee-dark laneways on the Australian sand palette — the original home market.",
  },
  "au-sydney": {
    id: "sydney",
    label: "Sydney",
    kicker: "City layer",
    greeting: "Harbour light, sandstone streets",
    note: "Harbour blue over Australian gold for CBD, Surry Hills and Bondi searches.",
  },
  "au-brisbane": {
    id: "brisbane",
    label: "Brisbane",
    kicker: "City layer",
    greeting: "River-city subtropical",
    note: "Brighter green and heat-haze gold on the national layer.",
  },
  "au-perth": {
    id: "perth",
    label: "Perth",
    kicker: "City layer",
    greeting: "Indian Ocean evenings",
    note: "Ocean teal over west-coast sand.",
  },
  "au-adelaide": {
    id: "adelaide",
    label: "Adelaide",
    kicker: "City layer",
    greeting: "Church spires and the plains",
    note: "Wine-stone warmth on the Australian frame.",
  },
  "de-berlin": {
    id: "berlin",
    label: "Berlin",
    kicker: "City layer",
    greeting: "Kiez by Kiez",
    note: "U-Bahn yellow and concrete on the German charcoal frame — the keyword-volume capital.",
  },
  "de-munich": {
    id: "munich",
    label: "Munich",
    kicker: "City layer",
    greeting: "Altstadt and the trade-fair belt",
    note: "Alpine green and cream over precise German type.",
  },
  "de-hamburg": {
    id: "hamburg",
    label: "Hamburg",
    kicker: "City layer",
    greeting: "HafenCity and the Innenstadt",
    note: "Brick-warehouse red on maritime navy.",
  },
  "de-frankfurt": {
    id: "frankfurt",
    label: "Frankfurt",
    kicker: "City layer",
    greeting: "Banking district lunch hours",
    note: "Glass-skyline blue sitting on the national grid.",
  },
  "de-cologne": {
    id: "cologne",
    label: "Cologne",
    kicker: "City layer",
    greeting: "Dom and the Rhine",
    note: "Cathedral stone and river silver over German gold.",
  },
};

export type ResolvedTheme = {
  country: ThemeLayer | null;
  city: ThemeLayer | null;
  className: string;
};

export function resolveTheme(countryCode?: string | null, citySlug?: string | null): ResolvedTheme {
  const country = countryCode ? COUNTRY_LAYERS[countryCode] ?? null : null;
  const city = countryCode && citySlug ? CITY_LAYERS[`${countryCode}-${citySlug}`] ?? null : null;
  const classes = ["theme-base"];
  if (country) classes.push(`theme-${country.id}`);
  if (city) classes.push(`theme-${country?.id}-${city.id}`);
  return { country, city, className: classes.join(" ") };
}

export function themePhoto(theme: ResolvedTheme): string {
  if (!theme.country) return HERO_PHOTO;
  return theme.city ? cityPhoto(theme.country.id, theme.city.id) : countryPhoto(theme.country.id);
}

export function themeBand(theme: ResolvedTheme): string {
  if (!theme.country) return "";
  const city = theme.city;
  const photo = themePhoto(theme);
  const label = city ? `${theme.country.label} · ${city.label}` : theme.country.label;
  const greeting = city?.greeting ?? theme.country.greeting;
  const note = city?.note ?? theme.country.note;
  return `<aside class="place-hero" aria-label="Local look and feel">
    <img src="${escapeAttr(photo)}" alt="${escapeAttr(placePhotoAlt(label))}" width="1600" height="900">
    <div class="place-hero-scrim"></div>
    <div class="place-hero-copy">
      <span class="culture-kicker">${escapeHtml(label)}</span>
      <strong>${escapeHtml(greeting)}</strong>
      <p>${escapeHtml(note)}</p>
      ${city ? "" : `<p class="place-hero-hint">Choose a city below to open its origin story, local photography and studios.</p>`}
    </div>
  </aside>`;
}

export function cityThemeKeys(): string[] {
  return Object.keys(CITY_LAYERS);
}
