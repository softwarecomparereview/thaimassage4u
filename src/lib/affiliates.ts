export type AffiliateProgram = {
  id: number;
  country_code: string;
  program_name: string;
  company_name: string;
  signup_url: string;
  login_url: string | null;
  contact_email: string | null;
  affiliate_id: string | null;
  login_email: string | null;
  login_secret: string | null;
  notes: string | null;
  status: string;
};

export type AffiliateDefaults = {
  id: number;
  company_name: string;
  contact_email: string | null;
  login_email: string | null;
  login_secret: string | null;
  website: string | null;
  notes: string | null;
  phone: string | null;
  address: string | null;
  bio: string | null;
};

export const FALLBACK_DEFAULTS: AffiliateDefaults = {
  id: 1,
  company_name: "Thai Massage For U",
  contact_email: "hello@thaimassageforu.com",
  login_email: "hello@thaimassageforu.com",
  login_secret: null,
  website: "https://thaimassageforu.com",
  notes: "Preferred signup identity for review and booking partner sites.",
  phone: null,
  address: null,
  bio: null,
};

export const COUNTRY_LABELS: Record<string, string> = {
  us: "United States",
  uk: "United Kingdom",
  au: "Australia",
  de: "Germany",
  all: "Every country",
};

function blankToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getAffiliateDefaults(db: D1Database): Promise<AffiliateDefaults> {
  const row = await db.prepare("SELECT * FROM affiliate_defaults WHERE id = 1").first<AffiliateDefaults>();
  return row ?? FALLBACK_DEFAULTS;
}

export async function saveAffiliateDefaults(
  db: D1Database,
  draft: Omit<AffiliateDefaults, "id">,
  keepSecretIfBlank = true
): Promise<void> {
  const existing = await getAffiliateDefaults(db);
  const secret = blankToNull(draft.login_secret) ?? (keepSecretIfBlank ? existing.login_secret : null);
  await db
    .prepare(
      `INSERT INTO affiliate_defaults (id, company_name, contact_email, login_email, login_secret, website, notes, phone, address, bio, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         company_name = excluded.company_name,
         contact_email = excluded.contact_email,
         login_email = excluded.login_email,
         login_secret = excluded.login_secret,
         website = excluded.website,
         notes = excluded.notes,
         phone = excluded.phone,
         address = excluded.address,
         bio = excluded.bio,
         updated_at = datetime('now')`
    )
    .bind(
      draft.company_name.trim() || FALLBACK_DEFAULTS.company_name,
      blankToNull(draft.contact_email),
      blankToNull(draft.login_email),
      secret,
      blankToNull(draft.website),
      blankToNull(draft.notes),
      blankToNull(draft.phone),
      blankToNull(draft.address),
      blankToNull(draft.bio)
    )
    .run();
}

export async function listAffiliatePrograms(db: D1Database, country?: string): Promise<AffiliateProgram[]> {
  if (country) {
    const { results } = await db
      .prepare("SELECT * FROM affiliate_programs WHERE country_code = ? OR country_code = 'all' ORDER BY country_code, program_name")
      .bind(country)
      .all<AffiliateProgram>();
    return results;
  }
  const { results } = await db
    .prepare("SELECT * FROM affiliate_programs ORDER BY country_code, program_name")
    .all<AffiliateProgram>();
  return results;
}

export async function getAffiliateProgram(db: D1Database, id: number): Promise<AffiliateProgram | null> {
  return db.prepare("SELECT * FROM affiliate_programs WHERE id = ?").bind(id).first<AffiliateProgram>();
}

export type AffiliateDraft = Omit<AffiliateProgram, "id">;

export function applyDefaultIdentity(draft: AffiliateDraft, defaults: AffiliateDefaults): AffiliateDraft {
  return {
    ...draft,
    company_name: draft.company_name.trim() || defaults.company_name,
    contact_email: blankToNull(draft.contact_email) ?? defaults.contact_email,
    login_email: blankToNull(draft.login_email) ?? defaults.login_email,
    login_secret: blankToNull(draft.login_secret) ?? defaults.login_secret,
  };
}

export async function createAffiliateProgram(db: D1Database, draft: AffiliateDraft): Promise<void> {
  const defaults = await getAffiliateDefaults(db);
  const row = applyDefaultIdentity(draft, defaults);
  await db
    .prepare(
      `INSERT INTO affiliate_programs
        (country_code, program_name, company_name, signup_url, login_url, contact_email, affiliate_id, login_email, login_secret, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.country_code,
      row.program_name,
      row.company_name,
      row.signup_url,
      blankToNull(row.login_url),
      blankToNull(row.contact_email),
      blankToNull(row.affiliate_id),
      blankToNull(row.login_email),
      blankToNull(row.login_secret),
      blankToNull(row.notes),
      row.status || "todo"
    )
    .run();
}

export async function updateAffiliateProgram(db: D1Database, id: number, draft: AffiliateDraft): Promise<void> {
  const existing = await getAffiliateProgram(db, id);
  const secret = blankToNull(draft.login_secret) ?? existing?.login_secret ?? null;
  await db
    .prepare(
      `UPDATE affiliate_programs SET
        country_code = ?, program_name = ?, company_name = ?, signup_url = ?, login_url = ?,
        contact_email = ?, affiliate_id = ?, login_email = ?, login_secret = ?, notes = ?, status = ?
       WHERE id = ?`
    )
    .bind(
      draft.country_code,
      draft.program_name,
      draft.company_name,
      draft.signup_url,
      blankToNull(draft.login_url),
      blankToNull(draft.contact_email),
      blankToNull(draft.affiliate_id),
      blankToNull(draft.login_email),
      secret,
      blankToNull(draft.notes),
      draft.status || "todo",
      id
    )
    .run();
}

export async function deleteAffiliateProgram(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM affiliate_programs WHERE id = ?").bind(id).run();
}

export function kitSecret(program: AffiliateProgram, defaults: AffiliateDefaults): string {
  return program.login_secret || defaults.login_secret || "";
}

export function kitEmail(program: AffiliateProgram, defaults: AffiliateDefaults): string {
  return program.login_email || defaults.login_email || program.contact_email || defaults.contact_email || "";
}

export function kitPhone(defaults: AffiliateDefaults): string {
  return defaults.phone || "";
}

export function kitAddress(defaults: AffiliateDefaults): string {
  return defaults.address || "";
}

export function kitBio(defaults: AffiliateDefaults): string {
  return defaults.bio || "";
}
