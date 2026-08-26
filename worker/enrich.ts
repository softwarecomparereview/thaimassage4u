import type { Env } from "./index";

/**
 * Workers AI listing enrichment.
 *
 * Every scraped listing starts life with a templated one-liner description
 * ("X is an independently listed massage business in Y…"). This module turns
 * that into a real profile: it fetches the business's own website server-side
 * (the Worker has clean egress), extracts the visible text and og:image, and
 * asks Workers AI to write a short descriptor, an honest two-paragraph
 * description, and a concrete services list — grounded ONLY in the facts we
 * actually hold (scraped data + their own site copy), with instructions to
 * never invent prices, awards, or claims.
 *
 * Ways in:
 *  - POST /api/admin/enrich?limit=N  (admin-gated, batch on demand)
 *  - the scheduled cron handler runs a small batch every firing, so the whole
 *    directory converges to enriched without anyone pushing a button.
 *
 * Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast — big enough to follow the
 * grounding rules reliably, fast tier so a batch stays well inside a cron
 * invocation. Swap MODEL below if pricing/quality tradeoffs change.
 */

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

type EnrichableRow = {
  id: number;
  slug: string;
  name: string;
  city_slug: string;
  country_code: string;
  suburb: string | null;
  address: string | null;
  website: string | null;
  services: string | null;
  description: string | null;
  rating: number | null;
  review_count: number | null;
  image_url: string | null;
};

type SiteExtract = { text: string; title: string | null; metaDescription: string | null; ogImage: string | null };

/** Fetch the business's own site and pull out what the model (and we) can use. */
async function fetchSite(website: string): Promise<SiteExtract | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(website, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; QuietHourBot/1.0; +https://thaimassageforu.com)", accept: "text/html" },
    });
    clearTimeout(timer);
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    const html = (await response.text()).slice(0, 400_000);

    const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? null;
    const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i)?.[1]?.trim()
      ?? html.match(/<meta[^>]+content=["']([^"']{1,400})["'][^>]+name=["']description["']/i)?.[1]?.trim() ?? null;
    // og:image — attribute order varies by site generator, so try both.
    let ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{1,500})["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+property=["']og:image["']/i)?.[1] ?? null;
    if (ogImage) {
      try {
        ogImage = new URL(ogImage, response.url).toString();
        if (!ogImage.startsWith("https://")) ogImage = null; // http image on an https page would be blocked anyway
      } catch { ogImage = null; }
    }

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&amp;|&quot;|&#\d+;|&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    return { text, title, metaDescription, ogImage };
  } catch {
    return null;
  }
}

function buildPrompt(row: EnrichableRow, site: SiteExtract | null) {
  const facts = [
    `Business name: ${row.name}`,
    `City: ${row.city_slug.replace(/-/g, " ")} (${row.country_code.toUpperCase()})`,
    row.suburb ? `Suburb/neighbourhood: ${row.suburb}` : null,
    row.address ? `Address: ${row.address}` : null,
    typeof row.rating === "number" && row.review_count ? `Google rating: ${row.rating} stars from ${row.review_count} reviews` : null,
    row.services ? `Known services: ${row.services}` : null,
    site?.title ? `Their website title: ${site.title}` : null,
    site?.metaDescription ? `Their website meta description: ${site.metaDescription}` : null,
    site?.text ? `Text from their own website (truncated): ${site.text}` : null,
  ].filter(Boolean).join("\n");

  return `You write listing profiles for a quality wellness directory. Using ONLY the facts below, produce JSON with exactly these keys:
- "descriptor": one sentence fragment, max 85 characters, no trailing period, describing what this place is (e.g. "Traditional Thai massage studio in the city centre").
- "description": two short paragraphs (separated by \\n\\n), 60-120 words total, in plain warm English. Describe what they offer and who it suits. NEVER invent prices, awards, opening years, qualifications, or anything not in the facts. If the facts are thin, keep it short rather than padding.
- "services": array of 3-8 short service names actually mentioned or clearly implied in the facts (e.g. "Thai massage", "Deep tissue massage", "Foot reflexology"). If nothing specific is mentioned, use ["Massage"].

Facts:
${facts}

Reply with ONLY the JSON object, no markdown fences, no commentary.`;
}

type EnrichmentResult = { descriptor: string; description: string; services: string[] };

function parseModelJson(rawInput: unknown): EnrichmentResult | null {
  // Workers AI models are inconsistent here: some return `response` as a string,
  // others (llama-3.3 fast among them) hand back an already-parsed JSON object.
  const raw = typeof rawInput === "string" ? rawInput : JSON.stringify(rawInput ?? "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const descriptor = typeof parsed.descriptor === "string" ? parsed.descriptor.trim().replace(/\.$/, "").slice(0, 90) : "";
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const services = Array.isArray(parsed.services)
      ? parsed.services.filter((s: unknown) => typeof s === "string" && (s as string).trim().length > 1).map((s: string) => s.trim().slice(0, 60)).slice(0, 8)
      : [];
    if (descriptor.length < 10 || description.length < 80 || description.length > 1200 || !services.length) return null;
    // Model leaked meta-commentary — reject rather than publish it.
    if (/as an ai|i cannot|i can't|language model|the facts (provided|below)/i.test(descriptor + " " + description)) return null;
    return { descriptor, description, services };
  } catch {
    return null;
  }
}

export async function enrichListing(env: Env, row: EnrichableRow): Promise<"enriched" | "skipped"> {
  const site = row.website ? await fetchSite(row.website) : null;

  const aiResponse = (await env.AI.run(MODEL as Parameters<Ai["run"]>[0], {
    messages: [
      { role: "system", content: "You write concise, honest business profiles. You never fabricate facts. You reply with pure JSON only." },
      { role: "user", content: buildPrompt(row, site) },
    ],
    max_tokens: 600,
  })) as { response?: unknown };

  const result = parseModelJson(aiResponse.response ?? "");
  // Even on a failed generation, take the og:image and stamp enriched_at so the
  // batch loop doesn't retry the same stubborn listing forever — a later manual
  // pass can target `descriptor IS NULL AND enriched_at IS NOT NULL` if wanted.
  const newImage = !row.image_url && site?.ogImage ? site.ogImage : null;

  if (result) {
    const services = JSON.stringify(result.services);
    // COALESCE(?, image_url): keeps the existing image when we found nothing new.
    await env.DB.prepare("UPDATE listings SET descriptor = ?, description = ?, services = ?, image_url = COALESCE(?, image_url), enriched_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(result.descriptor, result.description, services, newImage, row.id)
      .run();
    await env.DB.prepare("UPDATE qh_listings SET descriptor = ?, description = ?, image_url = COALESCE(?, image_url), updated_at = CURRENT_TIMESTAMP WHERE slug = ?")
      .bind(result.descriptor, result.description, newImage, row.slug)
      .run();
    return "enriched";
  }

  await env.DB.prepare("UPDATE listings SET image_url = COALESCE(?, image_url), enriched_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(newImage, row.id)
    .run();
  return "skipped";
}

const SELECT_COLUMNS = "id, slug, name, city_slug, country_code, suburb, address, website, services, description, rating, review_count, image_url";

/** Enrich up to `limit` not-yet-enriched listings; websites first (most signal), then the rest. */
export async function enrichBatch(env: Env, limit: number) {
  const { results } = await env.DB.prepare(
    `SELECT ${SELECT_COLUMNS} FROM listings WHERE enriched_at IS NULL ORDER BY (website IS NULL), premium DESC, id LIMIT ?`,
  ).bind(limit).all<EnrichableRow>();

  let enriched = 0, skipped = 0;
  for (const row of results) {
    try {
      (await enrichListing(env, row)) === "enriched" ? enriched++ : skipped++;
    } catch (error) {
      // An exception here is AI- or DB-level (site fetch failures are swallowed inside
      // fetchSite) — most likely the daily neuron quota. Abort WITHOUT stamping this row,
      // so a quota outage pauses enrichment instead of silently marking the backlog done.
      return { picked: results.length, enriched, skipped, abortedOn: row.slug, error: String(error) };
    }
  }
  return { picked: results.length, enriched, skipped };
}

export async function handleEnrichRun(request: Request, env: Env) {
  const url = new URL(request.url);
  // debug=1: run ONE listing end-to-end without writing anything, returning the raw
  // model output + parse verdict — admin-gated, for diagnosing why generations fail.
  if (url.searchParams.get("debug") === "1") {
    const row = await env.DB.prepare(`SELECT ${SELECT_COLUMNS} FROM listings WHERE enriched_at IS NULL ORDER BY (website IS NULL), id LIMIT 1`).first<EnrichableRow>();
    if (!row) return Response.json({ error: "nothing left to enrich" });
    try {
      const site = row.website ? await fetchSite(row.website) : null;
      const aiResponse = (await env.AI.run(MODEL as Parameters<Ai["run"]>[0], {
        messages: [
          { role: "system", content: "You write concise, honest business profiles. You never fabricate facts. You reply with pure JSON only." },
          { role: "user", content: buildPrompt(row, site) },
        ],
        max_tokens: 600,
      })) as { response?: unknown };
      return Response.json({ listing: row.slug, siteFetched: Boolean(site), ogImage: site?.ogImage ?? null, raw: aiResponse, parsed: parseModelJson(aiResponse.response ?? "") });
    } catch (error) {
      return Response.json({ listing: row.slug, error: String(error) });
    }
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10) || 10, 25);
  return Response.json(await enrichBatch(env, limit));
}

export async function handleEnrichStatus(env: Env) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN enriched_at IS NOT NULL THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN enriched_at IS NOT NULL AND descriptor IS NOT NULL THEN 1 ELSE 0 END) AS succeeded FROM listings",
  ).first<{ total: number; done: number; succeeded: number }>();
  return Response.json(row);
}
