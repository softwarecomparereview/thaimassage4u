import { Hono } from "hono";
import { DurableObject, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { createInquiry, getCityGuide, getDirectoryHome, getListing } from "./directory";
import { handleTrpc } from "./trpc";
import { handleOAuthCallback, getWorkerUser } from "./auth";
import { handleAdminLogin } from "./simple-admin-auth";
import { handleStripeWebhook, handlePublicPremiumCheckout } from "./stripe";
import { serveWorkerPage } from "./ssr";
import { geoHomeLocation, internationalCookie, isDirectoryCountry, countryChoiceCookie } from "./geo";
import { handleCreateCampaign, handleSendCampaign, handleListCampaigns, handleListInbox, handleMarkInboxRead, handleUnsubscribe, handleCampaignOpen, handleCampaignClick, handleTwilioStatusWebhook, handleTwilioInboundWebhook } from "./admin-campaigns";
import { processCampaignSend } from "./campaigns";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  MEDIA: R2Bucket;
  SITE_NAME: string;
  SITE_URL: string;
  CONTACT_EMAIL: string;
  APP_ID: string;
  OAUTH_SERVER_URL: string;
  JWT_SECRET: string;
  OWNER_OPEN_ID: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  /** Shared-password fallback admin login — see simple-admin-auth.ts. */
  ADMIN_PASSWORD?: string;
  LEADS: Queue<{ recipientId: number }>;
  /** Cloudflare's native outbound email sending binding — no API token needed. Requires the sending domain verified in the Cloudflare dashboard (Email → Email Sending). */
  EMAIL: SendEmail;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  CF_VERSION_METADATA?: { id?: string; tag?: string };
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

app.get("/api/campaigns/unsubscribe", c => handleUnsubscribe(c.req.raw, c.env));
app.get("/api/campaigns/open", c => handleCampaignOpen(c.env, Number(c.req.query("r"))));
app.get("/api/campaigns/click", c => handleCampaignClick(c.env, Number(c.req.query("r")), c.req.query("u") ?? null));
app.post("/api/webhooks/twilio/status", c => handleTwilioStatusWebhook(c.req.raw, c.env));
app.post("/api/webhooks/twilio/inbound", c => handleTwilioInboundWebhook(c.req.raw, c.env));

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
