import { Hono } from "hono";
import { DurableObject, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { createInquiry, getCityGuide, getDirectoryHome, getListing } from "./directory";
import { handleTrpc } from "./trpc";
import { handleOAuthCallback, getWorkerUser } from "./auth";
import { handleAdminLogin } from "./simple-admin-auth";
import { handleStripeWebhook, handlePublicPremiumCheckout, getStripeMode, setStripeMode } from "./stripe";
import { serveWorkerPage } from "./ssr";
import { geoHomeLocation, internationalCookie, isDirectoryCountry, countryChoiceCookie } from "./geo";
import { handleCreateCampaign, handleSendCampaign, handleListCampaigns, handleListInbox, handleMarkInboxRead, handleUnsubscribe, handleCampaignOpen, handleCampaignClick, handleTwilioStatusWebhook, handleTwilioInboundWebhook } from "./admin-campaigns";
import { processCampaignSend } from "./campaigns";
import { handleClaimStart, handleClaimVerify, handleGetOwnerListing, handleUpdateOwnerListing, handleClaimSearch } from "./claim";
import { handleSitemapIndex, handleSitemapStatic, handleSitemapCities, handleSitemapListings, handleSitemapJournal, handleRobotsTxt } from "./sitemap";
import { handleConciergeEvent, handleConciergeParse } from "./concierge";
import { handleSupplies, handleSuppliesSync, handleSupplyClick, handleSupplyClickStats, refreshAliExpressOffers, syncSupplyOffers } from "./supplies";
import { approveAllProposals, getEnrichmentStatus, reviewProposal, runEnrichmentBatch, updateEnrichmentSettings, type EnrichmentTarget } from "./enrichment";
import { isPublishStatus, listPublishQueue, setListingStatus, setStatusForFilter, type PublishStatus } from "./publish";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  MEDIA: R2Bucket;
  /** Workers AI — listing enrichment. See worker/enrichment.ts. */
  AI: Ai;
  SITE_NAME: string;
  SITE_URL: string;
  CONTACT_EMAIL: string;
  APP_ID: string;
  OAUTH_SERVER_URL: string;
  JWT_SECRET: string;
  OWNER_OPEN_ID: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_SECRET_KEY_TEST?: string;
  STRIPE_WEBHOOK_SECRET: string;
  /** Shared-password fallback admin login — see simple-admin-auth.ts. */
  ADMIN_PASSWORD?: string;
  /** Apify API token (Worker secret) — supplies sync pulls the supply-scanner actor's datasets. */
  APIFY_TOKEN?: string;
  /** AliExpress Affiliates API (Worker secrets) — primary supplies source; links carry the owner's commission tracking. */
  ALIEXPRESS_APP_KEY?: string;
  ALIEXPRESS_APP_SECRET?: string;
  ALIEXPRESS_TRACKING_ID?: string;
  /** Email overflow providers (worker/email.ts) — free tiers stacked on top of Cloudflare's daily quota. */
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;
  MAILJET_API_KEY?: string;
  MAILJET_API_SECRET?: string;
  LEADS: Queue<{ recipientId: number }>;
  /** Cloudflare's native outbound email sending binding — no API token needed. Requires the sending domain verified in the Cloudflare dashboard (Email → Email Sending). */
  EMAIL: SendEmail;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  CF_VERSION_METADATA?: { id?: string; tag?: string };
  /** Analytics Engine (dataset: directory_events) — supply-click datapoints among others. */
  ANALYTICS?: AnalyticsEngineDataset;
  FORM_LIMITER: DurableObjectNamespace<FormLimiter>;
}

type LimiterWindow = { count: number; resetsAt: number };

/** Preserves the existing production binding while the CMS form route is migrated. */
export class FormLimiter extends DurableObject<Env> {
  async allow(limit = 8, windowMs = 60 * 60 * 1000): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
    const now = Date.now();
    const state = (await this.ctx.storage.get<LimiterWindow>("window")) ?? { count: 0, resetsAt: now + windowMs };
    if (now > state.resetsAt) {
      await this.ctx.storage.put("window", { count: 1, resetsAt: now + windowMs });
      return { ok: true };
    }
    if (state.count >= limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((state.resetsAt - now) / 1000)) };
    }
    await this.ctx.storage.put("window", { count: state.count + 1, resetsAt: state.resetsAt });
    return { ok: true };
  }
}

type OfferPayload = { offerId: string };

/** Keeps legacy queued sale-offer records recoverable while Worker storage is migrated. */
export class SaleOfferWorkflow extends WorkflowEntrypoint<Env, OfferPayload> {
  async run(event: WorkflowEvent<OfferPayload>, step: WorkflowStep) {
    const offerId = event.payload.offerId;
    await step.do("archive-offer-to-r2", async () => {
      const row = await this.env.DB.prepare("SELECT * FROM sale_offers WHERE id = ?").bind(offerId).first();
      if (!row) return { skipped: true };
      await this.env.MEDIA.put(`offers/${offerId}.json`, JSON.stringify(row), {
        httpMetadata: { contentType: "application/json" },
      });
      return { archived: true };
    });
    await step.do("mark-offer-queued", async () => {
      await this.env.DB.prepare("UPDATE sale_offers SET status = ? WHERE id = ? AND status = ?")
        .bind("queued", offerId, "new")
        .run();
      return { updated: true };
    });
  }
}

const app = new Hono<{ Bindings: Env }>();

function hardened(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

app.get("/api/health", c =>
  c.json({
    service: "thaimassageforu",
    release: c.env.CF_VERSION_METADATA?.id ?? "local",
    runtime: "cloudflare-worker",
    status: "migration-foundation",
  }),
);

app.get("/api/oauth/callback", c => handleOAuthCallback(c.req.raw, c.env));
app.post("/api/admin/login", c => handleAdminLogin(c.req.raw, c.env));
app.post("/api/stripe/webhook", c => handleStripeWebhook(c.req.raw, c.env));
app.post("/api/premium/checkout", c => handlePublicPremiumCheckout(c.req.raw, c.env));

app.get("/api/directory/home", async c => c.json(await getDirectoryHome(c.env)));

app.all("/api/trpc/*", c => handleTrpc(c.req.raw, c.env));

app.get("/api/directory/city/:slug", async c => {
  const guide = await getCityGuide(c.env, c.req.param("slug"));
  return guide ? c.json(guide) : c.json({ error: "City guide not found" }, 404);
});

app.get("/api/directory/listing/:slug", async c => {
  const listing = await getListing(c.env, c.req.param("slug"));
  return listing ? c.json(listing) : c.json({ error: "Listing not found" }, 404);
});

app.post("/api/directory/inquiry", async c => {
  const input = await c.req.json<{ listingId?: number; name?: string; email?: string; phone?: string; message?: string; consentEmail?: boolean; consentSms?: boolean }>();
  if (!input.name || !input.email || !input.message || input.name.trim().length < 2 || input.message.trim().length < 12) return c.json({ error: "Please complete the required inquiry fields." }, 400);
  const id = c.env.FORM_LIMITER.idFromName(`inquiry:${c.req.header("CF-Connecting-IP") ?? "anonymous"}`);
  const limiter = c.env.FORM_LIMITER.get(id);
  const allowance = await limiter.allow();
  if (!allowance.ok) return c.json({ error: "Please wait before sending another inquiry." }, 429, { "Retry-After": allowance.retryAfter.toString() });
  return c.json(await createInquiry(c.env, { listingId: input.listingId, name: input.name.trim(), email: input.email.trim(), phone: input.phone?.trim(), message: input.message.trim(), consentEmail: Boolean(input.consentEmail), consentSms: Boolean(input.consentSms) }), 201);
});

/** Same admin gate as the tRPC cms.* procedures, for the plain HTTP campaign routes. */
async function requireAdmin(c: { req: { raw: Request }; env: Env }) {
  const user = await getWorkerUser(c.req.raw, c.env);
  if (!user || user.role !== "admin") return null;
  return user;
}

app.post("/api/admin/campaigns", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleCreateCampaign(c.req.raw, c.env, user);
});
app.post("/api/admin/campaigns/:id/send", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleSendCampaign(c.env, Number(c.req.param("id")));
});
app.get("/api/admin/campaigns", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleListCampaigns(c.env);
});
app.get("/api/admin/inbox", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleListInbox(c.env);
});
app.post("/api/admin/inbox/:id/read", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleMarkInboxRead(c.env, Number(c.req.param("id")));
});

app.get("/api/admin/stripe-mode", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ mode: await getStripeMode(c.env), hasTestKey: Boolean(c.env.STRIPE_SECRET_KEY_TEST), hasLiveKey: Boolean(c.env.STRIPE_SECRET_KEY) });
});
app.post("/api/admin/stripe-mode", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json<{ mode?: string }>().catch(() => ({}) as { mode?: string });
  if (body.mode !== "test" && body.mode !== "live") return c.json({ error: "mode must be 'test' or 'live'" }, 400);
  if (body.mode === "live" && !c.env.STRIPE_SECRET_KEY) return c.json({ error: "STRIPE_SECRET_KEY (live) isn't set yet." }, 400);
  if (body.mode === "test" && !c.env.STRIPE_SECRET_KEY_TEST) return c.json({ error: "STRIPE_SECRET_KEY_TEST isn't set yet — add it on Cloudflare first." }, 400);
  await setStripeMode(c.env, body.mode);
  return c.json({ mode: body.mode });
});

app.get("/api/claim/search", c => handleClaimSearch(c.req.raw, c.env));
app.get("/api/supplies", c => handleSupplies(c.req.raw, c.env));
// Bare /supplies resolves to the visitor's country page, same logic as the homepage.
app.get("/supplies", c => {
  const destination = geoHomeLocation(c.req.raw);
  return c.redirect(`${destination ?? "/au"}/supplies`, 302);
});
app.get("/api/supplies/go", c => handleSupplyClick(c.req.raw, c.env));
app.post("/api/admin/supplies/sync", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleSuppliesSync(c.env);
});
app.get("/api/admin/supplies/clicks", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleSupplyClickStats(c.env);
});
app.post("/api/claim/start", c => handleClaimStart(c.req.raw, c.env));
app.post("/api/claim/verify", c => handleClaimVerify(c.req.raw, c.env));
app.get("/api/owner/listing", async c => {
  const user = await getWorkerUser(c.req.raw, c.env);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleGetOwnerListing(c.env, user.id);
});
app.post("/api/owner/listing", async c => {
  const user = await getWorkerUser(c.req.raw, c.env);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return handleUpdateOwnerListing(c.req.raw, c.env, user.id);
});

app.get("/api/campaigns/unsubscribe", c => handleUnsubscribe(c.req.raw, c.env));
app.get("/api/campaigns/open", c => handleCampaignOpen(c.env, Number(c.req.query("r"))));
app.get("/api/campaigns/click", c => handleCampaignClick(c.env, Number(c.req.query("r")), c.req.query("u") ?? null));
app.post("/api/webhooks/twilio/status", c => handleTwilioStatusWebhook(c.req.raw, c.env));
app.post("/api/webhooks/twilio/inbound", c => handleTwilioInboundWebhook(c.req.raw, c.env));

/**
 * Listing enrichment control surface. Everything the CMS panel needs to start
 * it, stop it, retune it, run it on demand and review what it wrote.
 */
app.get("/api/admin/enrichment", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json(await getEnrichmentStatus(c.env));
});
app.post("/api/admin/enrichment/settings", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json<{ enabled?: boolean; autoPublish?: boolean; batchSize?: number; concurrency?: number; dailyCap?: number; model?: string; target?: EnrichmentTarget }>().catch(() => ({}));
  return c.json({ settings: await updateEnrichmentSettings(c.env, body) });
});
app.post("/api/admin/enrichment/run", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json(await runEnrichmentBatch(c.env, "manual"));
});
app.post("/api/admin/enrichment/items/:id/:decision", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const decision = c.req.param("decision");
  if (decision !== "approve" && decision !== "reject") return c.json({ error: "decision must be 'approve' or 'reject'" }, 400);
  const result = await reviewProposal(c.env, Number(c.req.param("id")), decision);
  return "error" in result ? c.json(result, 400) : c.json(result);
});
app.post("/api/admin/enrichment/approve-all", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json(await approveAllProposals(c.env));
});

/**
 * Publish control for the real `listings` table. See worker/publish.ts for
 * why this is separate from the CMS's older qh_listings-based listing form.
 */
app.get("/api/admin/publish", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const query = c.req.query();
  const status = isPublishStatus(query.status) ? query.status : query.status === "all" ? "all" : "all";
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));
  return c.json(await listPublishQueue(c.env, { status, citySlug: query.city || undefined, q: query.q || undefined, thinOnly: query.thinOnly === "1" }, page, pageSize));
});
app.post("/api/admin/publish/status", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json<{ slug?: string; status?: string }>().catch(() => ({}));
  if (!body.slug || !isPublishStatus(body.status)) return c.json({ error: "slug and a valid status are required." }, 400);
  const result = await setListingStatus(c.env, body.slug, body.status);
  return "error" in result ? c.json(result, 404) : c.json(result);
});
app.post("/api/admin/publish/bulk", async c => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json<{ status?: PublishStatus | "all"; city?: string; q?: string; thinOnly?: boolean; newStatus?: string; protect?: boolean }>().catch(() => ({}));
  if (!isPublishStatus(body.newStatus)) return c.json({ error: "newStatus must be published, pending or unpublished." }, 400);
  const result = await setStatusForFilter(c.env, { status: body.status, citySlug: body.city, q: body.q, thinOnly: body.thinOnly }, body.newStatus, body.protect !== false);
  return c.json(result);
});

app.post("/api/concierge/events", c => handleConciergeEvent(c.req.raw, c.env));
app.post("/api/concierge/parse", () => handleConciergeParse());

app.get("/robots.txt", c => handleRobotsTxt(c.env));
app.get("/sitemap.xml", c => handleSitemapIndex(c.env));
app.get("/sitemap-static.xml", c => handleSitemapStatic(c.env));
app.get("/sitemap-cities.xml", c => handleSitemapCities(c.env));
app.get("/sitemap-listings.xml", c => handleSitemapListings(c.env));
app.get("/sitemap-journal.xml", c => handleSitemapJournal(c.env));

app.get("/", async c => {
  const destination = geoHomeLocation(c.req.raw);
  if (destination) return c.redirect(destination, 302);
  const response = hardened(await serveWorkerPage(c.req.raw, c.env));
  // Remember an explicit "show me every country" choice so / doesn't keep redirecting.
  if (new URL(c.req.url).searchParams.get("intl") === "1") response.headers.append("set-cookie", internationalCookie());
  return response;
});

app.get("/:country", async (c, next) => {
  const country = c.req.param("country");
  if (!isDirectoryCountry(country)) return next();
  const response = hardened(await serveWorkerPage(c.req.raw, c.env));
  if (response.status < 400) response.headers.append("set-cookie", countryChoiceCookie(country));
  return response;
});

app.all("*", async c => hardened(await serveWorkerPage(c.req.raw, c.env)));

export default {
  fetch: app.fetch,
  /**
   * wrangler.jsonc has declared cron triggers since the Worker migration, but
   * no scheduled() handler was ever exported — so every firing hit a Worker
   * that could not answer it. This is that handler.
   *
   * Enrichment used to be two separate, unreconciled jobs here (worker/enrich.ts
   * and worker/enrichment.ts, built concurrently on diverged branches and merged
   * without either side noticing the other existed) racing to enrich the same
   * rows on the same schedule. They're one engine now — see worker/enrichment.ts
   * and worker/migrations/0012_enrichment_proposal_fields.sql.
   */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runEnrichmentBatch(env, "cron")
        .then(result => console.log(`[Worker cron ${event.cron}] enrichment: ${result.status} — ${result.note}`))
        .catch(error => console.error(`[Worker cron ${event.cron}] enrichment failed`, error)),
    );
    // Supplies refresh once a day (the 06:20 firing): AliExpress affiliate offers (primary),
    // then the eBay scan import (supplement) which also starts the next day's scan.
    if (event.cron === "20 6 * * *") {
      ctx.waitUntil(refreshAliExpressOffers(env).catch(() => {}));
      ctx.waitUntil(syncSupplyOffers(env).catch(() => {}));
    }
  },
  /** Consumes campaign send jobs enqueued by handleSendCampaign — one message per recipient, so a slow/rate-limited provider or a transient failure can't block the rest of a send (Queues retry failed messages automatically). */
  async queue(batch: MessageBatch<{ recipientId: number }>, env: Env) {
    for (const message of batch.messages) {
      await processCampaignSend(env, message.body);
      message.ack();
    }
  },
  /**
   * Cloudflare Email Routing inbound handler — captures replies to
   * hello@thaimassageforu.com. Requires Email Routing to be enabled for
   * the zone (Cloudflare dashboard → thaimassageforu.com → Email →
   * Email Routing) with a route sending hello@ to this Worker; that
   * dashboard/DNS step can't be done from here.
   */
  async email(message: ForwardableEmailMessage, env: Env) {
    const PostalMime = (await import("postal-mime")).default;
    const raw = new Response(message.raw);
    const parsed = await PostalMime.parse(await raw.arrayBuffer());
    await env.DB.prepare("INSERT INTO qh_inbound_messages (channel, from_address, to_address, subject, body) VALUES ('email', ?, ?, ?, ?)")
      .bind(message.from, message.to, parsed.subject ?? "", parsed.text ?? parsed.html ?? "")
      .run();
    // Also forward to a real inbox so replies aren't only visible in /cms.
    if (env.CONTACT_EMAIL && env.CONTACT_EMAIL !== message.to) {
      try {
        await message.forward(env.CONTACT_EMAIL);
      } catch {
        // forward() throws if the destination isn't a verified Email Routing address — the D1 copy above is unaffected.
      }
    }
  },
};
