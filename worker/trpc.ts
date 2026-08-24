import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { getWorkerUser, type WorkerUser } from "./auth";
import { checkoutPremium, cmsSchemas, getCmsSummary, queueMessage, saveArticle, saveCity, saveListing, savePractitioner, saveService, saveTemplate, updateInquiryStatus } from "./cms";
import { createInquiry, getArticle, getCityGuide, getCountryGuide, getDirectoryHome, getListing } from "./directory";
import type { Env } from "./index";

type Context = { env: Env; request: Request; user: WorkerUser | null };
const t = initTRPC.context<Context>().create({ transformer: superjson });

const directory = t.router({
  home: t.procedure.query(({ ctx }) => getDirectoryHome(ctx.env)),
  cityBySlug: t.procedure.input(z.object({ slug: z.string().min(1).max(140) })).query(async ({ ctx, input }) => {
    const guide = await getCityGuide(ctx.env, input.slug);
    if (!guide) throw new TRPCError({ code: "NOT_FOUND", message: "This city guide is not available." });
    return guide;
  }),
  countryBySlug: t.procedure.input(z.object({ code: z.string().min(2).max(2) })).query(async ({ ctx, input }) => {
    const guide = await getCountryGuide(ctx.env, input.code);
    if (!guide) throw new TRPCError({ code: "NOT_FOUND", message: "This country guide is not available." });
    return guide;
  }),
  listingBySlug: t.procedure.input(z.object({ slug: z.string().min(1).max(180) })).query(async ({ ctx, input }) => {
    const listing = await getListing(ctx.env, input.slug);
    if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "This listing is not available." });
    return listing;
  }),
  articleBySlug: t.procedure.input(z.object({ slug: z.string().min(1).max(280) })).query(async ({ ctx, input }) => {
    const article = await getArticle(ctx.env, input.slug);
    if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "This article is not available." });
    return article;
  }),
  submitInquiry: t.procedure.input(z.object({
    listingId: z.number().int().positive().optional(),
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(40).optional(),
    message: z.string().trim().min(12).max(5000),
    consentEmail: z.boolean(),
    consentSms: z.boolean(),
  })).mutation(({ ctx, input }) => createInquiry(ctx.env, input)),
});

const auth = t.router({
  me: t.procedure.query(({ ctx }) => ctx.user),
  logout: t.procedure.mutation(() => ({ success: true as const })),
});

const requireUser = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireAdmin = requireUser.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "You do not have required permission (10002)" });
  return next();
});

const cms = t.router({
  summary: requireAdmin.query(({ ctx }) => getCmsSummary(ctx.env)),
  saveListing: requireAdmin.input(cmsSchemas.listing).mutation(({ ctx, input }) => saveListing(ctx.env, ctx.user, input)),
  saveCity: requireAdmin.input(cmsSchemas.city).mutation(({ ctx, input }) => saveCity(ctx.env, input)),
  saveArticle: requireAdmin.input(cmsSchemas.article).mutation(({ ctx, input }) => saveArticle(ctx.env, ctx.user, input)),
  saveTemplate: requireAdmin.input(cmsSchemas.template).mutation(({ ctx, input }) => saveTemplate(ctx.env, input)),
  saveService: requireAdmin.input(cmsSchemas.service).mutation(({ ctx, input }) => saveService(ctx.env, input)),
  savePractitioner: requireAdmin.input(cmsSchemas.practitioner).mutation(({ ctx, input }) => savePractitioner(ctx.env, input)),
  updateInquiryStatus: requireAdmin.input(z.object({ id: z.number().int().positive(), status: z.enum(["new", "in_progress", "closed"]) })).mutation(({ ctx, input }) => updateInquiryStatus(ctx.env, input.id, input.status)),
  queueMessage: requireAdmin.input(z.object({ templateId: z.number().int().positive(), inquiryId: z.number().int().positive(), channel: z.enum(["email", "sms"]), renderedContent: z.string().trim().min(3).max(10000) })).mutation(({ ctx, input }) => queueMessage(ctx.env, ctx.user, input)),
  checkoutPremium: requireUser.input(z.object({ listingId: z.number().int().positive(), tier: z.enum(["city", "country"]) })).mutation(({ ctx, input }) => checkoutPremium(ctx.env, ctx.request, ctx.user, input)),
});

export const workerRouter = t.router({ directory, auth, cms });

export function handleTrpc(request: Request, env: Env) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: workerRouter,
    createContext: async () => ({ env, request, user: await getWorkerUser(request, env) }),
    onError({ error, path }) {
      console.error(`[Worker tRPC] ${path ?? "unknown"}: ${error.message}`);
    },
  });
}
