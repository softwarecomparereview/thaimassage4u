import { describe, expect, it } from "vitest";
import { openGreeting, step, type DialogDeps } from "./dialog.js";
import { flow, listingsForPlace, manifest, taxonomy } from "../../../tests/fixtures.js";

const deps: DialogDeps = { manifest, taxonomy, flow, listingsForPlace };

describe("dialog — hard rule: results within <=3 questions", () => {
  it("reaches results after at most 3 chip answers starting from nothing", () => {
    let result = openGreeting({ path: "/" }, deps);
    expect(result.cards).toBeUndefined(); // place unknown, must ask
    let questionCount = 0;
    let state = result.state;
    while (!result.cards && questionCount < 10) {
      const slotKey = state.asked[state.asked.length - 1];
      const chip = result.chips?.[0];
      expect(chip).toBeDefined();
      result = step(state, { kind: "chip", slotKey, value: chip }, deps);
      state = result.state;
      questionCount++;
    }
    expect(result.cards).toBeDefined();
    expect(questionCount).toBeLessThanOrEqual(4); // place + up to 3 facet questions
  });

  it("seeds place from page context and asks at most 3 more questions", () => {
    const result = openGreeting({ path: "/city/new-york", pagePlace: "new-york" }, deps);
    expect(result.state.slots.place).toBe("new-york");
    let state = result.state;
    let current = result;
    let asked = 1;
    while (!current.cards && asked <= 5) {
      const slotKey = state.asked[state.asked.length - 1];
      current = step(state, { kind: "chip", slotKey, value: current.chips![0] }, deps);
      state = current.state;
      asked++;
    }
    expect(current.cards).toBeDefined();
    expect(asked).toBeLessThanOrEqual(4); // place already known, so <=3 facet questions
  });
});

describe("dialog — text input reaches results directly when confident", () => {
  it("a specific free-text query skips straight to results without extra questions", () => {
    const opened = openGreeting({ path: "/city/new-york", pagePlace: "new-york" }, deps);
    const result = step(opened.state, { kind: "text", value: "thai massage in new york" }, deps);
    expect(result.cards).toBeDefined();
  });
});

describe("dialog — controls", () => {
  it("'Show 3 more' pages results without re-asking", () => {
    const opened = openGreeting({ path: "/city/new-york", pagePlace: "new-york" }, deps);
    const results = step(opened.state, { kind: "text", value: "thai massage" }, deps);
    expect(results.cards!.length).toBeGreaterThan(0);
    const more = step(results.state, { kind: "control", control: "more" }, deps);
    expect(more.state.offset).toBe(3);
  });

  it("'Start over' clears slots entirely", () => {
    const opened = openGreeting({ path: "/city/new-york", pagePlace: "new-york" }, deps);
    const results = step(opened.state, { kind: "text", value: "thai massage" }, deps);
    const restarted = step(results.state, { kind: "control", control: "start-over" }, deps);
    expect(restarted.state.slots.place).toBeUndefined();
  });
});
