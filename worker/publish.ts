import type { Env } from "./index";

/**
 * Publish control for the real `listings` table — the one the public site,
 * the sitemap and search engines actually read (see PUBLISHED in
 * worker/directory.ts). The CMS's older "Listings" tab edits `qh_listings`
 * instead, which has had no effect on public visibility for anything imported
 * since the one-time #0003 sync; this is deliberately a separate, direct path
 * rather than a fix to that form, so it works today without touching that
 * table's owner/practitioner/service relationships.
 */

export type PublishStatus = "published" | "pending" | "unpublished";
const STATUSES: PublishStatus[] = ["published", "pending", "unpublished"];
export function isPublishStatus(value: unknown): value is PublishStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

export type PublishRow = {
  slug: string;
  name: string;
  city_slug: string;
  country_code: string;
  status: PublishStatus;
  premium: number;
  claimed: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  image_url: string | null;
};

export type PublishFilter = { status?: PublishStatus | "all"; citySlug?: string; q?: string; thinOnly?: boolean };

const THIN_DESCRIPTION_CHARS = 240;

function whereClause(filter: PublishFilter) {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (filter.status && filter.status !== "all") { clauses.push("status = ?"); binds.push(filter.status); }
  if (filter.citySlug) { clauses.push("city_slug = ?"); binds.push(filter.citySlug); }
  if (filter.q) { clauses.push("(name LIKE ? OR slug LIKE ?)"); binds.push(`%${filter.q}%`, `%${filter.q}%`); }
  if (filter.thinOnly) clauses.push(`LENGTH(TRIM(COALESCE(description, ''))) < ${THIN_DESCRIPTION_CHARS}`);
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", binds };
}

export async function listPublishQueue(env: Env, filter: PublishFilter, page: number, pageSize: number) {
  const { where, binds } = whereClause(filter);
  const [rows, total, counts] = await env.DB.batch([
    env.DB.prepare(
      `SELECT slug, name, city_slug, country_code, status, premium, claimed, address, phone, website, description, image_url
       FROM listings ${where} ORDER BY id LIMIT ? OFFSET ?`,
    ).bind(...binds, pageSize, (page - 1) * pageSize),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM listings ${where}`).bind(...binds),
    env.DB.prepare("SELECT status, COUNT(*) AS n FROM listings GROUP BY status"),
  ]);
  return {
    rows: rows.results as PublishRow[],
    total: (total.results[0] as { n: number } | undefined)?.n ?? 0,
    page,
    pageSize,
    totals: Object.fromEntries((counts.results as Array<{ status: string; n: number }>).map(row => [row.status, row.n])),
  };
}

export async function setListingStatus(env: Env, slug: string, status: PublishStatus) {
  const result = await env.DB.prepare("UPDATE listings SET status = ? WHERE slug = ?").bind(status, slug).run();
  if (!result.meta.changes) return { error: "No listing has that slug." };
  return { ok: true as const, slug, status };
}

/**
 * Applies one status to every row matching the current filter — the "not all,
 * but which ones and how" lever: hold back everything still thin while
 * enrichment (#35) works through the backlog, without touching a claimed or
 * paying listing regardless of how thin it reads.
 */
export async function setStatusForFilter(env: Env, filter: PublishFilter, status: PublishStatus, protectClaimedAndPremium: boolean) {
  const { where, binds } = whereClause(filter);
  const guard = protectClaimedAndPremium ? `${where ? "AND" : "WHERE"} COALESCE(premium, 0) = 0 AND COALESCE(claimed, 0) = 0` : "";
  const result = await env.DB.prepare(`UPDATE listings SET status = ? ${where} ${guard}`).bind(status, ...binds).run();
  return { updated: result.meta.changes ?? 0 };
}
