// §6.2 Deterministic parser. Runtime-LLM (packages/worker's /api/concierge/parse) is a
// fallback for what THIS function leaves unmatched — see the hybrid trigger in the widget's
// dialog engine (§6.2's confidence<0.6 && contentTokens>=3 rule, applied in dialog.ts).

import { normalise, parseBudgetHint, tokenize } from "./tokenize.js";
import type { IndexManifest, ParseResult, SiteTaxonomy, Slots } from "./types.js";

export interface ParseContext {
  pagePlace?: string;
  near?: { lat: number; lon: number };
}

/** Longest-alias-first phrase match against normalised text — so "new york city" beats "new york" beats "new". */
function matchPlace(normalisedText: string, manifest: IndexManifest): { slug: string; matchedLength: number } | null {
  type Candidate = { slug: string; phrase: string };
  const candidates: Candidate[] = [];
  for (const place of manifest.places) {
    candidates.push({ slug: place.slug, phrase: normalise(place.name) });
    candidates.push({ slug: place.slug, phrase: normalise(place.slug.replace(/-/g, " ")) });
    for (const alias of place.aliases) candidates.push({ slug: place.slug, phrase: normalise(alias) });
  }
  candidates.sort((a, b) => b.phrase.length - a.phrase.length);
  for (const candidate of candidates) {
    if (!candidate.phrase) continue;
    const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(candidate.phrase)}(?:\\s|$)`);
    if (pattern.test(` ${normalisedText} `)) return { slug: candidate.slug, matchedLength: candidate.phrase.split(" ").length };
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-token, longest-synonym-first match for a single facet's values against normalised text. */
function matchFacetValues(normalisedText: string, taxonomy: SiteTaxonomy): { facets: Record<string, string[]>; consumedTokenSpans: string[] } {
  const facets: Record<string, string[]> = {};
  const consumedTokenSpans: string[] = [];
  const padded = ` ${normalisedText} `;

  for (const facet of taxonomy.facets) {
    type SynCandidate = { value: string; synonym: string };
    const candidates: SynCandidate[] = [];
    for (const value of facet.values) {
      for (const synonym of [value.label, ...value.synonyms]) {
        candidates.push({ value: value.slug, synonym: normalise(synonym) });
      }
    }
    candidates.sort((a, b) => b.synonym.length - a.synonym.length);
    for (const candidate of candidates) {
      if (!candidate.synonym) continue;
      const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(candidate.synonym)}(?:\\s|$)`);
      if (pattern.test(padded)) {
        facets[facet.key] = facets[facet.key] ?? [];
        if (!facets[facet.key].includes(candidate.value)) facets[facet.key].push(candidate.value);
        consumedTokenSpans.push(candidate.synonym);
      }
    }
  }
  return { facets, consumedTokenSpans };
}

const OPEN_NOW = /\b(open now|open tonight|open late|tonight|late)\b/;
const SORT_CHEAP = /\b(cheapest|cheap)\b/;
const SORT_RATED = /\b(best rated|top rated|highest rated|highest)\b/;
const SORT_NEAR = /\b(closest|nearest|nearby|walking distance|walking)\b/;

export function parse(text: string, manifest: IndexManifest, ctx: ParseContext = {}): ParseResult {
  const normalisedText = normalise(text);
  const { tokens, contentCount } = tokenize(text);
  const slots: Partial<Slots> = { facets: {} };
  let matchedTokenCount = 0;

  // 1. Place.
  const placeMatch = matchPlace(normalisedText, manifest);
  if (placeMatch) {
    slots.place = placeMatch.slug;
    matchedTokenCount += placeMatch.matchedLength;
  } else if (/\bnear me\b/.test(normalisedText) && ctx.pagePlace) {
    slots.place = ctx.pagePlace;
  } else if (ctx.pagePlace) {
    // Page context counts as a matched slot per §6.2 step 4, but doesn't consume tokens.
    slots.place = ctx.pagePlace;
  }
  if (ctx.near) slots.near = ctx.near;

  // 2. Facets.
  const { facets, consumedTokenSpans } = matchFacetValues(normalisedText, manifest.taxonomy);
  if (Object.keys(facets).length) slots.facets = facets;
  for (const span of consumedTokenSpans) matchedTokenCount += span.split(" ").length;

  // Budget numerals ("under $80", "$80-150") resolve against the matched place's price bands.
  const budgetHint = parseBudgetHint(text);
  if (budgetHint) {
    const place = manifest.places.find(p => p.slug === slots.place);
    const bands = place?.priceBands;
    if (bands) {
      const amount = budgetHint.kind === "under" ? budgetHint.amount : (budgetHint.low + budgetHint.high) / 2;
      const band = amount <= bands.p33 ? "low" : amount <= bands.p66 ? "mid" : "high";
      slots.facets = slots.facets ?? {};
      slots.facets.budget = [...new Set([...(slots.facets.budget ?? []), band])];
      matchedTokenCount += 2;
    }
  }

  // 3. Modifiers.
  if (OPEN_NOW.test(normalisedText)) { slots.openNow = true; matchedTokenCount += 1; }
  if (SORT_CHEAP.test(normalisedText)) { slots.sort = "cheapest"; matchedTokenCount += 1; }
  else if (SORT_RATED.test(normalisedText)) { slots.sort = "rated"; matchedTokenCount += 1; }
  else if (SORT_NEAR.test(normalisedText)) { slots.sort = "nearest"; matchedTokenCount += 1; }

  // 4. Confidence = matchedTokens / contentTokens.
  const confidence = contentCount === 0 ? 1 : Math.min(1, matchedTokenCount / contentCount);

  // 5. Unmatched = content tokens not consumed by any rule (approximate: tokens whose text
  // doesn't appear inside any matched phrase — good enough for the hybrid trigger and for
  // logging leak-detector candidates in §8's /api/concierge/parse miss log).
  const consumedText = [placeMatch?.slug, ...consumedTokenSpans].filter(Boolean).join(" ");
  const unmatched = tokens.filter(token => !consumedText.includes(token));

  return { slots, confidence, unmatched };
}

/** Merge rule: LLM slots (or any secondary parse) fill only what's empty — deterministic never overwritten. §6.2 hybrid trigger. */
export function mergeSlots(base: Partial<Slots>, extra: Partial<Slots>): Partial<Slots> {
  const merged: Partial<Slots> = { ...base, facets: { ...(base.facets ?? {}) } };
  if (merged.place === undefined && extra.place !== undefined) merged.place = extra.place;
  if (merged.near === undefined && extra.near !== undefined) merged.near = extra.near;
  if (merged.openNow === undefined && extra.openNow !== undefined) merged.openNow = extra.openNow;
  if (merged.sort === undefined && extra.sort !== undefined) merged.sort = extra.sort;
  for (const [key, values] of Object.entries(extra.facets ?? {})) {
    if (!merged.facets![key]) merged.facets![key] = values;
  }
  return merged;
}
