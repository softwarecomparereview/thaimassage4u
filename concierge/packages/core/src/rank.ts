// §6.3 Ranker + §6.3's near-miss relaxation ladder.

import { tokenize } from "./tokenize.js";
import type { IndexListing, IndexManifest, Scored, SiteTaxonomy, Slots } from "./types.js";

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let intersection = 0;
  const union = new Set([...a, ...b]);
  for (const token of a) if (setB.has(token)) intersection++;
  return union.size === 0 ? 0 : intersection / union.size;
}

/** Bayesian-average quality, rescaled from a [3.5, 5] plausible range down to [0, 1]. */
function qualityScore(listing: IndexListing): number {
  if (listing.rating === undefined || listing.reviews === undefined) return 0;
  const bayesian = (listing.rating * listing.reviews + 4.3 * 20) / (listing.reviews + 20);
  return Math.max(0, Math.min(1, (bayesian - 3.5) / (5 - 3.5)));
}

function facetMatchScore(listing: IndexListing, facetKey: string, chosen: string[]): number {
  const listingValues = listing.facets[facetKey];
  if (!listingValues || listingValues.length === 0) return 0.5; // unknown != negative — thin listings aren't buried
  return listingValues.some(v => chosen.includes(v)) ? 1 : 0;
}

export interface RankOptions {
  queryTokens?: string[];
}

/** Hard filters — place, openNow. Anything failing these never enters scoring. */
export function applyHardFilters(listings: IndexListing[], slots: Partial<Slots>, radiusKm = 25): IndexListing[] {
  return listings.filter(listing => {
    if (slots.place && listing.city !== slots.place) {
      if (!slots.near || listing.lat === undefined || listing.lon === undefined) return false;
      if (haversineKm(slots.near, { lat: listing.lat, lon: listing.lon }) > radiusKm) return false;
    }
    // openNow: listings without hours data pass through (flagged, not excluded) — hours aren't
    // in IndexListing today (no site adapter emits them yet), so this is a no-op filter until
    // one does; kept here so the contract holds when hours land.
    return true;
  });
}

export function rank(listings: IndexListing[], slots: Partial<Slots>, taxonomy: SiteTaxonomy, options: RankOptions = {}): Scored[] {
  const queryTokens = options.queryTokens ?? [];
  const facetEntries = Object.entries(slots.facets ?? {});

  const scored: Scored[] = listings.map(listing => {
    let score = 0;
    const reasons: string[] = [];

    for (const facet of taxonomy.facets) {
      const chosen = slots.facets?.[facet.key];
      if (!chosen || chosen.length === 0) continue;
      const match = facetMatchScore(listing, facet.key, chosen);
      score += facet.weight * match;
      if (match === 1) {
        const value = facet.values.find(v => listing.facets[facet.key]?.includes(v.slug) && chosen.includes(v.slug));
        if (value) reasons.push(`Offers ${value.label}`);
      }
    }

    const textMatch = queryTokens.length ? jaccard(queryTokens, listing.tokens) : 0;
    score += 0.6 * textMatch;

    const quality = qualityScore(listing);
    score += 0.5 * quality;
    if (listing.rating !== undefined && listing.reviews !== undefined && quality > 0) {
      reasons.push(`${listing.rating.toFixed(1)}★ from ${listing.reviews} reviews`);
    }

    let proximity = 0;
    if (slots.near && listing.lat !== undefined && listing.lon !== undefined) {
      const distKm = haversineKm(slots.near, { lat: listing.lat, lon: listing.lon });
      proximity = 1 - Math.min(distKm / 10, 1);
      score += 0.3 * proximity;
      if (proximity > 0) reasons.push(`${distKm.toFixed(1)} km away`);
    }

    score += 0.2 * listing.completeness;

    if (listing.hood && reasons.length < 2) reasons.push(`In ${listing.hood}`);

    return { listing, score, reasons: reasons.slice(0, 2), boosted: false };
  });

  if (scored.length === 0) return scored;

  const top = Math.max(...scored.map(s => s.score));
  for (const entry of scored) {
    if (entry.listing.tier === "featured" && entry.score >= 0.7 * top) {
      entry.score += 0.15 * top;
      entry.boosted = true;
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Guarantee: if any non-featured listing exists in the candidate set, at least one appears
  // in the first 3 — swap the 3rd slot if the boost pushed featured listings to sweep the top.
  const top3 = scored.slice(0, 3);
  const hasNonFeatured = top3.some(entry => entry.listing.tier !== "featured");
  if (!hasNonFeatured) {
    const firstNonFeatured = scored.slice(3).find(entry => entry.listing.tier !== "featured");
    if (firstNonFeatured) {
      const displaced = scored[2];
      scored[2] = firstNonFeatured;
      const displacedIndex = scored.indexOf(firstNonFeatured, 3);
      if (displacedIndex !== -1) scored[displacedIndex] = displaced;
    }
  }

  if (slots.sort === "rated") scored.sort((a, b) => (b.listing.rating ?? 0) - (a.listing.rating ?? 0));
  else if (slots.sort === "cheapest") scored.sort((a, b) => (a.listing.priceFrom ?? Infinity) - (b.listing.priceFrom ?? Infinity));
  else if (slots.sort === "nearest" && slots.near) {
    scored.sort((a, b) => {
      const distA = a.listing.lat !== undefined ? haversineKm(slots.near!, { lat: a.listing.lat, lon: a.listing.lon! }) : Infinity;
      const distB = b.listing.lat !== undefined ? haversineKm(slots.near!, { lat: b.listing.lat, lon: b.listing.lon! }) : Infinity;
      return distA - distB;
    });
  }

  return scored;
}

export type Relaxation = "budget" | "audience" | "place-radius" | "openNow";

/**
 * §6.3 near-miss set: if <3 candidates pass filters, relax in this order and stop at the
 * first relaxation that produces >=3. Returns null if even full relaxation doesn't reach 3
 * (caller falls through to the zero-result path). Takes the manifest (not just taxonomy) so
 * the place-radius step can anchor `near` on the current place's own centroid — without that,
 * widening the radius number alone does nothing, since the hard filter only consults radius
 * once `slots.near` is set at all.
 */
export function relax(
  listings: IndexListing[],
  slots: Partial<Slots>,
  manifest: IndexManifest,
  minCount = 3,
): { slots: Partial<Slots>; relaxed: Relaxation[] } | null {
  const steps: Relaxation[] = ["budget", "audience", "place-radius", "openNow"];
  let current = { ...slots, facets: { ...(slots.facets ?? {}) } };
  const applied: Relaxation[] = [];

  const countFor = (candidate: Partial<Slots>, radiusKm: number) => applyHardFilters(listings, candidate, radiusKm).length;
  if (countFor(current, 25) >= minCount) return null; // caller shouldn't have called relax at all

  let radiusKm = 25;
  for (const step of steps) {
    if (step === "budget" && current.facets?.budget) {
      const { budget, ...rest } = current.facets;
      current = { ...current, facets: rest };
    } else if (step === "audience" && current.facets?.audience) {
      const { audience, ...rest } = current.facets;
      current = { ...current, facets: rest };
    } else if (step === "place-radius") {
      const place = manifest.places.find(p => p.slug === current.place);
      if (!place || current.near) continue; // no centroid to anchor on, or already searching near a point
      current = { ...current, near: { lat: place.lat, lon: place.lon } };
      radiusKm = 60;
    } else if (step === "openNow" && current.openNow) {
      current = { ...current, openNow: false };
    } else {
      continue; // this step had nothing to relax, move on without counting as applied
    }
    applied.push(step);
    if (countFor(current, radiusKm) >= minCount) return { slots: current, relaxed: applied };
  }
  return countFor(current, radiusKm) > 0 ? { slots: current, relaxed: applied } : null;
}
