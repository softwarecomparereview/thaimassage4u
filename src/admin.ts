import { Hono } from "hono";
import {
  adminInbox,
  createListing,
  deleteListing,
  getCity,
  getListingById,
  listAdminListings,
  listCities,
  listCountries,
  updateListing,
  type Listing,
  type ListingDraft,
} from "./lib/db";
import { escapeAttr, escapeHtml, slugify } from "./lib/escape";
import { adminPassword, clearSessionCookie, createSessionCookie, hasValidSession, passwordsMatch } from "./lib/session";
import { cacheDelete } from "./lib/storage";
import {
  COUNTRY_LABELS,
  createAffiliateProgram,
  deleteAffiliateProgram,
  getAffiliateDefaults,
  getAffiliateProgram,
  kitAddress,
  kitBio,
  kitEmail,
  kitPhone,
  kitSecret,
  listAffiliatePrograms,
  saveAffiliateDefaults,
  updateAffiliateProgram,
  type AffiliateDraft,
  type AffiliateDefaults,
  type AffiliateProgram,
} from "./lib/affiliates";
import { CRM_STAGES, crmStageCounts, listCrmContacts, updateCrmContact, type CrmStage } from "./lib/crm";

type AppEnv = { Bindings: Env };

function adminChrome(title: string, body: string, noticeText = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} | Directory admin</title>
<link rel="stylesheet" href="/styles.css">
<style>
  body.admin{background:#f6f3ee;color:#1a1511;font-family:Inter,system-ui,sans-serif}
  .admin-bar{background:#1a1511;color:#fff;padding:1rem 1.5rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
  .admin-bar a{color:#e5c9a8;font-weight:700}
  .admin-wrap{width:min(1100px, calc(100% - 2rem));margin:2rem auto 4rem}
  .admin-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e8dfd5;border-radius:12px;overflow:hidden}
  .admin-table th,.admin-table td{padding:.75rem .9rem;border-bottom:1px solid #eee;text-align:left;font-size:.92rem}
  .admin-form{display:grid;gap:1rem;background:#fff;padding:1.25rem;border:1px solid #e8dfd5;border-radius:16px}
  .admin-form input,.admin-form textarea,.admin-form select{width:100%;padding:.7rem .8rem;border:1px solid #d9cfc4;border-radius:10px}
  .admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  @media (max-width:720px){.admin-grid{grid-template-columns:1fr}}
</style>
</head>
<body class="admin">
  <div class="admin-bar">
    <strong>Directory admin</strong>
    <a href="/admin">Dashboard</a>
    <a href="/admin/listings">Listings</a>
    <a href="/admin/listings/new">New listing</a>
    <a href="/admin/crm">Outreach CRM</a>
    <a href="/admin/affiliates">Affiliates</a>
    <a href="/" target="_blank" rel="noreferrer">View site</a>
    <a href="/admin/logout">Log out</a>
  </div>
  <div class="admin-wrap">
    ${noticeText ? `<p class="form-notice ok">${escapeHtml(noticeText)}</p>` : ""}
    ${body}
  </div>
</body>
</html>`;
}

function html(body: string, status = 200, headers?: HeadersInit) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

async function bustCache(env: Env, country?: string) {
  await cacheDelete(env, "page:/", "sitemap", ...(country ? [`page:/${country}`] : []));
}

function draftFrom(form: FormData): ListingDraft {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const name = text("name");
  return {
    slug: slugify(text("slug") || name),
    name,
    country_code: text("country_code").toLowerCase(),
    city_slug: slugify(text("city_slug")),
    suburb: text("suburb") || null,
    address: text("address") || null,
    phone: text("phone") || null,
    email: text("email") || null,
    website: text("website") || null,
    services: text("services") || "Traditional Thai",
    description: text("description") || name,
    price_from: text("price_from") ? Number(text("price_from")) : null,
    currency: text("currency") || null,
    premium: text("premium") ? Number(text("premium")) : 0,
    claimed: form.get("claimed") ? 1 : 0,
    hours: text("hours") || null,
    image_url: text("image_url") || null,
  };
}

function listingFields(listing?: Partial<Listing>): string {
  return `
    <div class="admin-grid">
      <div><label>Name</label><input name="name" required value="${escapeAttr(listing?.name ?? "")}"></div>
      <div><label>Slug</label><input name="slug" value="${escapeAttr(listing?.slug ?? "")}" placeholder="auto from name"></div>
      <div><label>Country code</label><input name="country_code" required maxlength="2" value="${escapeAttr(listing?.country_code ?? "")}" placeholder="us uk au de"></div>
      <div><label>City slug</label><input name="city_slug" required value="${escapeAttr(listing?.city_slug ?? "")}" placeholder="berlin"></div>
      <div><label>Suburb</label><input name="suburb" value="${escapeAttr(listing?.suburb ?? "")}"></div>
      <div><label>Address</label><input name="address" value="${escapeAttr(listing?.address ?? "")}"></div>
      <div><label>Phone</label><input name="phone" value="${escapeAttr(listing?.phone ?? "")}"></div>
      <div><label>Email</label><input name="email" type="email" value="${escapeAttr(listing?.email ?? "")}"></div>
      <div><label>Website</label><input name="website" value="${escapeAttr(listing?.website ?? "")}"></div>
      <div><label>Image URL</label><input name="image_url" value="${escapeAttr(listing?.image_url ?? "")}"></div>
      <div><label>Price from</label><input name="price_from" type="number" value="${escapeAttr(listing?.price_from ?? "")}"></div>
      <div><label>Currency</label><input name="currency" value="${escapeAttr(listing?.currency ?? "USD")}"></div>
      <div><label>Premium (0–2)</label><input name="premium" type="number" min="0" max="2" value="${escapeAttr(listing?.premium ?? 0)}"></div>
      <div><label>Hours</label><input name="hours" value="${escapeAttr(listing?.hours ?? "")}"></div>
    </div>
    <div><label>Services</label><input name="services" required value="${escapeAttr(listing?.services ?? "Traditional Thai")}"></div>
    <div><label>Description</label><textarea name="description" required rows="5">${escapeHtml(listing?.description ?? "")}</textarea></div>
    <label class="check"><input type="checkbox" name="claimed" value="1" ${listing?.claimed ? "checked" : ""}> Claimed / verified</label>
  `;
}

function affiliateDraftFrom(form: FormData): AffiliateDraft {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  return {
    country_code: (text("country_code") || "all").toLowerCase(),
    program_name: text("program_name"),
    company_name: text("company_name") || "Thai Massage For U",
    signup_url: text("signup_url"),
    login_url: text("login_url") || null,
    contact_email: text("contact_email") || null,
    affiliate_id: text("affiliate_id") || null,
    login_email: text("login_email") || null,
    login_secret: text("login_secret") || null,
    notes: text("notes") || null,
    status: text("status") || "todo",
  };
}

function countryOptions(value: string): string {
  return Object.entries(COUNTRY_LABELS)
    .map(
      ([code, label]) =>
        `<option value="${escapeAttr(code)}" ${value === code ? "selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function statusOptions(value: string): string {
  return ["todo", "applied", "live", "paused", "skip"]
    .map((status) => `<option value="${escapeAttr(status)}" ${value === status ? "selected" : ""}>${escapeHtml(status)}</option>`)
    .join("");
}

function affiliateFields(program?: Partial<AffiliateProgram>, isEdit = false): string {
  return `
    <div class="admin-grid">
      <div><label>Program name</label><input name="program_name" required value="${escapeAttr(program?.program_name ?? "")}" placeholder="Trustpilot Business"></div>
      <div><label>Country</label><select name="country_code">${countryOptions(program?.country_code ?? "all")}</select></div>
      <div><label>Your company name</label><input name="company_name" required value="${escapeAttr(program?.company_name ?? "Thai Massage For U")}"></div>
      <div><label>Status</label><select name="status">${statusOptions(program?.status ?? "todo")}</select></div>
      <div><label>Official signup URL</label><input name="signup_url" required value="${escapeAttr(program?.signup_url ?? "")}" placeholder="https://"></div>
      <div><label>Login URL</label><input name="login_url" value="${escapeAttr(program?.login_url ?? "")}" placeholder="https://"></div>
      <div><label>Contact email</label><input name="contact_email" type="email" value="${escapeAttr(program?.contact_email ?? "")}"></div>
      <div><label>Login email</label><input name="login_email" type="email" autocomplete="off" value="${escapeAttr(program?.login_email ?? "")}"></div>
      <div><label>Affiliate / publisher ID</label><input name="affiliate_id" value="${escapeAttr(program?.affiliate_id ?? "")}"></div>
      <div><label>Signup password</label><input name="login_secret" type="password" autocomplete="new-password" placeholder="${escapeAttr(isEdit ? "Leave blank to keep the saved password" : "Blank uses your preferred password")}"></div>
    </div>
    <div><label>Notes</label><textarea name="notes" rows="4">${escapeHtml(program?.notes ?? "")}</textarea></div>
    <p class="small">Passwords stay on this admin screen. Public pages never see them. This Worker does not submit signup forms on other companies’ websites.</p>
  `;
}

function kitCards(programs: AffiliateProgram[], defaults: AffiliateDefaults): string {
  const groups = new Map<string, AffiliateProgram[]>();
  for (const program of programs) {
    const key = program.country_code;
    const list = groups.get(key) ?? [];
    list.push(program);
    groups.set(key, list);
  }
  const phone = kitPhone(defaults);
  const address = kitAddress(defaults);
  const bio = kitBio(defaults);
  return [...groups.entries()]
    .map(([code, rows]) => {
      const cards = rows
        .map((program) => {
          const email = kitEmail(program, defaults);
          const secret = kitSecret(program, defaults);
          const id = `secret-${program.id}`;
          return `<article class="kit-card">
            <h3>${escapeHtml(program.program_name)}</h3>
            <p class="small">${escapeHtml(program.status)} · ${escapeHtml(program.company_name)}</p>
            ${program.notes ? `<p>${escapeHtml(program.notes)}</p>` : ""}
            <label>Company name<input readonly value="${escapeAttr(program.company_name)}"></label>
            <label>Login email<input readonly value="${escapeAttr(email)}"></label>
            <label>Preferred password<input id="${escapeAttr(id)}" class="kit-secret" type="password" readonly value="${escapeAttr(secret)}" autocomplete="off"></label>
            <label class="check"><input type="checkbox" onchange="document.getElementById('${escapeAttr(id)}').type=this.checked?'text':'password'"> Show password</label>
            <label>Phone${phone ? "" : ' <span class="small">(not set)</span>'}<input readonly value="${escapeAttr(phone)}"></label>
            <label>Address${address ? "" : ' <span class="small">(not set — city/suburb only, or not applicable)</span>'}<input readonly value="${escapeAttr(address)}"></label>
            ${bio ? `<label>Business bio<textarea readonly rows="3">${escapeHtml(bio)}</textarea></label>` : ""}
            <div class="hero-actions">
              <a class="btn btn-primary" href="${escapeAttr(program.signup_url)}" rel="noopener noreferrer" target="_blank">Open signup</a>
              ${program.login_url ? `<a class="btn btn-outline" href="${escapeAttr(program.login_url)}" rel="noopener noreferrer" target="_blank">Open login</a>` : ""}
              <a class="btn btn-secondary" href="/admin/affiliates/${program.id}">Edit</a>
            </div>
          </article>`;
        })
        .join("");
      return `<h2>${escapeHtml(COUNTRY_LABELS[code] ?? code)}</h2><div class="kit-grid">${cards}</div>`;
    })
    .join("");
}

export function adminApp() {
  const admin = new Hono<AppEnv>();

  admin.use("*", async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (path === "/admin/login" || path === "/admin/logout") return next();
    const secret = adminPassword(c.env);
    if (!(await hasValidSession(c.req.raw, secret))) {
      return c.redirect("/admin/login", 302);
    }
    await next();
  });

  admin.get("/login", (c) => {
    const failed = c.req.query("err") === "1";
    return html(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Admin login</title><link rel="stylesheet" href="/styles.css"></head>
<body class="admin"><div class="container page-title" style="max-width:420px;padding:4rem 0">
  <h1>Directory admin</h1>
  <p>Password-protected Worker CMS. Listings write to D1.</p>
  ${failed ? `<p class="form-notice err">That password did not match.</p>` : ""}
  <form class="admin-form" action="/admin/login" method="post" style="display:grid;gap:1rem">
    <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
    <button class="btn btn-primary" type="submit">Log in</button>
  </form>
</div></body></html>`);
  });

  admin.post("/login", async (c) => {
    const secret = adminPassword(c.env);
    const password = String((await c.req.formData()).get("password") ?? "");
    if (!(await passwordsMatch(password, secret))) {
      return c.redirect("/admin/login?err=1", 303);
    }
    const secure = new URL(c.req.url).protocol === "https:";
    return new Response(null, {
      status: 303,
      headers: {
        location: "/admin",
        "set-cookie": await createSessionCookie(secret, secure),
        "cache-control": "no-store",
      },
    });
  });

  admin.get("/logout", () =>
    new Response(null, {
      status: 303,
      headers: { location: "/admin/login", "set-cookie": clearSessionCookie() },
    })
  );

  admin.get("/", async (c) => {
    const [inbox, countries, cities] = await Promise.all([
      adminInbox(c.env.DB),
      listCountries(c.env.DB),
      listCities(c.env.DB),
    ]);
    const body = `
      <h1>Dashboard</h1>
      <p>${escapeHtml(String(inbox.listingCount))} listings · ${escapeHtml(String(inbox.offerCount))} offers · ${escapeHtml(String(inbox.claimCount))} claims · ${escapeHtml(String(cities.length))} city landers</p>
      <div class="cards">
        ${countries
          .map(
            (country) =>
              `<article class="card"><h2>${escapeHtml(country.flag)} ${escapeHtml(country.name)}</h2>
              <p>Country look-and-feel is <code>theme-${escapeHtml(country.code)}</code>. Each city stacks <code>theme-${escapeHtml(country.code)}-{slug}</code> on top.</p>
              <a class="btn btn-secondary" href="/${escapeAttr(country.code)}" target="_blank" rel="noreferrer">Open hub</a></article>`
          )
          .join("")}
      </div>
      <h2>Recent offers</h2>
      <table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Offer</th><th>Status</th></tr></thead><tbody>
        ${inbox.offers
          .map(
            (row) =>
              `<tr><td>${escapeHtml(String(row.name ?? ""))}</td><td>${escapeHtml(String(row.email ?? ""))}</td><td>${escapeHtml(String(row.offer_amount ?? ""))} ${escapeHtml(String(row.currency ?? ""))}</td><td>${escapeHtml(String(row.status ?? ""))}</td></tr>`
          )
          .join("") || `<tr><td colspan="4">No offers yet.</td></tr>`}
      </tbody></table>
      <h2>Recent claims</h2>
      <table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead><tbody>
        ${inbox.claims
          .map(
            (row) =>
              `<tr><td>${escapeHtml(String(row.name ?? ""))}</td><td>${escapeHtml(String(row.email ?? ""))}</td><td>${escapeHtml(String(row.status ?? ""))}</td></tr>`
          )
          .join("") || `<tr><td colspan="3">No claims yet.</td></tr>`}
      </tbody></table>`;
    return html(adminChrome("Dashboard", body));
  });

  admin.get("/listings", async (c) => {
    const country = (c.req.query("country") ?? "").trim();
    const city = (c.req.query("city") ?? "").trim();
    const q = (c.req.query("q") ?? "").trim();
    const listings = await listAdminListings(c.env.DB, { country, city, q });
    const body = `
      <h1>Listings</h1>
      <form method="get" class="hero-search">
        <input name="country" value="${escapeAttr(country)}" placeholder="country">
        <input name="city" value="${escapeAttr(city)}" placeholder="city slug">
        <input name="q" value="${escapeAttr(q)}" placeholder="search">
        <button class="btn btn-primary" type="submit">Filter</button>
        <a class="btn btn-secondary" href="/admin/listings/new">New listing</a>
      </form>
      <table class="admin-table"><thead><tr><th>Name</th><th>City</th><th>Premium</th><th></th></tr></thead><tbody>
        ${listings
          .map(
            (listing) =>
              `<tr><td>${escapeHtml(listing.name)}</td><td>${escapeHtml(listing.country_code)}/${escapeHtml(listing.city_slug)}</td><td>${escapeHtml(String(listing.premium))}</td><td><a href="/admin/listings/${listing.id}">Edit</a></td></tr>`
          )
          .join("")}
      </tbody></table>`;
    return html(adminChrome("Listings", body, c.req.query("saved") === "1" ? "Listing saved." : ""));
  });

  admin.get("/listings/new", (c) => {
    const body = `<h1>New listing</h1>
      <form class="admin-form" method="post" action="/admin/listings">
        ${listingFields()}
        <button class="btn btn-primary" type="submit">Create listing</button>
      </form>`;
    return html(adminChrome("New listing", body));
  });

  admin.post("/listings", async (c) => {
    const draft = draftFrom(await c.req.formData());
    const city = await getCity(c.env.DB, draft.country_code, draft.city_slug);
    if (!draft.name || !draft.slug || !city) {
      return html(adminChrome("New listing", `<p class="form-notice err">Name, slug and a known city are required.</p><form class="admin-form" method="post" action="/admin/listings">${listingFields(draft)}<button class="btn btn-primary" type="submit">Create listing</button></form>`), 400);
    }
    await createListing(c.env.DB, draft);
    await bustCache(c.env, draft.country_code);
    return c.redirect("/admin/listings?saved=1", 303);
  });

  admin.get("/listings/:id", async (c) => {
    const listing = await getListingById(c.env.DB, Number(c.req.param("id")));
    if (!listing) return c.notFound();
    const body = `<h1>Edit ${escapeHtml(listing.name)}</h1>
      <p><a href="/${escapeAttr(listing.country_code)}/${escapeAttr(listing.city_slug)}/${escapeAttr(listing.slug)}" target="_blank" rel="noreferrer">Open public page</a></p>
      <form class="admin-form" method="post" action="/admin/listings/${listing.id}">
        ${listingFields(listing)}
        <button class="btn btn-primary" type="submit">Save</button>
      </form>
      <form method="post" action="/admin/listings/${listing.id}/delete" onsubmit="return confirm('Delete this listing?')">
        <button class="btn btn-outline" type="submit">Delete</button>
      </form>`;
    return html(adminChrome(`Edit ${listing.name}`, body));
  });

  admin.post("/listings/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const existing = await getListingById(c.env.DB, id);
    if (!existing) return c.notFound();
    const draft = draftFrom(await c.req.formData());
    const city = await getCity(c.env.DB, draft.country_code, draft.city_slug);
    if (!draft.name || !draft.slug || !city) {
      return html(adminChrome("Edit listing", `<p class="form-notice err">Name, slug and a known city are required.</p>`), 400);
    }
    await updateListing(c.env.DB, id, draft);
    await bustCache(c.env, draft.country_code);
    if (existing.country_code !== draft.country_code) await bustCache(c.env, existing.country_code);
    return c.redirect(`/admin/listings?saved=1`, 303);
  });

  admin.post("/listings/:id/delete", async (c) => {
    const id = Number(c.req.param("id"));
    const existing = await getListingById(c.env.DB, id);
    if (!existing) return c.notFound();
    await deleteListing(c.env.DB, id);
    await bustCache(c.env, existing.country_code);
    return c.redirect("/admin/listings", 303);
  });

  admin.get("/crm", async (c) => {
    const country = (c.req.query("country") ?? "").trim();
    const city = (c.req.query("city") ?? "").trim();
    const stage = (c.req.query("stage") ?? "").trim();
    const q = (c.req.query("q") ?? "").trim();
    const [contacts, counts] = await Promise.all([
      listCrmContacts(c.env.DB, { country, city, stage, q }),
      crmStageCounts(c.env.DB),
    ]);
    const stageOptions = (value: string) =>
      CRM_STAGES.map((s) => `<option value="${escapeAttr(s)}" ${value === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("");
    const body = `
      <h1>Outreach CRM</h1>
      <p>Real, unclaimed listings scraped from OpenStreetMap, tracked here so you know who's been reached and who hasn't. This table only tracks status — it does not send email or SMS. Sending needs a real provider and a compliance decision (consent, opt-out, CAN-SPAM/TCPA/PECR/GDPR depending on the country) that hasn't been made yet.</p>
      <p class="small">${CRM_STAGES.map((s) => `${escapeHtml(s)}: ${escapeHtml(String(counts[s] ?? 0))}`).join(" · ")}</p>
      <form method="get" class="hero-search">
        <input name="country" value="${escapeAttr(country)}" placeholder="country">
        <input name="city" value="${escapeAttr(city)}" placeholder="city slug">
        <select name="stage"><option value="">Any stage</option>${stageOptions(stage)}</select>
        <input name="q" value="${escapeAttr(q)}" placeholder="search name/email/phone">
        <button class="btn btn-primary" type="submit">Filter</button>
      </form>
      <table class="admin-table"><thead><tr><th>Business</th><th>City</th><th>Phone</th><th>Email</th><th>Stage</th><th>Notes</th><th></th></tr></thead><tbody>
        ${
          contacts
            .map((contact) => {
              const formId = `crm-${contact.id}`;
              return `<tr>
                <td>${escapeHtml(contact.business_name)}${contact.website ? ` · <a href="${escapeAttr(contact.website)}" target="_blank" rel="noopener noreferrer">site</a>` : ""}</td>
                <td>${escapeHtml(contact.country_code)}/${escapeHtml(contact.city_slug)}</td>
                <td>${escapeHtml(contact.phone ?? "—")}</td>
                <td>${escapeHtml(contact.email ?? "—")}</td>
                <td><select name="stage" form="${escapeAttr(formId)}">${stageOptions(contact.stage)}</select></td>
                <td><input name="notes" form="${escapeAttr(formId)}" value="${escapeAttr(contact.notes ?? "")}" placeholder="notes"></td>
                <td>
                  <label class="check"><input type="checkbox" name="contacted_now" value="1" form="${escapeAttr(formId)}"> just contacted</label>
                  <button class="btn btn-secondary" type="submit" form="${escapeAttr(formId)}">Save</button>
                  <form id="${escapeAttr(formId)}" method="post" action="/admin/crm/${contact.id}"></form>
                </td>
              </tr>`;
            })
            .join("") || `<tr><td colspan="7">No contacts match this filter.</td></tr>`
        }
      </tbody></table>`;
    return html(adminChrome("Outreach CRM", body, c.req.query("saved") === "1" ? "Contact updated." : ""));
  });

  admin.post("/crm/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const form = await c.req.formData();
    const stage = String(form.get("stage") ?? "new") as CrmStage;
    if (!CRM_STAGES.includes(stage)) return c.notFound();
    const notes = String(form.get("notes") ?? "").trim() || null;
    const markContacted = Boolean(form.get("contacted_now"));
    await updateCrmContact(c.env.DB, id, { stage, notes, markContacted });
    const back = new URL(c.req.url);
    back.pathname = "/admin/crm";
    back.searchParams.set("saved", "1");
    return c.redirect(back.toString(), 303);
  });

  admin.get("/affiliates", async (c) => {
    const [programs, defaults] = await Promise.all([listAffiliatePrograms(c.env.DB), getAffiliateDefaults(c.env.DB)]);
    const noticeText =
      c.req.query("saved") === "1"
        ? "Affiliate details saved."
        : c.req.query("defaults") === "1"
          ? "Preferred company identity saved."
          : "";
    const body = `
      <h1>Referral and affiliate kit</h1>
      <p>Store the company name, login email and preferred password you use on review and booking partner sites. Open each official signup page in a new tab and paste these fields. This directory never creates accounts on other companies’ websites.</p>
      <form class="admin-form" method="post" action="/admin/affiliates/defaults" autocomplete="off">
        <h2>Your preferred identity</h2>
        <div class="admin-grid">
          <div><label>Company name</label><input name="company_name" required value="${escapeAttr(defaults.company_name)}"></div>
          <div><label>Public website</label><input name="website" value="${escapeAttr(defaults.website ?? "")}"></div>
          <div><label>Contact email</label><input name="contact_email" type="email" value="${escapeAttr(defaults.contact_email ?? "")}"></div>
          <div><label>Login email</label><input name="login_email" type="email" autocomplete="off" value="${escapeAttr(defaults.login_email ?? "")}"></div>
          <div><label>Preferred signup password</label><input name="login_secret" type="password" autocomplete="new-password" placeholder="${escapeAttr(defaults.login_secret ? "Leave blank to keep the saved password" : "Choose a password you only use for partner dashboards")}"></div>
          <div><label>Phone</label><input name="phone" value="${escapeAttr(defaults.phone ?? "")}"></div>
          <div><label>Address (city/suburb level is fine)</label><input name="address" value="${escapeAttr(defaults.address ?? "")}"></div>
        </div>
        <div><label>Business bio (for "describe your business" fields)</label><textarea name="bio" rows="3">${escapeHtml(defaults.bio ?? "")}</textarea></div>
        <div><label>Notes</label><textarea name="notes" rows="3">${escapeHtml(defaults.notes ?? "")}</textarea></div>
        <button class="btn btn-primary" type="submit">Save identity</button>
      </form>
      <p><a class="btn btn-secondary" href="/admin/affiliates/new">Add a partner program</a></p>
      <table class="admin-table"><thead><tr><th>Program</th><th>Country</th><th>Status</th><th>Password</th><th></th></tr></thead><tbody>
        ${
          programs
            .map(
              (program) =>
                `<tr><td>${escapeHtml(program.program_name)}</td><td>${escapeHtml(COUNTRY_LABELS[program.country_code] ?? program.country_code)}</td><td>${escapeHtml(program.status)}</td><td>${kitSecret(program, defaults) ? "saved" : "missing"}</td><td><a href="/admin/affiliates/${program.id}">Edit</a></td></tr>`
            )
            .join("") || `<tr><td colspan="5">No partner programs yet.</td></tr>`
        }
      </tbody></table>
      <h2>Register in one sitting</h2>
      <p>Each card already has your company name, email, password, phone, address and bio — every field these signup forms usually ask for. Open signup, paste top to bottom, then mark the row live. This Worker does not submit these forms itself.</p>
      ${kitCards(programs, defaults)}`;
    return html(adminChrome("Affiliates", body, noticeText));
  });

  admin.post("/affiliates/defaults", async (c) => {
    const form = await c.req.formData();
    const text = (key: string) => String(form.get(key) ?? "").trim();
    await saveAffiliateDefaults(c.env.DB, {
      company_name: text("company_name") || "Thai Massage For U",
      contact_email: text("contact_email") || null,
      login_email: text("login_email") || null,
      login_secret: text("login_secret") || null,
      website: text("website") || null,
      notes: text("notes") || null,
      phone: text("phone") || null,
      address: text("address") || null,
      bio: text("bio") || null,
    });
    return c.redirect("/admin/affiliates?defaults=1", 303);
  });

  admin.get("/affiliates/new", async (c) => {
    const defaults = await getAffiliateDefaults(c.env.DB);
    const body = `<h1>Add a partner program</h1>
      <form class="admin-form" method="post" action="/admin/affiliates" autocomplete="off">
        ${affiliateFields({
          company_name: defaults.company_name,
          contact_email: defaults.contact_email,
          login_email: defaults.login_email,
          country_code: "all",
          status: "todo",
        })}
        <button class="btn btn-primary" type="submit">Save program</button>
      </form>`;
    return html(adminChrome("New affiliate program", body));
  });

  admin.post("/affiliates", async (c) => {
    const draft = affiliateDraftFrom(await c.req.formData());
    if (!draft.program_name || !draft.signup_url) {
      return html(
        adminChrome(
          "New affiliate program",
          `<p class="form-notice err">Program name and an official signup URL are required.</p><form class="admin-form" method="post" action="/admin/affiliates">${affiliateFields(draft)}<button class="btn btn-primary" type="submit">Save program</button></form>`
        ),
        400
      );
    }
    await createAffiliateProgram(c.env.DB, draft);
    return c.redirect("/admin/affiliates?saved=1", 303);
  });

  admin.get("/affiliates/:id", async (c) => {
    const program = await getAffiliateProgram(c.env.DB, Number(c.req.param("id")));
    if (!program) return c.notFound();
    const body = `<h1>Edit ${escapeHtml(program.program_name)}</h1>
      <p><a href="${escapeAttr(program.signup_url)}" rel="noopener noreferrer" target="_blank">Open official signup</a></p>
      <form class="admin-form" method="post" action="/admin/affiliates/${program.id}" autocomplete="off">
        ${affiliateFields(program, true)}
        <button class="btn btn-primary" type="submit">Save</button>
      </form>
      <form method="post" action="/admin/affiliates/${program.id}/delete" onsubmit="return confirm('Delete this partner program?')">
        <button class="btn btn-outline" type="submit">Delete</button>
      </form>`;
    return html(adminChrome(`Edit ${program.program_name}`, body));
  });

  admin.post("/affiliates/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const existing = await getAffiliateProgram(c.env.DB, id);
    if (!existing) return c.notFound();
    const draft = affiliateDraftFrom(await c.req.formData());
    if (!draft.program_name || !draft.signup_url) {
      return html(adminChrome("Edit affiliate program", `<p class="form-notice err">Program name and an official signup URL are required.</p>`), 400);
    }
    await updateAffiliateProgram(c.env.DB, id, draft);
    return c.redirect("/admin/affiliates?saved=1", 303);
  });

  admin.post("/affiliates/:id/delete", async (c) => {
    const id = Number(c.req.param("id"));
    const existing = await getAffiliateProgram(c.env.DB, id);
    if (!existing) return c.notFound();
    await deleteAffiliateProgram(c.env.DB, id);
    return c.redirect("/admin/affiliates", 303);
  });

  return admin;
}
