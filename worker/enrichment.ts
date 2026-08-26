import type { Env } from "./index";

/**
 * Background listing enrichment.
 *
 * 94% of listings carry a description of about 190 characters assembled from
 * whatever fields the importer happened to have. This reads the studio's own
 * website and asks Workers AI to write two or three useful sentences from what
 * is actually on that page.
 *
 * The Worker drives it on a cron. The CMS starts it, stops it, tunes it and
 * watches it — see the admin routes in worker/index.ts and the Enrichment
 * section of the CMS. Nothing here blocks a request or needs anyone watching.
 */

export type EnrichmentSettings = {
  enabled: boolean;
  autoPublish: boolean;
  batchSize: number;
  concurrency: number;
  dailyCap: number;
  model: string;
  target: EnrichmentTarget;
};

export type EnrichmentTarget = "thin" | "missing" | "all";

/**
 * Only text-generation models that are actually cheap enough to run across
 * hundreds of listings. An admin picks from this list, so a typo in the CMS
 * cannot send every request to a model nobody costed.
 */
export const ENRICHMENT_MODELS = [
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/mistral/mistral-7b-instruct-v0.2",
  "@cf/qwen/qwen1.5-14b-chat-awq",
] as const;

const DEFAULTS: EnrichmentSettings = {
  enabled: false,
  autoPublish: false,
  batchSize: 8,
  concurrency: 3,
  dailyCap: 200,
  model: ENRICHMENT_MODELS[0],
  target: "thin",
};

/** A description this short is a stub the importer assembled, not a description. */
const THIN_DESCRIPTION_CHARS = 240;
/** Enough of a page to describe it; beyond this is nav, footer and cookie banner. */
const MAX_PAGE_CHARS = 6000;
/** A page with less than this much text said nothing worth summarising. */
const MIN_PAGE_CHARS = 200;
const FETCH_TIMEOUT_MS = 8000;
const MAX_FETCH_BYTES = 600_000;

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

export async function getEnrichmentSettings(env: Env): Promise<EnrichmentSettings> {
  const { results } = await env.DB.prepare("SELECT key, value FROM qh_settings WHERE key LIKE 'enrichment_%'").all<{ key: string; value: string }>();
  const raw = Object.fromEntries(results.map(row => [row.key, row.value]));
  const model = raw.enrichment_model;
  const target = raw.enrichment_target;
  return {
    enabled: raw.enrichment_enabled === "1",
    autoPublish: raw.enrichment_auto_publish === "1",
    batchSize: clampInt(raw.enrichment_batch_size, 1, 50, DEFAULTS.batchSize),
    concurrency: clampInt(raw.enrichment_concurrency, 1, 8, DEFAULTS.concurrency),
    dailyCap: clampInt(raw.enrichment_daily_cap, 0, 5000, DEFAULTS.dailyCap),
    model: (ENRICHMENT_MODELS as readonly string[]).includes(model) ? model : DEFAULTS.model,
    target: target === "missing" || target === "all" ? target : DEFAULTS.target,
  };
}

export async function updateEnrichmentSettings(env: Env, patch: Partial<EnrichmentSettings>): Promise<EnrichmentSettings> {
  const writes: D1PreparedStatement[] = [];
  const put = (key: string, value: string) =>
    writes.push(env.DB.prepare("INSERT INTO qh_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(key, value));

  if (patch.enabled !== undefined) put("enrichment_enabled", patch.enabled ? "1" : "0");
  if (patch.autoPublish !== undefined) put("enrichment_auto_publish", patch.autoPublish ? "1" : "0");
  if (patch.batchSize !== undefined) put("enrichment_batch_size", String(clampInt(patch.batchSize, 1, 50, DEFAULTS.batchSize)));
  if (patch.concurrency !== undefined) put("enrichment_concurrency", String(clampInt(patch.concurrency, 1, 8, DEFAULTS.concurrency)));
  if (patch.dailyCap !== undefined) put("enrichment_daily_cap", String(clampInt(patch.dailyCap, 0, 5000, DEFAULTS.dailyCap)));
  if (patch.model !== undefined && (ENRICHMENT_MODELS as readonly string[]).includes(patch.model)) put("enrichment_model", patch.model);
  if (patch.target !== undefined && ["thin", "missing", "all"].includes(patch.target)) put("enrichment_target", patch.target);

  if (writes.length) await env.DB.batch(writes);
  return getEnrichmentSettings(env);
}

type Candidate = { slug: string; name: string; website: string; address: string | null; suburb: string | null; city_slug: string; description: string | null };

/**
 * A listing is worth enriching only if it has a website to read. Anything
 * already proposed, published or rejected is left alone, so a run never spends
 * twice on the same listing or overwrites an admin's decision.
 */
async function selectCandidates(env: Env, settings: EnrichmentSettings, limit: number): Promise<Candidate[]> {
  const targetClause =
    settings.target === "all" ? "1 = 1"
    : settings.target === "missing" ? "TRIM(COALESCE(l.description, '')) = ''"
    : `LENGTH(TRIM(COALESCE(l.description, ''))) < ${THIN_DESCRIPTION_CHARS}`;
  const { results } = await env.DB.prepare(
    `SELECT l.slug, l.name, l.website, l.address, l.suburb, l.city_slug, l.description
     FROM listings l
     WHERE TRIM(COALESCE(l.website, '')) <> ''
       AND ${targetClause}
       AND NOT EXISTS (
         SELECT 1 FROM qh_enrichment_items i
         WHERE i.listing_slug = l.slug AND i.status IN ('proposed', 'published', 'rejected')
       )
     ORDER BY l.id
     LIMIT ?`,
  ).bind(limit).all<Candidate>();
  return results;
}

/** Strips a page to readable text — no DOM parser needed, and none available here. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageText(website: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(website, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "ThaiMassageForU-Directory/1.0 (+https://thaimassageforu.com)", accept: "text/html" },
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    const body = (await response.text()).slice(0, MAX_FETCH_BYTES);
    const text = htmlToText(body);
    return text.length >= MIN_PAGE_CHARS ? text.slice(0, MAX_PAGE_CHARS) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The whole point of this directory's audit was that it must not state things
 * it cannot stand behind, so the prompt forbids exactly the inventions a model
 * reaches for on a thin page: prices, hours, ratings, awards and credentials.
 */
function buildPrompt(listing: Candidate, cityName: string, pageText: string) {
  const place = [listing.suburb, cityName].filter(Boolean).join(", ");
  return [
    {
      role: "system",
      content:
        "You write short, factual entries for a massage and wellness directory. " +
        "You are given the text of a business's own website. Write 2 to 3 sentences, 40 to 70 words, in plain British English, third person, present tense. " +
        "Describe only what the page actually says: the treatments offered, the style of the place, and who it suits. " +
        "NEVER state a price, an opening time, a rating, a review count, a year established, an award, or a therapist's qualification unless that exact fact appears in the page text. " +
        "Do not use marketing language, do not address the reader as 'you', do not open with the words 'Nestled' or 'Discover', and do not mention the website or this directory. " +
        "If the page text does not describe a massage or wellness business, reply with exactly: INSUFFICIENT",
    },
    {
      role: "user",
      content: `Business name: ${listing.name}\nLocation: ${place || cityName}\n\nWebsite text:\n${pageText}`,
    },
  ];
}

/** Rejects an answer that is empty, a refusal, or the model narrating itself. */
function usableDescription(raw: string): string | null {
  const text = raw.replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
  if (!text || /^INSUFFICIENT/i.test(text)) return null;
  if (text.length < 60 || text.length > 900) return null;
  if (/^(sure|certainly|here('s| is)|as an ai|i cannot|i'm sorry)/i.test(text)) return null;
  return text;
}

type ItemOutcome = { status: "proposed" | "published" | "failed" | "skipped"; description?: string; error?: string };

async function enrichOne(env: Env, listing: Candidate, settings: EnrichmentSettings, cityName: string): Promise<ItemOutcome> {
  const pageText = await fetchPageText(listing.website);
  if (!pageText) return { status: "skipped", error: "website unreachable or too little text to summarise" };
  let raw: string;
  try {
    const response = (await env.AI.run(settings.model as never, { messages: buildPrompt(listing, cityName, pageText), max_tokens: 220 } as never)) as { response?: string };
    raw = typeof response?.response === "string" ? response.response : "";
  } catch (error) {
    return { status: "failed", error: `model call failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  const description = usableDescription(raw);
  if (!description) return { status: "skipped", error: "model returned nothing usable for this page" };
  if (settings.autoPublish) {
    await env.DB.prepare("UPDATE listings SET description = ? WHERE slug = ?").bind(description, listing.slug).run();
    return { status: "published", description };
  }
  return { status: "proposed", description };
}

/** Runs `workers` at a time over `items`, preserving nothing but completion. */
async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function usedToday(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM qh_enrichment_items WHERE DATE(created_at) = DATE('now')").first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * One batch. Safe to call from the cron handler or from the CMS's "Run now"
 * button; a run always records why it did nothing, so the dashboard never shows
 * an unexplained gap.
 */
export async function runEnrichmentBatch(env: Env, trigger: "cron" | "manual") {
  const settings = await getEnrichmentSettings(env);
  if (!settings.enabled && trigger === "cron") {
    return { status: "disabled" as const, attempted: 0, succeeded: 0, failed: 0, skipped: 0, note: "Enrichment is stopped in the CMS." };
  }

  const used = await usedToday(env);
  const remainingToday = settings.dailyCap === 0 ? Number.POSITIVE_INFINITY : settings.dailyCap - used;
  if (remainingToday <= 0) {
    const note = `Daily cap of ${settings.dailyCap} reached (${used} listings processed today).`;
    await env.DB.prepare("INSERT INTO qh_enrichment_runs (trigger, status, note, model, finished_at) VALUES (?, 'capped', ?, ?, CURRENT_TIMESTAMP)").bind(trigger, note, settings.model).run();
    return { status: "capped" as const, attempted: 0, succeeded: 0, failed: 0, skipped: 0, note };
  }

  const wanted = Math.min(settings.batchSize, remainingToday);
  const candidates = await selectCandidates(env, settings, wanted);
  const runInsert = await env.DB.prepare("INSERT INTO qh_enrichment_runs (trigger, status, model) VALUES (?, 'running', ?)").bind(trigger, settings.model).run();
  const runId = Number(runInsert.meta.last_row_id);

  if (!candidates.length) {
    const note = "No listings left to enrich for the current target.";
    await env.DB.prepare("UPDATE qh_enrichment_runs SET status = 'ok', note = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?").bind(note, runId).run();
    return { status: "ok" as const, runId, attempted: 0, succeeded: 0, failed: 0, skipped: 0, note };
  }

  const cityRows = await env.DB.prepare("SELECT slug, name FROM cities").all<{ slug: string; name: string }>();
  const cityNames = new Map(cityRows.results.map(row => [row.slug, row.name]));

  const counts = { succeeded: 0, failed: 0, skipped: 0 };
  await pool(candidates, settings.concurrency, async listing => {
    let outcome: ItemOutcome;
    try {
      outcome = await enrichOne(env, listing, settings, cityNames.get(listing.city_slug) ?? listing.city_slug);
    } catch (error) {
      outcome = { status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
    if (outcome.status === "failed") counts.failed++;
    else if (outcome.status === "skipped") counts.skipped++;
    else counts.succeeded++;
    await env.DB.prepare(
      "INSERT INTO qh_enrichment_items (run_id, listing_slug, listing_name, status, model, source_url, generated_description, previous_description, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(runId, listing.slug, listing.name, outcome.status, settings.model, listing.website, outcome.description ?? null, listing.description ?? null, outcome.error ?? null).run();
  });

  const note = `${counts.succeeded} written, ${counts.skipped} skipped, ${counts.failed} failed.`;
  await env.DB.prepare("UPDATE qh_enrichment_runs SET status = 'ok', attempted = ?, succeeded = ?, failed = ?, skipped = ?, note = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(candidates.length, counts.succeeded, counts.failed, counts.skipped, note, runId)
    .run();
  return { status: "ok" as const, runId, attempted: candidates.length, ...counts, note };
}

/** Everything the CMS panel renders, in one round trip. */
export async function getEnrichmentStatus(env: Env) {
  const settings = await getEnrichmentSettings(env);
  const [runs, items, totals, backlog] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM qh_enrichment_runs ORDER BY id DESC LIMIT 12"),
    env.DB.prepare("SELECT id, listing_slug, listing_name, status, source_url, generated_description, error, created_at FROM qh_enrichment_items ORDER BY id DESC LIMIT 40"),
    env.DB.prepare("SELECT status, COUNT(*) AS count FROM qh_enrichment_items GROUP BY status"),
    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM listings l
       WHERE TRIM(COALESCE(l.website, '')) <> ''
         AND LENGTH(TRIM(COALESCE(l.description, ''))) < ${THIN_DESCRIPTION_CHARS}
         AND NOT EXISTS (SELECT 1 FROM qh_enrichment_items i WHERE i.listing_slug = l.slug AND i.status IN ('proposed', 'published', 'rejected'))`,
    ),
  ]);
  return {
    settings,
    models: ENRICHMENT_MODELS,
    usedToday: await usedToday(env),
    backlog: (backlog.results[0] as { count: number } | undefined)?.count ?? 0,
    totals: Object.fromEntries((totals.results as Array<{ status: string; count: number }>).map(row => [row.status, row.count])),
    runs: runs.results,
    items: items.results,
  };
}

/** Publishes a proposal onto the live listing. */
export async function reviewProposal(env: Env, id: number, decision: "approve" | "reject") {
  const item = await env.DB.prepare("SELECT listing_slug, generated_description, status FROM qh_enrichment_items WHERE id = ?").bind(id).first<{ listing_slug: string; generated_description: string | null; status: string }>();
  if (!item) return { error: "That proposal no longer exists." };
  if (item.status !== "proposed") return { error: `This proposal is already ${item.status}.` };
  if (decision === "reject") {
    await env.DB.prepare("UPDATE qh_enrichment_items SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    return { ok: true, status: "rejected" as const };
  }
  if (!item.generated_description) return { error: "That proposal has no description to publish." };
  await env.DB.batch([
    env.DB.prepare("UPDATE listings SET description = ? WHERE slug = ?").bind(item.generated_description, item.listing_slug),
    env.DB.prepare("UPDATE qh_enrichment_items SET status = 'published', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
  ]);
  return { ok: true, status: "published" as const };
}

/** Publishes every outstanding proposal — the bulk path, for once the sample reads well. */
export async function approveAllProposals(env: Env) {
  const { results } = await env.DB.prepare("SELECT id, listing_slug, generated_description FROM qh_enrichment_items WHERE status = 'proposed' AND generated_description IS NOT NULL").all<{ id: number; listing_slug: string; generated_description: string }>();
  if (!results.length) return { approved: 0 };
  for (let index = 0; index < results.length; index += 40) {
    const slice = results.slice(index, index + 40);
    await env.DB.batch(slice.flatMap(row => [
      env.DB.prepare("UPDATE listings SET description = ? WHERE slug = ?").bind(row.generated_description, row.listing_slug),
      env.DB.prepare("UPDATE qh_enrichment_items SET status = 'published', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id),
    ]));
  }
  return { approved: results.length };
}
