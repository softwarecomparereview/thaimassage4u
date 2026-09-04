// §5 steps 2, 4-8: rule-tag facets, apply overrides, derive budget/tier/completeness/tokens.
// Step 3 (LLM-tag the remainder) is P1 — not implemented here; `--no-llm` (the only mode this
// package currently has) always skips it, so every listing this build produces was tagged by
// a real synonym hit or is left with an empty facet array (never guessed).

import { normalise, tokensFor } from "@concierge/core";
import type { IndexListing, SiteTaxonomy, Tier } from "@concierge/core";
import type { RawListing } from "./adapters/quiet-hour.js";

export type Override = Record<string, Record<string, string[]>>; // listing id -> facetKey -> values

/** §5 step 2: run every synonym in the taxonomy against name+descriptor+description+services, whole-phrase match. */
export function ruleTagFacets(listing: RawListing, taxonomy: SiteTaxonomy): Record<string, string[]> {
  let serviceTitles = "";
  if (listing.services) {
    try {
      const parsed = JSON.parse(listing.services);
      if (Array.isArray(parsed)) serviceTitles = parsed.map(s => (typeof s === "string" ? s : s?.title ?? s?.name ?? "")).join(" ");
    } catch {
      serviceTitles = listing.services;
    }
  }
  const haystack = normalise([listing.name, listing.descriptor, listing.description, serviceTitles].filter(Boolean).join(" "));
  const padded = ` ${haystack} `;
  const facets: Record<string, string[]> = {};
  for (const facet of taxonomy.facets) {
    for (const value of facet.values) {
      const hit = [value.label, ...value.synonyms].some(syn => {
        const needle = normalise(syn);
        return needle && padded.includes(` ${needle} `);
      });
      if (hit) {
        facets[facet.key] = facets[facet.key] ?? [];
        if (!facets[facet.key].includes(value.slug)) facets[facet.key].push(value.slug);
      }
    }
  }
  return facets;
}

export function applyOverride(facets: Record<string, string[]>, override?: Record<string, string[]>): Record<string, string[]> {
  if (!override) return facets;
  return { ...facets, ...override };
}

export interface PriceBand { p33: number; p66: number }

/** §5 step 5: budget percentile within the listing's city. Never guessed when priceFrom is absent. */
export function computePriceBands(listings: RawListing[]): Map<string, PriceBand> {
  const byCity = new Map<string, number[]>();
  for (const listing of listings) {
    if (listing.price_from === null) continue;
    const key = listing.city_slug;
    if (!byCity.has(key)) byCity.set(key, []);
    byCity.get(key)!.push(listing.price_from);
  }
  const bands = new Map<string, PriceBand>();
  for (const [city, prices] of byCity) {
    const sorted = [...prices].sort((a, b) => a - b);
    const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    bands.set(city, { p33: pick(0.33), p66: pick(0.66) });
  }
  return bands;
}

export function budgetFacet(priceFrom: number | null, band: PriceBand | undefined): string[] {
  if (priceFrom === null || !band) return [];
  if (priceFrom <= band.p33) return ["low"];
  if (priceFrom <= band.p66) return ["mid"];
  return ["high"];
}

/** §5 step 6: isFeatured || isPremium -> featured; else standard. 'premium' tier is reserved (unused today). */
export function computeTier(listing: RawListing): Tier {
  return listing.premium ? "featured" : "standard";
}

/** §5 step 7: fraction of {descriptor, image, phone, bookingUrl, rating, >=1 service} present. (hours omitted — not in this schema yet.) */
export function computeCompleteness(listing: RawListing): number {
  let servicesCount = 0;
  if (listing.services) {
    try {
      const parsed = JSON.parse(listing.services);
      servicesCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      servicesCount = listing.services.trim().length > 0 ? 1 : 0;
    }
  }
  const checks = [
    Boolean(listing.descriptor),
    Boolean(listing.image_url),
    Boolean(listing.phone),
    Boolean(listing.website),
    listing.rating !== null,
    servicesCount > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

export function toIndexListing(listing: RawListing, taxonomy: SiteTaxonomy, cityName: string, priceBands: Map<string, PriceBand>, override?: Override): IndexListing {
  const ruleFacets = ruleTagFacets(listing, taxonomy);
  const facets = applyOverride(ruleFacets, override?.[String(listing.id)]);
  const budget = budgetFacet(listing.price_from, priceBands.get(listing.city_slug));
  if (budget.length) facets.budget = budget;

  let serviceTitles: string[] = [];
  if (listing.services) {
    try {
      const parsed = JSON.parse(listing.services);
      if (Array.isArray(parsed)) serviceTitles = parsed.map(s => (typeof s === "string" ? s : s?.title ?? s?.name ?? "")).filter(Boolean);
    } catch {
      serviceTitles = [listing.services];
    }
  }

  return {
    id: String(listing.id),
    slug: listing.slug,
    url: `/listing/${listing.slug}`,
    name: listing.name,
    descriptor: listing.descriptor ?? undefined,
    city: listing.city_slug,
    cityName,
    country: listing.country_code,
    hood: listing.suburb ?? undefined,
    lat: listing.lat ?? undefined,
    lon: listing.lon ?? undefined,
    rating: listing.rating ?? undefined,
    reviews: listing.review_count ?? undefined,
    priceFrom: listing.price_from ?? undefined,
    currency: listing.currency ?? undefined,
    tier: computeTier(listing),
    claimed: Boolean(listing.claimed),
    bookingUrl: listing.website ?? undefined,
    phone: listing.phone ?? undefined,
    imageUrl: listing.image_url ?? undefined,
    facets,
    tokens: tokensFor([listing.name, listing.descriptor ?? undefined, listing.suburb ?? undefined, ...serviceTitles]),
    completeness: computeCompleteness(listing),
  };
}
