// Data contracts — the shape every site adapter, the ranker, and the widget agree on.
// Copied verbatim from the build brief (§3). Do not add fields without updating both the
// build pipeline (packages/build) and the widget renderer (packages/widget).

export type Tier = "featured" | "premium" | "standard";

export interface IndexListing {
  id: string; // stable site id
  slug: string;
  url: string; // absolute path e.g. /listing/x or /studio/x
  name: string;
  descriptor?: string; // one-liner shown on card
  city: string; // slug
  cityName: string;
  country: string; // ISO2 lower
  hood?: string; // neighbourhood
  lat?: number;
  lon?: number;
  rating?: number;
  reviews?: number;
  priceFrom?: number;
  currency?: string;
  tier: Tier;
  claimed: boolean;
  bookingUrl?: string;
  phone?: string;
  imageUrl?: string;
  facets: Record<string, string[]>; // facetKey -> value slugs, from site taxonomy
  tokens: string[]; // pre-normalised text tokens (name, descriptor, services) for text match
  completeness: number; // 0..1, computed at build
}

export interface FacetValue {
  slug: string;
  label: string;
  synonyms: string[];
}

export interface FacetDef {
  key: string; // 'service' | 'audience' | 'setting' | 'budget' | 'look' ...
  label: string;
  values: FacetValue[];
  askAs?: "chips" | "multi" | "never"; // whether the dialog may ask for it
  weight: number; // in ranker
}

export interface SiteTaxonomy {
  site: string;
  facets: FacetDef[];
  placeKey: "city";
}

export interface IndexShard {
  // one per city (or per country if <300 listings)
  site: string;
  shard: string;
  builtAt: string;
  listings: IndexListing[];
}

export interface ManifestPlace {
  slug: string;
  name: string;
  country: string;
  shard: string;
  count: number;
  lat: number;
  lon: number;
  aliases: string[]; // lets the parser map "nyc" / "manhattan" -> the city slug
  priceBands?: { p33: number; p66: number; currency: string };
}

export interface IndexManifest {
  site: string;
  builtAt: string;
  version: 1;
  places: ManifestPlace[];
  taxonomy: SiteTaxonomy;
}

export interface Slots {
  // what the dialog is trying to fill
  place?: string; // city slug
  facets: Record<string, string[]>; // facetKey -> chosen values
  near?: { lat: number; lon: number }; // from geolocation or hood
  openNow?: boolean;
  sort?: "best" | "rated" | "nearest" | "cheapest";
}

export interface ParseResult {
  slots: Partial<Slots>;
  confidence: number;
  unmatched: string[];
}

export interface Scored {
  listing: IndexListing;
  score: number;
  reasons: string[];
  boosted: boolean;
}

export interface FlowAsk {
  q: string;
  chips?: string[];
  skip?: string;
}

export interface Flow {
  // sites/<x>/flow.json
  greet: string[]; // rotate
  ask: Record<string, FlowAsk>; // slotKey -> question
  askOrder: string[]; // e.g. ['place','service','audience']
  maxQuestions: number; // default 3
  results: { intro: string; more: string; refine: string; none: string; near: string };
  featuredLabel: string; // 'Featured'
  noun: string; // "massage" / "studio" — used in the launcher pill
}

/** Page context the widget seeds the conversation from — a listing/city/style page. */
export interface PageContext {
  path: string;
  pagePlace?: string; // city slug inferred from the URL
  pageFacets?: Record<string, string[]>; // e.g. /style/{look} -> facets.look
}

export interface DialogState {
  slots: Slots;
  asked: string[];
  turn: number;
  results?: Scored[];
  offset: number;
  open: boolean;
}

export interface DialogMessage {
  role: "bot" | "user";
  text: string;
}

export interface DialogStepResult {
  state: DialogState;
  messages: DialogMessage[];
  cards?: Scored[];
  chips?: string[];
  showTextInput: boolean;
}
