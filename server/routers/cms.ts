import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getCmsSummary, getOwnedListing, queueMessage, saveArticle, saveCategory, saveCity, saveCityEvent, saveCityMetric, saveListing, saveLocalizedContent, saveMessageTemplate, savePractitioner, saveService, updateInquiryStatus } from "../db";
import { createPremiumCheckout } from "../stripe";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const listingInput = z.object({
  id: z.number().int().positive().optional(),
  cityId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180),
  descriptor: z.string().trim().max(255).optional(),
  description: z.string().trim().max(12000).optional(),
  neighbourhood: z.string().trim().max(120).optional(),
  address: z.string().trim().max(255).optional(),
  bookingUrl: z.string().url().max(1000).optional().or(z.literal("")),
  contactEmail: z.string().email().max(320).optional().or(z.literal("")),
  imageUrl: z.string().url().max(1000).optional().or(z.literal("")),
  status: z.enum(["draft", "review", "published"]),
  isFeatured: z.boolean(),
});

export const cmsRouter = router({
  summary: adminProcedure.query(() => getCmsSummary()),
  saveListing: adminProcedure.input(listingInput).mutation(({ input, ctx }) => saveListing({ ...input, ownerId: ctx.user.id })),
  savePractitioner: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(), listingId: z.number().int().positive(), name: z.string().trim().min(2).max(160), role: z.string().trim().max(160).optional(), credentials: z.string().trim().max(4000).optional(), biography: z.string().trim().max(12000).optional(), imageUrl: z.string().url().max(1000).optional().or(z.literal("")),
  })).mutation(({ input }) => savePractitioner(input)),
  saveService: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(), listingId: z.number().int().positive(), title: z.string().trim().min(2).max(160), durationMinutes: z.number().int().positive().max(1440).optional(), priceFromCents: z.number().int().min(0).max(100000000).optional(), description: z.string().trim().max(4000).optional(), isBookable: z.boolean(),
  })).mutation(({ input }) => saveService(input)),
  saveArticle: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(),
    title: z.string().trim().min(6).max(255),
    slug: z.string().trim().min(6).max(280),
    excerpt: z.string().trim().max(1200).optional(),
    body: z.string().trim().max(30000).optional(),
    topic: z.string().trim().min(3).max(120),
    coverImageUrl: z.string().url().max(1000).optional().or(z.literal("")),
    status: z.enum(["draft", "review", "published"]),
  })).mutation(({ input, ctx }) => saveArticle({ ...input, authorId: ctx.user.id })),
  saveTemplate: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(),
    channel: z.enum(["email", "sms"]),
    title: z.string().trim().min(3).max(180),
    subject: z.string().trim().max(255).optional(),
    body: z.string().trim().min(3).max(10000),
    purpose: z.string().trim().min(3).max(180),
    status: z.enum(["draft", "approved", "archived"]),
  })).mutation(({ input }) => saveMessageTemplate(input)),
  saveCity: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(), name: z.string().trim().min(2).max(120), slug: z.string().trim().min(2).max(140), country: z.string().trim().min(2).max(120), countryCode: z.string().trim().length(2), primaryLocale: z.string().trim().min(2).max(16), introduction: z.string().trim().max(4000).optional(), isActive: z.boolean(),
  })).mutation(({ input }) => saveCity(input)),
  saveCategory: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(), name: z.string().trim().min(2).max(120), slug: z.string().trim().min(2).max(140), shortDescription: z.string().trim().max(255).optional(), iconKey: z.string().trim().max(64).optional(), isActive: z.boolean(),
  })).mutation(({ input }) => saveCategory(input)),
  saveCityEvent: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(), cityId: z.number().int().positive(), title: z.string().trim().min(3).max(220), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(), category: z.string().trim().max(120).optional(), venue: z.string().trim().max(180).optional(), description: z.string().trim().max(2000).optional(), sourceName: z.string().trim().min(2).max(180), sourceUrl: z.string().url().max(1000), sourceCheckedAt: z.coerce.date(), status: z.enum(["draft", "verified", "archived"]),
  })).mutation(({ input }) => saveCityEvent(input)),
  saveCityMetric: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(), cityId: z.number().int().positive(), metricKey: z.string().trim().min(2).max(120), label: z.string().trim().min(2).max(180), value: z.string().trim().min(1).max(120), methodology: z.string().trim().min(3).max(5000), sourceName: z.string().trim().min(2).max(180), sourceUrl: z.string().url().max(1000), observedAt: z.coerce.date(), isPublished: z.boolean(),
  })).mutation(({ input }) => saveCityMetric(input)),
  saveLocalizedContent: adminProcedure.input(z.object({
    id: z.number().int().positive().optional(), entityType: z.enum(["city", "listing", "article", "category"]), entityId: z.number().int().positive(), locale: z.string().trim().min(2).max(16), title: z.string().trim().min(2).max(255), slug: z.string().trim().max(280).optional(), excerpt: z.string().trim().max(1200).optional(), body: z.string().trim().max(30000).optional(), status: z.enum(["draft", "native_review", "published"]),
  })).mutation(({ input, ctx }) => saveLocalizedContent({ ...input, reviewedBy: input.status === "published" ? ctx.user.id : undefined })),
  queueMessage: adminProcedure.input(z.object({
    templateId: z.number().int().positive(),
    inquiryId: z.number().int().positive(),
    channel: z.enum(["email", "sms"]),
    renderedContent: z.string().trim().min(3).max(10000),
  })).mutation(({ input, ctx }) => queueMessage({ ...input, approvedBy: ctx.user.id })),
  updateInquiryStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["new", "in_progress", "closed"]) })).mutation(({ input }) => updateInquiryStatus(input)),
  checkoutPremium: protectedProcedure.input(z.object({ listingId: z.number().int().positive(), tier: z.enum(["city", "country"]) })).mutation(async ({ input, ctx }) => {
    const listing = await getOwnedListing(input.listingId, ctx.user.id);
    if (!listing && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "You can only purchase a listing you manage." });
    const origin = ctx.req.headers.origin;
    if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "A valid browser origin is required for checkout." });
    const checkoutUrl = await createPremiumCheckout({ listingId: input.listingId, userId: ctx.user.id, userEmail: ctx.user.email, userName: ctx.user.name, origin, tier: input.tier });
    return { checkoutUrl };
  }),
});
