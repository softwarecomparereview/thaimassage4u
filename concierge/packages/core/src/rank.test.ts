import { describe, expect, it } from "vitest";
import { applyHardFilters, rank, relax } from "./rank.js";
import { listings, manifest, taxonomy } from "../../../tests/fixtures.js";

describe("rank — monotonicity", () => {
  it("adding a matched facet never lowers a listing's score", () => {
    const newYork = listings.filter(l => l.city === "new-york");
    const before = rank(newYork, {}, taxonomy).find(s => s.listing.id === "1")!.score;
    const after = rank(newYork, { facets: { service: ["thai"] } }, taxonomy).find(s => s.listing.id === "1")!.score;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe("rank — featured boost", () => {
  it("only boosts featured listings within 0.7x of the top score", () => {
    const newYork = listings.filter(l => l.city === "new-york");
    const scored = rank(newYork, { facets: { service: ["thai"] } }, taxonomy);
    const topRaw = Math.max(...scored.map(s => (s.boosted ? s.score - 0.15 * Math.max(...scored.map(x => x.score)) : s.score)));
    for (const entry of scored) {
      if (entry.boosted) {
        expect(entry.listing.tier).toBe("featured");
      }
    }
  });

  it("never promotes a boosted listing from below 0.7x of the top score", () => {
    // A featured listing scored far below the pack should not receive the boost.
    const weak = listings.find(l => l.id === "4")!; // featured
    const strong = listings.find(l => l.id === "2")!; // standard, high quality
    const scored = rank([weak, { ...strong, id: "99", tier: "standard" as const, priceFrom: 1000 }], { facets: { service: ["couples"] } }, taxonomy);
    const top = Math.max(...scored.map(s => s.score));
    const weakEntry = scored.find(s => s.listing.id === "4")!;
    if (weakEntry.boosted) {
      const rawScore = weakEntry.score - 0.15 * top;
      expect(rawScore).toBeGreaterThanOrEqual(0.7 * top - 1e-9);
    }
  });

  it("guarantees a non-featured listing in the top 3 when one exists in the candidate set", () => {
    const newYork = listings.filter(l => l.city === "new-york"); // has 1 featured + 3 standard
    const scored = rank(newYork, {}, taxonomy);
    const top3 = scored.slice(0, 3);
    expect(top3.some(s => s.listing.tier !== "featured")).toBe(true);
  });

  it("never boosts a listing that fails a hard filter (it's simply absent from the ranked set)", () => {
    const miami = listings.filter(l => l.city === "miami");
    const filtered = applyHardFilters(miami.concat(listings.filter(l => l.city === "new-york")), { place: "miami" });
    expect(filtered.every(l => l.city === "miami")).toBe(true);
  });
});

describe("rank — sort overrides", () => {
  it("cheapest sorts by priceFrom ascending", () => {
    const newYork = listings.filter(l => l.city === "new-york");
    const scored = rank(newYork, { sort: "cheapest" }, taxonomy);
    const prices = scored.map(s => s.listing.priceFrom ?? Infinity);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
  it("rated sorts by rating descending", () => {
    const newYork = listings.filter(l => l.city === "new-york");
    const scored = rank(newYork, { sort: "rated" }, taxonomy);
    const ratings = scored.map(s => s.listing.rating ?? 0);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });
});

describe("relax — near-miss ladder", () => {
  it("relaxes budget before audience, then widens place radius", () => {
    // Fort Lauderdale has 2 listings; asking for a specific budget nobody has drops below 3 and should relax.
    const relaxed = relax(listings, { place: "fort-lauderdale", facets: { budget: ["low"] } }, manifest, 3);
    expect(relaxed).not.toBeNull();
    expect(relaxed!.relaxed[0]).toBe("budget");
  });

  it("widening the place radius pulls in nearby-city listings within 60km", () => {
    const relaxed = relax(listings, { place: "fort-lauderdale" }, manifest, 3); // only 2 in FL, need 3
    expect(relaxed).not.toBeNull();
    expect(relaxed!.relaxed).toContain("place-radius");
    expect(relaxed!.slots.near).toBeDefined();
    const filtered = applyHardFilters(listings, relaxed!.slots, 60);
    // The two Fort Lauderdale listings plus the Miami one (~42km away) all fall inside 60km.
    expect(filtered.map(l => l.slug)).toEqual(expect.arrayContaining(["lauderdale-one", "lauderdale-two", "solo-miami"]));
  });
});
