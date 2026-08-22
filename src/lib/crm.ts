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
};

export async function listCrmContacts(
  db: D1Database,
  filters: { country?: string; city?: string; stage?: string; q?: string }
): Promise<CrmContact[]> {
  const clauses: string[] = [];
  const binds: string[] = [];
  if (filters.country) {
    clauses.push("country_code = ?");
    binds.push(filters.country);
  }
  if (filters.city) {
    clauses.push("city_slug = ?");
    binds.push(filters.city);
  }
  if (filters.stage) {
    clauses.push("stage = ?");
    binds.push(filters.stage);
  }
  if (filters.q) {
    clauses.push("(business_name LIKE ? OR email LIKE ? OR phone LIKE ?)");
    const like = `%${filters.q}%`;
    binds.push(like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { results } = await db
    .prepare(`SELECT * FROM crm_contacts ${where} ORDER BY id DESC LIMIT 200`)
    .bind(...binds)
    .all<CrmContact>();
  return results;
}

export async function crmStageCounts(db: D1Database): Promise<Record<string, number>> {
  const { results } = await db.prepare("SELECT stage, count(*) as n FROM crm_contacts GROUP BY stage").all<{ stage: string; n: number }>();
  return Object.fromEntries(results.map((row) => [row.stage, row.n]));
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
