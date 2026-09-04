// §6.1 Normalise / tokenize.
// lowercase -> NFKD strip diacritics -> replace [^a-z0-9\s$] with space -> split ->
// drop stopwords -> light stem (strip trailing s/es/ing when len>4). Keeps $-prefixed
// numerals so budget parsing downstream can see them.

const STOPWORDS = new Set([
  "a", "an", "the", "in", "at", "near", "me", "for", "i", "want", "some", "good",
  "best", "find", "looking", "to", "of", "my", "is", "are", "with", "and", "or",
  "please", "can", "you", "we", "us", "it", "on", "that", "this", "some", "get",
]);

/** Lowercases, strips diacritics, collapses everything but [a-z0-9 $] to spaces. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light stemmer: strips a trailing "ing", "es", or "s" only on tokens long enough that it's
 * safe. The "-es" rule only fires after a genuine sibilant (s/x/z/ch/sh — boxes, watches,
 * dishes): those really do add "es" for pluralisation. Anything else ending in "s" — including
 * a silent-e word like "massages" — gets a plain single-"s" strip, or the "e" that belongs to
 * the root gets eaten too ("massages" -> "massag" instead of "massage").
 */
function stem(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith("ing") && token.length > 6) return token.slice(0, -3);
  if (/(?:s|x|z|ch|sh)es$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export interface TokenizeResult {
  /** All tokens, stemmed, stopwords removed — used for matching. */
  tokens: string[];
  /** tokens.length — "content tokens", the confidence denominator. */
  contentCount: number;
}

export function tokenize(text: string): TokenizeResult {
  const normalised = normalise(text);
  const raw = normalised.split(" ").filter(Boolean);
  const tokens = raw.filter(t => !STOPWORDS.has(t)).map(t => (t.startsWith("$") ? t : stem(t)));
  return { tokens, contentCount: tokens.length };
}

/** Builds the deduped, capped token set stored on an IndexListing for text matching. */
export function tokensFor(parts: Array<string | undefined>, max = 40): string[] {
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const token of tokenize(part).tokens) {
      if (seen.size >= max) break;
      seen.add(token);
    }
  }
  return [...seen];
}

const BUDGET_UNDER = /\b(?:under|below|max)\s*\$?(\d+)\b/;
const BUDGET_RANGE = /\$?(\d+)\s*(?:-|to)\s*\$?(\d+)\b/;

export type BudgetHint = { kind: "under"; amount: number } | { kind: "range"; low: number; high: number };

/** Reads "under $80" / "below 80" / "$80-150" / "80 to 150" straight out of raw (unnormalised) text. */
export function parseBudgetHint(text: string): BudgetHint | null {
  const lowered = text.toLowerCase();
  const range = lowered.match(BUDGET_RANGE);
  if (range) return { kind: "range", low: Number(range[1]), high: Number(range[2]) };
  const under = lowered.match(BUDGET_UNDER);
  if (under) return { kind: "under", amount: Number(under[1]) };
  return null;
}

export { STOPWORDS };
