import { describe, expect, it } from "vitest";
import { normalise, parseBudgetHint, tokenize, tokensFor } from "./tokenize.js";

describe("normalise", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalise("Something for MY back, not too pricey!")).toBe("something for my back not too pricey");
  });
  it("keeps $-prefixed numerals", () => {
    expect(normalise("under $80 please")).toBe("under $80 please");
  });
});

describe("tokenize", () => {
  it("drops stopwords and stems plurals", () => {
    const { tokens } = tokenize("looking for the best massages near me");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("for");
    expect(tokens).toContain("massage"); // "massages" stemmed
  });
  it("contentCount matches tokens.length", () => {
    const result = tokenize("deep tissue for sore back");
    expect(result.contentCount).toBe(result.tokens.length);
  });
});

describe("tokensFor", () => {
  it("dedupes and caps at max", () => {
    const tokens = tokensFor(["thai thai thai massage", "thai spa"], 3);
    expect(tokens.length).toBeLessThanOrEqual(3);
    expect(new Set(tokens).size).toBe(tokens.length);
  });
});

describe("parseBudgetHint", () => {
  it("reads 'under $80'", () => {
    expect(parseBudgetHint("something under $80 please")).toEqual({ kind: "under", amount: 80 });
  });
  it("reads a range '80-150'", () => {
    expect(parseBudgetHint("between $80-150")).toEqual({ kind: "range", low: 80, high: 150 });
  });
  it("returns null with no budget language", () => {
    expect(parseBudgetHint("a nice thai massage")).toBeNull();
  });
});
