// §6.4 Dialog engine. Pure function: step(state, input) -> { state, messages, cards?, chips? }.
// State is plain JSON (see DialogState) so the widget can persist it in sessionStorage.

import { applyHardFilters, rank, relax } from "./rank.js";
import { mergeSlots, parse } from "./parse.js";
import { tokenize } from "./tokenize.js";
import type {
  DialogMessage, DialogState, DialogStepResult, Flow, IndexListing, IndexManifest, PageContext, ParseResult, Scored, SiteTaxonomy, Slots,
} from "./types.js";

export interface DialogInput {
  kind: "chip" | "text" | "control";
  slotKey?: string; // for a chip answering a specific facet/place question
  value?: string; // chip value, or raw text
  control?: "more" | "cheaper" | "closer" | "change-treatment" | "change-city" | "best-in-city" | "start-over";
}

export interface DialogDeps {
  manifest: IndexManifest;
  taxonomy: SiteTaxonomy;
  flow: Flow;
  listingsForPlace: (placeSlug: string) => IndexListing[];
  /** Hybrid LLM fallback — see §6.2. Optional: P0 (no-LLM) callers omit this. */
  llmParse?: (text: string) => Promise<ParseResult>;
}

const RESULTS_PAGE_SIZE = 3;
const HYBRID_CONFIDENCE_THRESHOLD = 0.6;
const HYBRID_MIN_TOKENS = 3;

function emptySlots(): Slots {
  return { facets: {} };
}

export function initState(ctx: PageContext): DialogState {
  const slots = emptySlots();
  if (ctx.pagePlace) slots.place = ctx.pagePlace;
  if (ctx.pageFacets) slots.facets = { ...ctx.pageFacets };
  return { slots, asked: [], turn: 0, offset: 0, open: false };
}

function greet(state: DialogState, deps: DialogDeps): DialogMessage[] {
  const line = deps.flow.greet[state.turn % deps.flow.greet.length];
  const place = state.slots.place ? deps.manifest.places.find(p => p.slug === state.slots.place) : undefined;
  return [{ role: "bot", text: place ? `${line} in ${place.name}?` : line }];
}

/** A facet is worth asking only if the current place's shard actually has >=2 distinct values for it. */
function facetHasChoice(listings: IndexListing[], facetKey: string): boolean {
  const seen = new Set<string>();
  for (const listing of listings) for (const value of listing.facets[facetKey] ?? []) seen.add(value);
  return seen.size >= 2;
}

function nextQuestion(state: DialogState, deps: DialogDeps): { slotKey: string; chips: string[] } | null {
  if (!state.slots.place) {
    const chips = deps.manifest.places
      .slice() // most-populous first, per §6.4 step 3 ("6 nearest/most-populous chips")
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(p => p.slug);
    return { slotKey: "place", chips };
  }
  if (state.asked.length >= deps.flow.maxQuestions) return null;
  const listings = deps.listingsForPlace(state.slots.place);
  for (const slotKey of deps.flow.askOrder) {
    if (state.asked.includes(slotKey)) continue;
    if (state.slots.facets[slotKey]?.length) continue;
    const facet = deps.taxonomy.facets.find(f => f.key === slotKey);
    if (!facet || facet.askAs === "never") continue;
    if (!facetHasChoice(listings, slotKey)) continue; // don't ask pointless questions
    const values = facet.values.filter(v => listings.some(l => l.facets[slotKey]?.includes(v.slug)));
    if (values.length < 2) continue;
    return { slotKey, chips: values.map(v => v.slug) };
  }
  return null;
}

function candidatesFor(state: DialogState, deps: DialogDeps, queryTokens: string[] = []): { scored: Scored[]; relaxedNote?: string } {
  const listings = state.slots.place ? deps.listingsForPlace(state.slots.place) : [];
  let filtered = applyHardFilters(listings, state.slots);
  let effectiveSlots: Partial<Slots> = state.slots;
  let relaxedNote: string | undefined;

  if (filtered.length < RESULTS_PAGE_SIZE) {
    const relaxed = relax(listings, state.slots, deps.manifest, RESULTS_PAGE_SIZE);
    if (relaxed) {
      effectiveSlots = relaxed.slots;
      filtered = applyHardFilters(listings, effectiveSlots);
      if (relaxed.relaxed.includes("place-radius")) {
        const place = deps.manifest.places.find(p => p.slug === state.slots.place);
        relaxedNote = deps.flow.results.near.replace("{place}", place?.name ?? "nearby");
      }
    }
  }

  const scored = rank(filtered, effectiveSlots, deps.taxonomy, { queryTokens });
  return { scored, relaxedNote };
}

function renderResults(state: DialogState, deps: DialogDeps, scored: Scored[], relaxedNote?: string): DialogStepResult {
  const page = scored.slice(state.offset, state.offset + RESULTS_PAGE_SIZE);
  const messages: DialogMessage[] = [];
  if (scored.length === 0) {
    messages.push({ role: "bot", text: deps.flow.results.none });
    return { state, messages, chips: ["Start over"], showTextInput: true };
  }
  messages.push({ role: "bot", text: relaxedNote ?? deps.flow.results.intro });
  const chips = ["Show 3 more", "Cheaper", "Closer", "Change treatment", "Change city"];
  return { state: { ...state, results: scored }, messages, cards: page, chips, showTextInput: true };
}

/** Applies one dialog turn. Synchronous — the hybrid LLM path (if `deps.llmParse` is given and
 * needed) is a separate async wrapper below, `stepAsync`, since `step` itself must stay pure
 * and side-effect-free for the golden tests. */
export function step(state: DialogState, input: DialogInput, deps: DialogDeps, parsedFromText?: ParseResult): DialogStepResult {
  let next: DialogState = { ...state, open: true, slots: { ...state.slots, facets: { ...state.slots.facets } }, turn: state.turn + 1 };
  let queryTokens: string[] = [];

  if (input.kind === "control") {
    return handleControl(next, input, deps);
  }

  if (input.kind === "chip" && input.slotKey && input.value) {
    if (input.slotKey === "place") {
      next.slots.place = input.value;
    } else {
      next.slots.facets[input.slotKey] = [...new Set([...(next.slots.facets[input.slotKey] ?? []), input.value])];
    }
    next.asked = [...new Set([...next.asked, input.slotKey])];
  } else if (input.kind === "text" && input.value) {
    const parsed = parsedFromText ?? parse(input.value, deps.manifest, { pagePlace: state.slots.place, near: state.slots.near });
    next.slots = { ...next.slots, ...mergeSlots(next.slots, parsed.slots), facets: { ...next.slots.facets, ...mergeSlots(next.slots, parsed.slots).facets } } as Slots;
    queryTokens = tokenize(input.value).tokens;
  }

  const question = nextQuestion(next, deps);
  if (question) {
    next.asked = [...new Set([...next.asked, question.slotKey])];
    const askDef = deps.flow.ask[question.slotKey];
    const messages: DialogMessage[] = [{ role: "bot", text: askDef?.q ?? `What ${question.slotKey}?` }];
    return { state: next, messages, chips: question.chips, showTextInput: true };
  }

  const { scored, relaxedNote } = candidatesFor(next, deps, queryTokens);
  next.offset = 0;
  return renderResults(next, deps, scored, relaxedNote);
}

function handleControl(state: DialogState, input: DialogInput, deps: DialogDeps): DialogStepResult {
  switch (input.control) {
    case "more": {
      const next = { ...state, offset: state.offset + RESULTS_PAGE_SIZE };
      const scored = state.results ?? [];
      const page = scored.slice(next.offset, next.offset + RESULTS_PAGE_SIZE);
      if (page.length === 0) return { state: next, messages: [{ role: "bot", text: deps.flow.results.none }], showTextInput: true };
      return { state: next, messages: [{ role: "bot", text: deps.flow.results.more }], cards: page, chips: ["Show 3 more", "Change city"], showTextInput: true };
    }
    case "cheaper": {
      const next = { ...state, slots: { ...state.slots, sort: "cheapest" as const }, offset: 0 };
      const { scored, relaxedNote } = candidatesFor(next, deps);
      return renderResults(next, deps, scored, relaxedNote);
    }
    case "closer": {
      const next = { ...state, slots: { ...state.slots, sort: "nearest" as const }, offset: 0 };
      const { scored, relaxedNote } = candidatesFor(next, deps);
      return renderResults(next, deps, scored, relaxedNote);
    }
    case "change-treatment": {
      const next = { ...state, slots: { ...state.slots, facets: { ...state.slots.facets, service: [] } }, asked: state.asked.filter(a => a !== "service"), offset: 0 };
      const question = nextQuestion(next, deps);
      if (question) {
        const askDef = deps.flow.ask[question.slotKey];
        return { state: { ...next, asked: [...next.asked, question.slotKey] }, messages: [{ role: "bot", text: askDef?.q ?? "" }], chips: question.chips, showTextInput: true };
      }
      const { scored, relaxedNote } = candidatesFor(next, deps);
      return renderResults(next, deps, scored, relaxedNote);
    }
    case "change-city": {
      const next: DialogState = { ...initState({ path: "" }), open: true, turn: state.turn + 1 };
      const question = nextQuestion(next, deps)!;
      return { state: next, messages: [{ role: "bot", text: deps.flow.ask.place?.q ?? "Which city?" }], chips: question.chips, showTextInput: true };
    }
    case "best-in-city": {
      const next = { ...state, slots: { ...state.slots, sort: "rated" as const }, offset: 0 };
      const { scored, relaxedNote } = candidatesFor(next, deps);
      return renderResults(next, deps, scored, relaxedNote);
    }
    case "start-over": {
      const next = initState({ path: "" });
      next.open = true;
      return { state: next, messages: greet(next, deps), chips: nextQuestion(next, deps)?.chips, showTextInput: true };
    }
    default:
      return { state, messages: [], showTextInput: true };
  }
}

/** §6.2 hybrid trigger: confidence < 0.6 && contentTokens >= 3 -> call the runtime LLM. Async
 * wrapper around `step` so the pure core stays synchronous and unit-testable without a network. */
export async function stepAsync(state: DialogState, input: DialogInput, deps: DialogDeps): Promise<DialogStepResult> {
  if (input.kind !== "text" || !input.value || !deps.llmParse) return step(state, input, deps);
  const deterministic = parse(input.value, deps.manifest, { pagePlace: state.slots.place, near: state.slots.near });
  const { contentCount } = tokenize(input.value);
  if (deterministic.confidence >= HYBRID_CONFIDENCE_THRESHOLD || contentCount < HYBRID_MIN_TOKENS) {
    return step(state, input, deps, deterministic);
  }
  try {
    const llmResult = await deps.llmParse(input.value);
    const merged: ParseResult = { slots: mergeSlots(deterministic.slots, llmResult.slots), confidence: Math.max(deterministic.confidence, llmResult.confidence), unmatched: deterministic.unmatched };
    return step(state, input, deps, merged);
  } catch {
    return step(state, input, deps, deterministic); // never blocks — falls back to what the deterministic parser got
  }
}

export function openGreeting(ctx: PageContext, deps: DialogDeps): DialogStepResult {
  const state = { ...initState(ctx), open: true };
  const question = nextQuestion(state, deps);
  const messages = greet(state, deps);
  if (!question) {
    const { scored, relaxedNote } = candidatesFor(state, deps);
    return renderResults(state, deps, scored, relaxedNote);
  }
  const stateWithAsked = { ...state, asked: [...state.asked, question.slotKey] };
  const askDef = deps.flow.ask[question.slotKey];
  return { state: stateWithAsked, messages: question.slotKey === "place" ? messages : [...messages, { role: "bot", text: askDef?.q ?? "" }], chips: question.chips, showTextInput: true };
}
