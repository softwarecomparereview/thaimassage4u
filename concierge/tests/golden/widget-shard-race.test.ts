// Regression test for a real bug found against production: a user's first message naming a
// city as free text ("melbourne") got "Nothing matches that exactly yet" even though Melbourne
// had 60 real listings. Root cause was in packages/widget/src/main.ts's handle(): it only
// awaited ensurePlaceLoaded() for a place already known before the turn, or a chip answer —
// never for a place the dialog engine was about to discover FOR THE FIRST TIME from free text.
// stepAsync/step() ran, called listingsForPlace() against an empty (not-yet-fetched) shard
// cache, and the ranker + near-miss relaxation ladder both correctly found nothing to rank.
//
// This can't be unit-tested against the real ConciergeWidget class without a DOM/Shadow DOM
// harness this repo doesn't have yet, but the bug and the fix are both about ONE thing: whether
// the caller resolves and loads the place BEFORE calling step(), or after. This test proves the
// fix's premise directly — the same `parse()` the widget now calls up front correctly identifies
// the place early enough to load its shard before the dialog engine needs it.
import { describe, expect, it } from "vitest";
import { openGreeting, parse, step } from "@concierge/core";
import { flow, listingsForPlace, manifest, taxonomy } from "../fixtures.js";

describe("widget shard race — regression for 'could not recognize melbourne'", () => {
  it("BUG: calling step() before the newly-named place's shard loads finds nothing, even though real listings exist", () => {
    const deps = { manifest, taxonomy, flow, listingsForPlace: () => [] }; // shard not loaded yet — the bug's exact condition
    const opened = openGreeting({ path: "/" }, deps);
    const result = step(opened.state, { kind: "text", value: "new york" }, deps);
    expect(result.cards).toBeUndefined(); // the dead end a real visitor hit — zero candidates, no cards rendered at all
    expect(result.messages[0].text).toBe(flow.results.none);
  });

  it("FIX: parsing the text first, loading the shard, THEN calling step() actually finds New York's listings", () => {
    const deps = { manifest, taxonomy, flow, listingsForPlace }; // shard "loaded" (fixtures are synchronous, but the shape matches ensurePlaceLoaded having already resolved)
    const opened = openGreeting({ path: "/" }, deps);
    // This is exactly what packages/widget/src/main.ts's handle() now does before calling
    // stepAsync: parse the free text up front to discover the place early.
    const preview = parse("new york", manifest, { pagePlace: opened.state.slots.place });
    expect(preview.slots.place).toBe("new-york"); // confirms the parse-before-load premise holds
    const result = step(opened.state, { kind: "text", value: "new york" }, deps);
    // Naming just a city with no other facet correctly asks the next question rather than
    // jumping to results (up to 3 questions is the whole point of the dialog engine) — the bug
    // wasn't "no question is asked", it was "the dead-end 'nothing matches' message fires
    // because the place's listings were invisible". The regression signal is that this is NOT
    // that dead end, and the chips offered are real facet values drawn from New York's actual
    // listings, not an empty set.
    expect(result.messages[0].text).not.toBe(flow.results.none);
    expect(result.chips?.length).toBeGreaterThan(0);
  });
});
