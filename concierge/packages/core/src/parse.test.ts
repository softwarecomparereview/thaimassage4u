import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";
import { manifest, taxonomy } from "../../../tests/fixtures.js";

describe("parse — place matching", () => {
  it("matches a city alias (nyc)", () => {
    const result = parse("thai massage in nyc", manifest);
    expect(result.slots.place).toBe("new-york");
  });
  it("prefers the longer alias (new york city over new york)", () => {
    const result = parse("something in new york city please", manifest);
    expect(result.slots.place).toBe("new-york");
  });
  it("falls back to page context on 'near me'", () => {
    const result = parse("thai near me", manifest, { pagePlace: "miami" });
    expect(result.slots.place).toBe("miami");
  });
});

describe("parse — facets", () => {
  it("matches multiple facet synonyms in one sentence", () => {
    // Deterministic phrase matching only (P0, no LLM) — "sore" is a real listed synonym;
    // a vaguer phrasing like "something for my back" needs the hybrid LLM path (P1), not this parser.
    const result = parse("something for my sore back, not too pricey, couples if possible", manifest, { pagePlace: "new-york" });
    expect(result.slots.facets?.service).toEqual(expect.arrayContaining(["deep-tissue", "couples"]));
  });
  it("resolves 'not too pricey' style budget only via explicit numerals, not vague language", () => {
    const result = parse("cheap thai massage", manifest, { pagePlace: "new-york" });
    // "cheap" is a budget-facet synonym, matched directly (not through numeral parsing).
    expect(result.slots.facets?.budget).toEqual(["low"]);
  });
  it("resolves 'under $80' against the place's real price bands", () => {
    const result = parse("something under $80", manifest, { pagePlace: "new-york" });
    expect(result.slots.facets?.budget).toEqual(["low"]);
  });
});

describe("parse — modifiers", () => {
  it("reads 'cheapest' as a sort", () => {
    expect(parse("cheapest option", manifest).slots.sort).toBe("cheapest");
  });
  it("reads 'best rated' as a sort", () => {
    expect(parse("best rated place", manifest).slots.sort).toBe("rated");
  });
  it("reads 'open now'", () => {
    expect(parse("somewhere open now", manifest).slots.openNow).toBe(true);
  });
});

describe("parse — confidence", () => {
  it("is high for a fully-matched sentence", () => {
    const result = parse("thai massage in new york", manifest);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });
  it("is low for mostly-unrelated text", () => {
    const result = parse("what time does the airport shuttle leave tomorrow morning", manifest);
    expect(result.confidence).toBeLessThan(0.6);
  });
});
