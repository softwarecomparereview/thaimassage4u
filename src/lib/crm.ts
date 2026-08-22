// Outreach pipeline over real listings — "who do we still need to reach to ask
// them to claim their page". This module only ever reads/updates status; it does
// not send email or SMS. Sending needs a real provider + a compliance decision
// (consent, opt-out, CAN-SPAM/TCPA/PECR/GDPR) that hasn't been made yet, so the
// admin UI is deliberately a manual tracker, same spirit as the affiliate kit.

export type CrmStage = "new" | "ready" | "emailed" | "texted" | "responded" | "claimed" | "declined" | "invalid";

export const CRM_STAGES: CrmStage[] = ["new", "ready", "emailed", "texted", "responded", "claimed", "declined", "invalid"];

export type CrmContact = {
  id: number;
  listing_id: number;
  business_name: string;
  country_code: string;
  city_slug: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  stage: CrmStage;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  /** From listings.fresha_url — set only where scripts/enrich-fresha-links.mjs found a confident
   *  match, meaning this business already has a public Fresha profile (so it's not a fresh Fresha
   *  referral prospect — Fresha's own terms exclude previously-Fresha businesses from the reward). */
  fresha_url: string | null;
};

const CRM_SELECT = `SELECT crm_contacts.*, listings.fresha_url as fresha_url
  FROM crm_contacts LEFT JOIN listings ON listings.id = crm_contacts.listing_id`;

export type CrmFilters = {
  country?: string;
  city?: string;
  stage?: string;
  q?: string;
  hasPhone?: boolean;
  hasEmail?: boolean;
};

function crmWhere(filters: CrmFilters): { where: string; binds: string[] } {
  const clauses: string[] = [];
  const binds: string[] = [];
  if (filters.country) {
    clauses.push("crm_contacts.country_code = ?");
    binds.push(filters.country);
  }
  if (filters.city) {
    clauses.push("crm_contacts.city_slug = ?");
    binds.push(filters.city);
  }
  if (filters.stage) {
    clauses.push("crm_contacts.stage = ?");
    binds.push(filters.stage);
  }
  if (filters.q) {
    clauses.push("(crm_contacts.business_name LIKE ? OR crm_contacts.email LIKE ? OR crm_contacts.phone LIKE ?)");
    const like = `%${filters.q}%`;
    binds.push(like, like, like);
  }
  if (filters.hasPhone) clauses.push("crm_contacts.phone IS NOT NULL AND crm_contacts.phone != ''");
  if (filters.hasEmail) clauses.push("crm_contacts.email IS NOT NULL AND crm_contacts.email != ''");
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", binds };
}

export async function listCrmContacts(db: D1Database, filters: CrmFilters, limit = 500): Promise<CrmContact[]> {
  const { where, binds } = crmWhere(filters);
  const { results } = await db
    .prepare(`${CRM_SELECT} ${where} ORDER BY crm_contacts.id DESC LIMIT ?`)
    .bind(...binds, limit)
    .all<CrmContact>();
  return results;
}

/** Every matching row, no cap — for CSV export. */
export async function exportCrmContacts(db: D1Database, filters: CrmFilters): Promise<CrmContact[]> {
  const { where, binds } = crmWhere(filters);
  const { results } = await db
    .prepare(`${CRM_SELECT} ${where} ORDER BY crm_contacts.country_code, crm_contacts.city_slug, crm_contacts.business_name`)
    .bind(...binds)
    .all<CrmContact>();
  return results;
}

export async function crmFilterOptions(db: D1Database): Promise<{ countries: string[]; cities: Array<{ country_code: string; city_slug: string }> }> {
  const [{ results: countryRows }, { results: cityRows }] = await Promise.all([
    db.prepare("SELECT DISTINCT country_code FROM crm_contacts ORDER BY country_code").all<{ country_code: string }>(),
    db.prepare("SELECT DISTINCT country_code, city_slug FROM crm_contacts ORDER BY country_code, city_slug").all<{ country_code: string; city_slug: string }>(),
  ]);
  return { countries: countryRows.map((r) => r.country_code), cities: cityRows };
}

export async function crmStageCounts(db: D1Database): Promise<Record<string, number>> {
  const { results } = await db.prepare("SELECT stage, count(*) as n FROM crm_contacts GROUP BY stage").all<{ stage: string; n: number }>();
  return Object.fromEntries(results.map((row) => [row.stage, row.n]));
}

function csvCell(value: string | number | null): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function crmContactsToCsv(contacts: CrmContact[]): string {
  const header = ["business_name", "country_code", "city_slug", "phone", "email", "website", "fresha_url", "stage", "notes"];
  const lines = [header.join(",")];
  for (const c of contacts) {
    lines.push(
      [c.business_name, c.country_code, c.city_slug, c.phone, c.email, c.website, c.fresha_url, c.stage, c.notes].map(csvCell).join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export async function updateCrmContact(
  db: D1Database,
  id: number,
  patch: { stage: CrmStage; notes: string | null; markContacted: boolean }
): Promise<void> {
  await db
    .prepare(
      `UPDATE crm_contacts SET stage = ?, notes = ?, updated_at = datetime('now')${
        patch.markContacted ? ", last_contacted_at = datetime('now')" : ""
      } WHERE id = ?`
    )
    .bind(patch.stage, patch.notes, id)
    .run();
}
