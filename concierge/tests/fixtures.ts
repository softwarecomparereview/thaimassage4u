import type { Flow, IndexListing, IndexManifest, SiteTaxonomy } from "@concierge/core";

export const taxonomy: SiteTaxonomy = {
  site: "test",
  placeKey: "city",
  facets: [
    {
      key: "service", label: "Treatment", askAs: "chips", weight: 1.0,
      values: [
        { slug: "thai", label: "Traditional Thai", synonyms: ["thai massage", "nuad"] },
        { slug: "deep-tissue", label: "Deep tissue", synonyms: ["deep", "sports", "knots", "sore", "back pain"] },
        { slug: "couples", label: "Couples room", synonyms: ["couple", "couples", "partner"] },
      ],
    },
    {
      key: "audience", label: "For", askAs: "chips", weight: 0.8,
      values: [
        { slug: "men", label: "Men", synonyms: ["men", "male"] },
        { slug: "women-only", label: "Women only", synonyms: ["women only", "ladies only"] },
      ],
    },
    {
      key: "budget", label: "Budget", askAs: "chips", weight: 0.6,
      values: [
        { slug: "low", label: "Under $80", synonyms: ["cheap", "budget", "affordable"] },
        { slug: "mid", label: "$80-150", synonyms: ["mid", "reasonable"] },
        { slug: "high", label: "Premium", synonyms: ["luxury", "premium", "best"] },
      ],
    },
  ],
};

export const manifest: IndexManifest = {
  site: "test",
  builtAt: "2026-01-01T00:00:00Z",
  version: 1,
  taxonomy,
  places: [
    { slug: "new-york", name: "New York", country: "us", shard: "new-york", count: 4, lat: 40.7128, lon: -74.006, aliases: ["nyc", "manhattan", "new york city"], priceBands: { p33: 80, p66: 150, currency: "USD" } },
    { slug: "miami", name: "Miami", country: "us", shard: "miami", count: 1, lat: 25.7617, lon: -80.1918, aliases: [] },
    { slug: "fort-lauderdale", name: "Fort Lauderdale", country: "us", shard: "fort-lauderdale", count: 2, lat: 26.1224, lon: -80.1373, aliases: [] },
  ],
};

function listing(partial: Partial<IndexListing> & Pick<IndexListing, "id" | "slug" | "name" | "city">): IndexListing {
  return {
    url: `/listing/${partial.slug}`,
    country: "us",
    cityName: partial.city === "new-york" ? "New York" : partial.city === "miami" ? "Miami" : "Fort Lauderdale",
    tier: "standard",
    claimed: false,
    facets: {},
    tokens: [],
    completeness: 0.5,
    ...partial,
  };
}

export const listings: IndexListing[] = [
  listing({ id: "1", slug: "siam-spa-new-york", name: "Siam Spa", city: "new-york", facets: { service: ["thai", "deep-tissue"] }, tokens: ["siam", "spa", "thai", "deep"], rating: 4.8, reviews: 120, priceFrom: 90, completeness: 0.9 }),
  listing({ id: "2", slug: "couple-massage-by-siam-and-spa-new-york", name: "Couple Massage by Siam and Spa", city: "new-york", facets: { service: ["couples"] }, tokens: ["couple", "massage", "siam", "spa"], rating: 4.9, reviews: 80, priceFrom: 60, completeness: 0.8 }),
  listing({ id: "3", slug: "budget-thai-new-york", name: "Budget Thai", city: "new-york", facets: { service: ["thai"] }, tokens: ["budget", "thai"], rating: 4.2, reviews: 30, priceFrom: 50, completeness: 0.6 }),
  listing({ id: "4", slug: "featured-thai-new-york", name: "Featured Thai Spa", city: "new-york", facets: { service: ["thai"] }, tokens: ["featured", "thai", "spa"], rating: 4.5, reviews: 60, priceFrom: 100, tier: "featured", completeness: 0.95 }),
  listing({ id: "5", slug: "solo-miami", name: "Solo Miami Spa", city: "miami", facets: { service: ["thai"] }, tokens: ["solo", "miami", "spa"], rating: 4.3, reviews: 40, priceFrom: 70, lat: 25.7617, lon: -80.1918, completeness: 0.7 }), // ~42km from Fort Lauderdale — inside the 60km near-miss radius
  listing({ id: "6", slug: "lauderdale-one", name: "Lauderdale One", city: "fort-lauderdale", facets: { service: ["couples"] }, tokens: ["lauderdale"], rating: 4.6, reviews: 20, lat: 26.12, lon: -80.14, completeness: 0.5 }),
  listing({ id: "7", slug: "lauderdale-two", name: "Lauderdale Two", city: "fort-lauderdale", facets: { service: ["couples"] }, tokens: ["lauderdale"], rating: 4.1, reviews: 15, lat: 26.13, lon: -80.13, completeness: 0.4 }),
];

export const flow: Flow = {
  greet: ["Hi — where are you looking"],
  ask: {
    place: { q: "Which city?" },
    service: { q: "What kind of treatment?" },
    audience: { q: "For a group, or women-only?" },
    budget: { q: "Any budget in mind?" },
  },
  askOrder: ["place", "service", "audience", "budget"],
  maxQuestions: 3,
  results: { intro: "Here's what I'd pick:", more: "A few more:", refine: "Updated:", none: "Nothing matches yet.", near: "Nothing quite like that in {place} — here's what's nearby:" },
  featuredLabel: "Featured",
  noun: "massage",
};

export function listingsForPlace(placeSlug: string): IndexListing[] {
  return listings.filter(l => l.city === placeSlug);
}
