export type LeadMessage =
  | { kind: "offer" | "claim" | "contact"; id: string }
  | { kind: "scrape-city" | "enrich-city" | "serp-city"; countryCode: string; citySlug: string }
  | { kind: "thumbnail"; slug: string };
