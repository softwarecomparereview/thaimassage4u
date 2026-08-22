import { Hono } from "hono";
import { FormLimiter } from "./limiter";
import { SaleOfferWorkflow } from "./workflow";
import { LEGACY_REDIRECTS } from "./lib/legacy";
import {
  countListings,
  featuredListings,
  featuredListingsByCountry,
  getCity,
  getCountry,
  getListing,
  keywordStats,
  listCities,
  listCountries,
  listListings,
  searchListings,
} from "./lib/db";
import {
  renderArticle,
  renderBlog,
  renderCity,
  renderClaim,
  renderContact,
  renderCountry,
  renderFaq,
  renderHome,
  renderLegal,
  renderListing,
  renderNotFound,
  renderPricing,
  renderSale,
  renderSearch,
} from "./views";
import { enqueueCityScrapes, scrapeCityDirectory } from "./scrape";
import type { LeadMessage } from "./lib/messages";
import { enqueueCityEnrichment, enrichCityFromPlaces } from "./lib/enrich";
import { enqueueDailySerp, latestSerpPlan, refreshCitySerp } from "./lib/serp";
import { adminAuthorized } from "./lib/secrets";
import { thumbnailListing } from "./lib/thumbnails";
import { adminApp } from "./admin";
import { cacheDelete, cacheGet, cachePut, mediaGet, mediaPut } from "./lib/storage";
import { ARTICLES } from "./lib/articles";
import {
  clearCountryCookie,
  clearInternationalCookie,
  countryChoiceCookie,
  geoHomeLocation,
  internationalCookie,
  pathCountry,
  requestCountry,
  wantsInternational,
} from "./lib/geo";

export { FormLimiter, SaleOfferWorkflow };

type AppEnv = { Bindings: Env };

const STATIC_PREFIX = /^\/(styles\.css|themes\.css|app\.js|images\/|favicon\.ico)/;
const SCRAPE_CRON = "15 */6 * * *";
const SERP_CRON = "20 6 * * *";

const app = new Hono<AppEnv>();

function geoHint(request: Request): string | null {
  return requestCountry(request);
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
}

function track(env: Env, request: Request, name: string) {
  try {
    env.ANALYTICS?.writeDataPoint({
      blobs: [name, new URL(request.url).pathname, request.headers.get("CF-IPCountry") ?? "XX"],
      doubles: [1],
      indexes: [env.CF_VERSION_METADATA?.id ?? "dev"],
    });
  } catch {
    /* analytics is optional on first deploy */
  }
}

async function shell(env: Env, request: Request) {
  return { env, countries: await listCountries(env.DB), geo: geoHint(request) };
}

async function cachedHtml(env: Env, key: string, build: () => Promise<string>, ttl = 300): Promise<string> {
  const hit = await cacheGet(env, key);
  if (hit) return hit;
  const html = await build();
  await cachePut(env, key, html, ttl);
  return html;
}

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=60" : "no-store",
    },
  });
}

function redirect(location: string, status = 301) {
  return new Response(null, { status, headers: { location } });
}

async function limit(env: Env, request: Request) {
  const id = env.FORM_LIMITER.idFromName(clientIp(request));
  return env.FORM_LIMITER.get(id).allow();
}

function readFields(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  return {
    name: text("name"),
    email: text("email"),
    message: text("message"),
    company: text("company"),
    offer_amount: text("offer_amount"),
    currency: text("currency") || "AUD",
    phone: text("phone"),
    role: text("role"),
    listing_slug: text("listing_slug"),
    topic: text("topic"),
    website: text("website"),
    consent: text("consent"),
  };
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (STATIC_PREFIX.test(url.pathname) && c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  const legacy = LEGACY_REDIRECTS[url.pathname];
  if (legacy) return redirect(legacy);
  await next();
  const country = pathCountry(url.pathname);
  if (country && c.res.status < 400) {
    c.header("set-cookie", countryChoiceCookie(country), { append: true });
    c.header("set-cookie", clearInternationalCookie(), { append: true });
  }
});

app.get("/", async (c) => {
  const geoLocation = geoHomeLocation(c.req.raw);
  if (geoLocation) {
    return new Response(null, {
      status: 302,
      headers: {
        location: geoLocation,
        "cache-control": "private, no-store",
        vary: "CF-IPCountry, User-Agent, Cookie",
      },
    });
  }
  track(c.env, c.req.raw, "view");
  const body = await cachedHtml(c.env, "page:/", async () => {
    const s = await shell(c.env, c.req.raw);
    const [featured, keywords, cities] = await Promise.all([
      featuredListings(c.env.DB),
      keywordStats(c.env.DB),
      listCities(c.env.DB),
    ]);
    const counts: Record<string, number> = {};
    await Promise.all(
      s.countries.map(async (country) => {
        counts[country.code] = await countListings(c.env.DB, country.code);
      })
    );
    return renderHome(s, counts, featured, keywords, cities);
  });
  const response = html(body);
  if (wantsInternational(c.req.raw)) {
    response.headers.append("set-cookie", internationalCookie());
    response.headers.append("set-cookie", clearCountryCookie());
  }
  response.headers.set("vary", "CF-IPCountry, User-Agent, Cookie");
  return response;
});

app.get("/for-sale", async (c) => {
  track(c.env, c.req.raw, "view");
  return html(renderSale(await shell(c.env, c.req.raw), c.req.query("sent")));
});

app.get("/claim", async (c) => html(renderClaim(await shell(c.env, c.req.raw), null, c.req.query("sent"))));
app.get("/claim/:slug", async (c) => {
  const listing = await getListing(c.env.DB, c.req.param("slug"));
  return html(renderClaim(await shell(c.env, c.req.raw), listing, c.req.query("sent")));
});

app.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  const listings = q.length >= 2 ? await searchListings(c.env.DB, q) : [];
  return html(renderSearch(await shell(c.env, c.req.raw), q, listings));
});

app.get("/faq", async (c) => html(renderFaq(await shell(c.env, c.req.raw))));
app.get("/contact", async (c) => html(renderContact(await shell(c.env, c.req.raw), c.req.query("sent"))));
app.get("/pricing", async (c) => html(renderPricing(await shell(c.env, c.req.raw))));
app.get("/blog", async (c) => html(renderBlog(await shell(c.env, c.req.raw))));
app.get("/blog/:slug", async (c) => {
  const article = ARTICLES.find((item) => item.slug === c.req.param("slug"));
  if (!article) return html(renderNotFound(await shell(c.env, c.req.raw)), 404);
  return html(renderArticle(await shell(c.env, c.req.raw), article));
});
app.get("/privacy", async (c) => html(renderLegal(await shell(c.env, c.req.raw), "privacy")));
app.get("/terms", async (c) => html(renderLegal(await shell(c.env, c.req.raw), "terms")));

app.route("/admin", adminApp());

app.get("/robots.txt", (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /claim\nSitemap: ${c.env.SITE_URL}/sitemap.xml\n`)
);

app.get("/sitemap.xml", async (c) => {
  const cached = await cacheGet(c.env, "sitemap");
  if (cached) return c.body(cached, 200, { "content-type": "application/xml; charset=utf-8" });
  const [countries, cities] = await Promise.all([listCountries(c.env.DB), listCities(c.env.DB)]);
  const { results: listings } = await c.env.DB.prepare("SELECT slug, country_code, city_slug FROM listings").all<{
    slug: string;
    country_code: string;
    city_slug: string;
  }>();
  const urls = [
    "/",
    "/for-sale",
    "/faq",
    "/contact",
    "/pricing",
    "/blog",
    ...ARTICLES.map((article) => `/blog/${article.slug}`),
    "/search",
    ...countries.map((country) => `/${country.code}`),
    ...cities.map((city) => `/${city.country_code}/${city.slug}`),
    ...listings.map((listing) => `/${listing.country_code}/${listing.city_slug}/${listing.slug}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((path) => `  <url><loc>${c.env.SITE_URL}${path}</loc><changefreq>weekly</changefreq></url>`)
    .join("\n")}\n</urlset>\n`;
  await cachePut(c.env, "sitemap", xml, 3600);
  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

app.post("/api/offers", async (c) => {
  const gate = await limit(c.env, c.req.raw);
  if (!gate.ok) return redirect("/for-sale?sent=0", 303);
  const fields = readFields(await c.req.formData());
  if (fields.website || !fields.name || !validEmail(fields.email) || fields.message.length < 8 || fields.consent !== "yes") {
    return redirect("/for-sale?sent=0", 303);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO sale_offers (id, name, email, company, offer_amount, currency, message, website, country_hint)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      fields.name.slice(0, 80),
      fields.email.slice(0, 120),
      fields.company.slice(0, 120) || null,
      fields.offer_amount.slice(0, 40) || null,
      fields.currency.slice(0, 8),
      fields.message.slice(0, 2000),
      null,
      geoHint(c.req.raw)
    )
    .run();
  c.executionCtx.waitUntil(
    Promise.all([
      c.env.LEADS.send({ kind: "offer", id }),
      c.env.OFFER_WORKFLOW.create({ id, params: { offerId: id } }),
    ]).catch((error) => console.error(JSON.stringify({ event: "offer-fanout-failed", error: String(error) })))
  );
  track(c.env, c.req.raw, "offer");
  return redirect("/for-sale?sent=1", 303);
});

app.post("/api/claims", async (c) => {
  const gate = await limit(c.env, c.req.raw);
  if (!gate.ok) return redirect("/claim?sent=0", 303);
  const fields = readFields(await c.req.formData());
  const listing = await getListing(c.env.DB, fields.listing_slug);
  if (fields.website || !listing || !fields.name || !validEmail(fields.email) || fields.message.length < 8) {
    return redirect("/claim?sent=0", 303);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO claims (id, listing_id, name, email, phone, role, message) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, listing.id, fields.name, fields.email, fields.phone || null, fields.role || null, fields.message)
    .run();
  c.executionCtx.waitUntil(c.env.LEADS.send({ kind: "claim", id }));
  return redirect(`/claim/${listing.slug}?sent=1`, 303);
});

app.post("/api/contact", async (c) => {
  const gate = await limit(c.env, c.req.raw);
  if (!gate.ok) return redirect("/contact?sent=0", 303);
  const fields = readFields(await c.req.formData());
  if (fields.website || !fields.name || !validEmail(fields.email) || fields.message.length < 8) {
    return redirect("/contact?sent=0", 303);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO contacts (id, name, email, topic, message) VALUES (?, ?, ?, ?, ?)")
    .bind(id, fields.name, fields.email, fields.topic || null, fields.message)
    .run();
  c.executionCtx.waitUntil(c.env.LEADS.send({ kind: "contact", id }));
  return redirect("/contact?sent=1", 303);
});

app.get("/media/*", async (c) => {
  const key = new URL(c.req.url).pathname.replace(/^\/media\//, "");
  if (!key || key.includes("..")) return c.notFound();
  const object = await mediaGet(c.env, key);
  if (!object) return c.notFound();
  const headers = new Headers();
  headers.set("cache-control", "public, max-age=86400");
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
});

app.post("/api/scrape/:country/:city", async (c) => {
  if (!adminAuthorized(c.env, c.req.header("x-admin-key"))) return c.json({ error: "unauthorized" }, 401);
  const result = await scrapeCityDirectory(c.env, c.req.param("country"), c.req.param("city"));
  return c.json({ ok: true, ...result });
});

app.post("/api/enrich/:country/:city", async (c) => {
  if (!adminAuthorized(c.env, c.req.header("x-admin-key"))) return c.json({ error: "unauthorized" }, 401);
  const result = await enrichCityFromPlaces(c.env, c.req.param("country"), c.req.param("city"));
  return c.json({ ok: true, ...result });
});

app.post("/api/serp/:country/:city", async (c) => {
  if (!adminAuthorized(c.env, c.req.header("x-admin-key"))) return c.json({ error: "unauthorized" }, 401);
  const plan = await refreshCitySerp(c.env, c.req.param("country"), c.req.param("city"));
  return c.json({ ok: true, plan });
});

app.get("/:country", async (c) => {
  const country = await getCountry(c.env.DB, c.req.param("country"));
  if (!country) return html(renderNotFound(await shell(c.env, c.req.raw)), 404);
  const body = await cachedHtml(c.env, `page:/${country.code}`, async () => {
    const [cities, keywords, listingCount, featured] = await Promise.all([
      listCities(c.env.DB, country.code),
      keywordStats(c.env.DB, country.code),
      countListings(c.env.DB, country.code),
      featuredListingsByCountry(c.env.DB, country.code, 2),
    ]);
    return renderCountry(await shell(c.env, c.req.raw), country, cities, keywords, listingCount, featured);
  });
  return html(body);
});

app.get("/:country/:city", async (c) => {
  const country = await getCountry(c.env.DB, c.req.param("country"));
  const city = country ? await getCity(c.env.DB, country.code, c.req.param("city")) : null;
  if (!country || !city) return html(renderNotFound(await shell(c.env, c.req.raw)), 404);
  const listings = await listListings(c.env.DB, country.code, city.slug);
  const serp = await latestSerpPlan(c.env.DB, country.code, city.slug);
  return html(renderCity(await shell(c.env, c.req.raw), country, city, listings, serp));
});

app.get("/:country/:city/:slug", async (c) => {
  const listing = await getListing(c.env.DB, c.req.param("slug"));
  if (!listing || listing.country_code !== c.req.param("country") || listing.city_slug !== c.req.param("city")) {
    return html(renderNotFound(await shell(c.env, c.req.raw)), 404);
  }
  const country = await getCountry(c.env.DB, listing.country_code);
  const city = await getCity(c.env.DB, listing.country_code, listing.city_slug);
  if (!country || !city) return html(renderNotFound(await shell(c.env, c.req.raw)), 404);
  return html(renderListing(await shell(c.env, c.req.raw), country, city, listing));
});

app.notFound(async (c) => html(renderNotFound(await shell(c.env, c.req.raw)), 404));

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),

  async queue(batch, env) {
    for (const message of batch.messages) {
      const body = message.body;
      try {
        if (body.kind === "scrape-city") {
          await scrapeCityDirectory(env, body.countryCode, body.citySlug);
        } else if (body.kind === "enrich-city") {
          await enrichCityFromPlaces(env, body.countryCode, body.citySlug);
        } else if (body.kind === "serp-city") {
          await refreshCitySerp(env, body.countryCode, body.citySlug);
        } else if (body.kind === "thumbnail") {
          const listing = await getListing(env.DB, body.slug);
          if (listing) await thumbnailListing(env, listing);
        } else if (body.kind === "offer" || body.kind === "claim" || body.kind === "contact") {
          await mediaPut(env, `leads/${body.kind}/${body.id}.json`, JSON.stringify(body), {
            httpMetadata: { contentType: "application/json" },
          });
        }
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({ event: "queue-error", kind: body.kind, error: String(error) }));
        message.retry();
      }
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await cacheDelete(env, "sitemap", "page:/");
        if (controller.cron === SERP_CRON) {
          const queued = await enqueueDailySerp(env);
          console.log(JSON.stringify({ event: "scheduled-serp-enqueued", queued }));
          return;
        }
        if (controller.cron === SCRAPE_CRON) {
          const scraped = await enqueueCityScrapes(env);
          const enriched = await enqueueCityEnrichment(env);
          console.log(JSON.stringify({ event: "scheduled-scrape-enqueued", scraped, enriched }));
        }
      })()
    );
  },
} satisfies ExportedHandler<Env, LeadMessage>;
