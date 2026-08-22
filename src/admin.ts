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

  return admin;
}
