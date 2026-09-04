import type { Env } from "./index";

/**
 * Background listing enrichment — reconciled from two separate, unreconciled
 * jobs (worker/enrich.ts and this file, as it was before) that were built
 * concurrently on diverged branches and merged without either side noticing
 * the other existed. See worker/migrations/0012_enrichment_proposal_fields.sql
 * for the detail of what each one did wrong.
 *
 * This is now one engine: it fetches the studio's own website, extracts what
 * a page actually says (title, meta description, visible text, og:image),
 * and asks Workers AI for a descriptor, a two-paragraph description, and a
 * services list — grounded only in those facts, in German for German-market
 * listings since that's what German searchers type into Google. The Worker
 * drives it on a cron. The CMS starts it, stops it, tunes it and reviews what
 * it wrote — see the admin routes in worker/index.ts and /cms/enrichment.
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

/**
 * unenriched — never attempted (the normal, converging target: every listing
 *   gets exactly one pass, same as the old enrich.ts's `enriched_at IS NULL`).
 * thin — attempted before but the result (or the original stub) is still
 *   under the quality floor; for re-running after a prompt or model change.
 * all — ignore history entirely; a full re-run.
 */
export type EnrichmentTarget = "unenriched" | "thin" | "all";

/**
 * Only text-generation models that are actually affordable across hundreds of
 * listings. llama-3.3-70b-fp8-fast is first because it's what enrich.ts had
 * already proven in production before this merge; the 8b model is the cheaper
 * fallback. An admin picks from this list, so a typo in the CMS can't send
 * every request to a model nobody priced.
 */
export const ENRICHMENT_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/mistral/mistral-7b-instruct-v0.2",
  "@cf/qwen/qwen1.5-14b-chat-awq",
] as const;

const DEFAULTS: EnrichmentSettings = {
  // enrich.ts ran unconditionally in production with no switch at all and
  // produced the richer per-listing descriptors already live on the site —
  // proven, working behaviour. Defaulting to "on, auto-publishing" continues
  // that rather than silently reverting it to an unreviewed backlog nobody
  // was going to work through by hand; /cms/enrichment can turn either off.
  enabled: true,
  autoPublish: true,
  batchSize: 15,
  concurrency: 3,
  dailyCap: 400,
  model: ENRICHMENT_MODELS[0],
  target: "unenriched",
};

/** A description this short is a stub the importer assembled, not a description. */
const THIN_DESCRIPTION_CHARS = 240;
const MAX_PAGE_CHARS = 6000;
const MIN_PAGE_CHARS = 200;
const FETCH_TIMEOUT_MS = 8000;
const MAX_FETCH_BYTES = 400_000;

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
    enabled: raw.enrichment_enabled ? raw.enrichment_enabled === "1" : DEFAULTS.enabled,
    autoPublish: raw.enrichment_auto_publish ? raw.enrichment_auto_publish === "1" : DEFAULTS.autoPublish,
    batchSize: clampInt(raw.enrichment_batch_size, 1, 50, DEFAULTS.batchSize),
    concurrency: clampInt(raw.enrichment_concurrency, 1, 8, DEFAULTS.concurrency),
    dailyCap: clampInt(raw.enrichment_daily_cap, 0, 5000, DEFAULTS.dailyCap),
    model: (ENRICHMENT_MODELS as readonly string[]).includes(model) ? model : DEFAULTS.model,
    target: target === "thin" || target === "all" || target === "unenriched" ? target : DEFAULTS.target,
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
  if (patch.target !== undefined && ["unenriched", "thin", "all"].includes(patch.target)) put("enrichment_target", patch.target);

  if (writes.length) await env.DB.batch(writes);
  return getEnrichmentSettings(env);
}

type Candidate = {
  slug: string;
  name: string;
  website: string | null;
  address: string | null;
  suburb: string | null;
  city_slug: string;
  country_code: string;
  rating: number | null;
  review_count: number | null;
  services: string | null;
  description: string | null;
  image_url: string | null;
};

async function selectCandidates(env: Env, settings: EnrichmentSettings, limit: number): Promise<Candidate[]> {
  const targetClause =
    settings.target === "all" ? "1 = 1"
    : settings.target === "thin" ? `LENGTH(TRIM(COALESCE(l.description, ''))) < ${THIN_DESCRIPTION_CHARS}`
    : "l.enriched_at IS NULL";
  const { results } = await env.DB.prepare(
    `SELECT l.slug, l.name, l.website, l.address, l.suburb, l.city_slug, l.country_code, l.rating, l.review_count, l.services, l.description, l.image_url
     FROM listings l
     WHERE ${targetClause}
       AND NOT EXISTS (
         SELECT 1 FROM qh_enrichment_items i
         WHERE i.listing_slug = l.slug AND i.status IN ('proposed', 'published', 'rejected')
       )
     ORDER BY (l.website IS NULL), l.premium DESC, l.id
     LIMIT ?`,
  ).bind(limit).all<Candidate>();
  return results;
}

type SiteExtract = { text: string; title: string | null; metaDescription: string | null; ogImage: string | null };

/** No DOM parser is available here, so this is a plain-text/regex extraction — same approach enrich.ts proved in production. */
async function fetchSite(website: string): Promise<SiteExtract | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(website, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; QuietHourBot/1.0; +https://thaimassageforu.com)", accept: "text/html" },
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    const html = (await response.text()).slice(0, MAX_FETCH_BYTES);

    const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? null;
    const metaDescription =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i)?.[1]?.trim() ??
      html.match(/<meta[^>]+content=["']([^"']{1,400})["'][^>]+name=["']description["']/i)?.[1]?.trim() ?? null;
    let ogImage =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{1,500})["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+property=["']og:image["']/i)?.[1] ?? null;
    if (ogImage) {
      try {
        ogImage = new URL(ogImage, response.url).toString();
        if (!ogImage.startsWith("https://")) ogImage = null;
      } catch {
        ogImage = null;
      }
    }

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
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
    if (text.length < MIN_PAGE_CHARS) return { text: "", title, metaDescription, ogImage };
    return { text: text.slice(0, MAX_PAGE_CHARS), title, metaDescription, ogImage };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(listing: Candidate, cityName: string, site: SiteExtract | null) {
  const facts = [
    `Business name: ${listing.name}`,
    `City: ${cityName} (${listing.country_code.toUpperCase()})`,
    listing.suburb ? `Suburb/neighbourhood: ${listing.suburb}` : null,
    listing.address ? `Address: ${listing.address}` : null,
    typeof listing.rating === "number" && listing.review_count ? `Google rating: ${listing.rating} stars from ${listing.review_count} reviews` : null,
    listing.services ? `Known services: ${listing.services}` : null,
    site?.title ? `Their website title: ${site.title}` : null,
    site?.metaDescription ? `Their website meta description: ${site.metaDescription}` : null,
    site?.text ? `Text from their own website (truncated): ${site.text}` : null,
  ].filter(Boolean).join("\n");

  // German searchers query "thaimassage berlin" and Google serves German-language
  // results for German queries — the descriptor becomes the meta description, so
  // this is SEO, not cosmetics.
  const inGerman = listing.country_code === "de";
  const languageLine = inGerman
    ? `- "descriptor": one sentence fragment IN GERMAN, max 85 characters, no trailing period (e.g. "Traditionelle Thai-Massage im Stadtzentrum").
- "description": two short paragraphs (separated by \\n\\n), 60-120 words total, in plain warm GERMAN (Sie-Form). Describe what they offer and who it suits.`
    : `- "descriptor": one sentence fragment, max 85 characters, no trailing period, describing what this place is (e.g. "Traditional Thai massage studio in the city centre").
- "description": two short paragraphs (separated by \\n\\n), 60-120 words total, in plain warm English. Describe what they offer and who it suits.`;

  return `You write listing profiles for a quality wellness directory. Using ONLY the facts below, produce JSON with exactly these keys:
${languageLine} NEVER invent prices, awards, opening years, qualifications, or anything not in the facts. If the facts are thin, keep it short rather than padding.
- "services": array of 3-8 short service names actually mentioned or clearly implied in the facts${inGerman ? ' IN GERMAN (e.g. "Thai-Massage", "Rückenmassage", "Fußreflexzonenmassage")' : ' (e.g. "Thai massage", "Deep tissue massage", "Foot reflexology")'}. If nothing specific is mentioned, use ["Massage"].

If the facts do not describe a massage, spa or wellness business — a nail salon, a hotel, a gym with no treatments, anything else — set "descriptor" to exactly "SKIP" and leave the other fields empty.

Facts:
${facts}

Reply with ONLY the JSON object, no markdown fences, no commentary.`;
}

type ParsedResult = { descriptor: string; description: string; services: string[] };

function parseModelJson(rawInput: unknown): ParsedResult | null {
  // Workers AI models are inconsistent here: some return `response` as a string,
  // others hand back an already-parsed JSON object.
  const raw = typeof rawInput === "string" ? rawInput : JSON.stringify(rawInput ?? "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const descriptorRaw = typeof parsed.descriptor === "string" ? parsed.descriptor.trim() : "";
    if (/^SKIP$/i.test(descriptorRaw)) return null;
    const descriptor = descriptorRaw.replace(/\.$/, "").slice(0, 90);
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const services = Array.isArray(parsed.services)
      ? parsed.services.filter((value: unknown) => typeof value === "string" && value.trim().length > 1).map((value: string) => value.trim().slice(0, 60)).slice(0, 8)
      : [];
    if (descriptor.length < 10 || description.length < 80 || description.length > 1200 || !services.length) return null;
    if (/as an ai|i cannot|i can't|language model|the facts (provided|below)/i.test(descriptor + " " + description)) return null;
    return { descriptor, description, services };
  } catch {
    return null;
  }
}

type ItemOutcome = { status: "proposed" | "published" | "failed" | "skipped"; result?: ParsedResult; imageUrl?: string | null; error?: string };

/** Thrown only for a real infrastructure failure (AI call itself rejected) — distinct from a model reply that just didn't parse, which is a normal "skipped". */
class EnrichmentAborted extends Error {}

async function enrichOne(env: Env, listing: Candidate, settings: EnrichmentSettings, cityName: string): Promise<ItemOutcome> {
  const site = listing.website ? await fetchSite(listing.website) : null;
  let raw: unknown;
  try {
    const response = (await env.AI.run(settings.model as never, {
      messages: [
        { role: "system", content: "You write concise, honest business profiles. You never fabricate facts. You reply with pure JSON only." },
        { role: "user", content: buildPrompt(listing, cityName, site) },
      ],
      max_tokens: 600,
    } as never)) as { response?: unknown };
    raw = response?.response;
  } catch (error) {
    // A quota outage or model error, not a bad row — abort the whole batch rather
    // than stamp every remaining row as a failure it never actually attempted.
    throw new EnrichmentAborted(error instanceof Error ? error.message : String(error));
  }
  const result = parseModelJson(raw);
  const newImage = !listing.image_url && site?.ogImage ? site.ogImage : null;
  if (!result) return { status: "skipped", imageUrl: newImage, error: "model returned nothing usable for this page" };
  if (settings.autoPublish) {
    await env.DB.batch([
      env.DB.prepare("UPDATE listings SET descriptor = ?, description = ?, services = ?, image_url = COALESCE(?, image_url), enriched_at = CURRENT_TIMESTAMP WHERE slug = ?")
        .bind(result.descriptor, result.description, JSON.stringify(result.services), newImage, listing.slug),
      env.DB.prepare("UPDATE qh_listings SET descriptor = ?, description = ?, image_url = COALESCE(?, image_url), updated_at = CURRENT_TIMESTAMP WHERE slug = ?")
        .bind(result.descriptor, result.description, newImage, listing.slug),
    ]);
    return { status: "published", result, imageUrl: newImage };
  }
  return { status: "proposed", result, imageUrl: newImage };
}

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
  const row = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM qh_enrichment_items WHERE DATE(created_at) = DATE('now')) + (SELECT COUNT(*) FROM listings WHERE DATE(enriched_at) = DATE('now')) AS n",
  ).first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * One batch. Safe to call from the cron handler or from the CMS's "Run now"
 * button; a run always records why it did nothing, so the dashboard never
 * shows an unexplained gap.
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
  let aborted: string | null = null;
  await pool(candidates, settings.concurrency, async listing => {
    if (aborted) return; // an earlier item already hit a real outage — stop spending on this run
    let outcome: ItemOutcome;
    try {
      outcome = await enrichOne(env, listing, settings, cityNames.get(listing.city_slug) ?? listing.city_slug);
    } catch (error) {
      if (error instanceof EnrichmentAborted) { aborted = error.message; return; }
      outcome = { status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
    if (outcome.status === "failed") counts.failed++;
    else if (outcome.status === "skipped") counts.skipped++;
    else counts.succeeded++;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO qh_enrichment_items (run_id, listing_slug, listing_name, status, model, source_url, generated_description, generated_descriptor, generated_services, generated_image_url, previous_description, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        runId, listing.slug, listing.name, outcome.status, settings.model, listing.website,
        outcome.result?.description ?? null, outcome.result?.descriptor ?? null,
        outcome.result ? JSON.stringify(outcome.result.services) : null, outcome.imageUrl ?? null,
        listing.description ?? null, outcome.error ?? null,
      ),
      // Stamped on every attempt, success or not, so the "unenriched" target never
      // retries the same stubborn row forever — a real infra outage (aborted below,
      // not reached here) is the one case that must NOT stamp this.
      env.DB.prepare("UPDATE listings SET enriched_at = COALESCE(enriched_at, CURRENT_TIMESTAMP) WHERE slug = ?").bind(listing.slug),
    ]);
  });

  const note = aborted
    ? `Stopped after an AI error: ${aborted}. ${counts.succeeded} written, ${counts.skipped} skipped before that.`
    : `${counts.succeeded} written, ${counts.skipped} skipped, ${counts.failed} failed.`;
  await env.DB.prepare("UPDATE qh_enrichment_runs SET status = ?, attempted = ?, succeeded = ?, failed = ?, skipped = ?, note = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(aborted ? "error" : "ok", candidates.length, counts.succeeded, counts.failed, counts.skipped, note, runId)
    .run();
  return { status: (aborted ? "error" : "ok") as "ok" | "error", runId, attempted: candidates.length, ...counts, note };
}

/** Everything the CMS panel renders, in one round trip. */
export async function getEnrichmentStatus(env: Env) {
  const settings = await getEnrichmentSettings(env);
  const [runs, items, totals, backlog, deepStats] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM qh_enrichment_runs ORDER BY id DESC LIMIT 12"),
    env.DB.prepare("SELECT id, listing_slug, listing_name, status, source_url, generated_description, generated_descriptor, generated_services, generated_image_url, error, created_at FROM qh_enrichment_items ORDER BY id DESC LIMIT 40"),
    env.DB.prepare("SELECT status, COUNT(*) AS count FROM qh_enrichment_items GROUP BY status"),
    env.DB.prepare("SELECT COUNT(*) AS count FROM listings WHERE enriched_at IS NULL"),
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN enriched_at IS NOT NULL THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN descriptor IS NOT NULL THEN 1 ELSE 0 END) AS withDescriptor FROM listings"),
  ]);
  return {
    settings,
    models: ENRICHMENT_MODELS,
    usedToday: await usedToday(env),
    backlog: (backlog.results[0] as { count: number } | undefined)?.count ?? 0,
    totals: Object.fromEntries((totals.results as Array<{ status: string; count: number }>).map(row => [row.status, row.count])),
    directory: deepStats.results[0] as { total: number; done: number; withDescriptor: number } | undefined,
    runs: runs.results,
    items: items.results,
  };
}

/** Publishes a proposal onto the live listing — descriptor, description, services and any new image, together. */
export async function reviewProposal(env: Env, id: number, decision: "approve" | "reject") {
  const item = await env.DB.prepare(
    "SELECT listing_slug, generated_description, generated_descriptor, generated_services, generated_image_url, status FROM qh_enrichment_items WHERE id = ?",
  ).bind(id).first<{ listing_slug: string; generated_description: string | null; generated_descriptor: string | null; generated_services: string | null; generated_image_url: string | null; status: string }>();
  if (!item) return { error: "That proposal no longer exists." };
  if (item.status !== "proposed") return { error: `This proposal is already ${item.status}.` };
  if (decision === "reject") {
    await env.DB.prepare("UPDATE qh_enrichment_items SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    return { ok: true, status: "rejected" as const };
  }
  if (!item.generated_description) return { error: "That proposal has no description to publish." };
  await env.DB.batch([
    env.DB.prepare("UPDATE listings SET description = ?, descriptor = COALESCE(?, descriptor), services = COALESCE(?, services), image_url = COALESCE(?, image_url) WHERE slug = ?")
      .bind(item.generated_description, item.generated_descriptor, item.generated_services, item.generated_image_url, item.listing_slug),
    env.DB.prepare("UPDATE qh_listings SET description = ?, descriptor = COALESCE(?, descriptor), image_url = COALESCE(?, image_url), updated_at = CURRENT_TIMESTAMP WHERE slug = ?")
      .bind(item.generated_description, item.generated_descriptor, item.generated_image_url, item.listing_slug),
    env.DB.prepare("UPDATE qh_enrichment_items SET status = 'published', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
  ]);
  return { ok: true, status: "published" as const };
}

/** Publishes every outstanding proposal — the bulk path, for once the sample reads well. */
export async function approveAllProposals(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT id, listing_slug, generated_description, generated_descriptor, generated_services, generated_image_url FROM qh_enrichment_items WHERE status = 'proposed' AND generated_description IS NOT NULL",
  ).all<{ id: number; listing_slug: string; generated_description: string; generated_descriptor: string | null; generated_services: string | null; generated_image_url: string | null }>();
  if (!results.length) return { approved: 0 };
  for (let index = 0; index < results.length; index += 20) {
    const slice = results.slice(index, index + 20);
    await env.DB.batch(slice.flatMap(row => [
      env.DB.prepare("UPDATE listings SET description = ?, descriptor = COALESCE(?, descriptor), services = COALESCE(?, services), image_url = COALESCE(?, image_url) WHERE slug = ?")
        .bind(row.generated_description, row.generated_descriptor, row.generated_services, row.generated_image_url, row.listing_slug),
      env.DB.prepare("UPDATE qh_enrichment_items SET status = 'published', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id),
    ]));
  }
  return { approved: results.length };
}
