import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createInquiry, getArticleBySlug, getCityGuideBySlug, getCountryGuideBySlug, getDirectoryData, getListingBySlug } from "../db";
import { publicProcedure, router } from "../_core/trpc";

export const directoryRouter = router({
  home: publicProcedure.query(() => getDirectoryData()),
  cityBySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(140) })).query(async ({ input }) => {
    const guide = await getCityGuideBySlug(input.slug);
    if (!guide) throw new TRPCError({ code: "NOT_FOUND", message: "This city guide is not available." });
    return guide;
  }),
  countryBySlug: publicProcedure.input(z.object({ code: z.string().min(2).max(2) })).query(async ({ input }) => {
    const guide = await getCountryGuideBySlug(input.code);
    if (!guide) throw new TRPCError({ code: "NOT_FOUND", message: "This country guide is not available." });
    return guide;
  }),
  listingBySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(180) })).query(async ({ input }) => {
    const listing = await getListingBySlug(input.slug);
    if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "This listing is not published." });
    return listing;
  }),
  articleBySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(280) })).query(async ({ input }) => {
    const article = await getArticleBySlug(input.slug);
    if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "This article is not published." });
    return article;
  }),
  submitInquiry: publicProcedure.input(z.object({
    listingId: z.number().int().positive().optional(),
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(40).optional(),
    message: z.string().trim().min(12).max(5000),
    consentEmail: z.boolean(),
    consentSms: z.boolean(),
  })).mutation(({ input }) => createInquiry(input)),
});
