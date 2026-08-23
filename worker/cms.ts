import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createPremiumCheckout } from "./stripe";
import type { WorkerUser } from "./auth";
import type { Env } from "./index";

export type CmsContext = { env: Env; request: Request; user: WorkerUser };

function camelRecord(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
}

function cmsRows(result: D1Result<Record<string, unknown>>) {
  return result.results.map(camelRecord);
}

export async function getCmsSummary(env: Env) {
  const statements = [
    "SELECT * FROM qh_listings ORDER BY updated_at DESC",
    "SELECT * FROM qh_articles ORDER BY updated_at DESC",
    "SELECT * FROM qh_message_templates ORDER BY updated_at DESC",
    "SELECT * FROM qh_inquiries ORDER BY created_at DESC",
    "SELECT * FROM qh_outbox_messages ORDER BY created_at DESC",
    "SELECT * FROM qh_cities ORDER BY name",
    "SELECT * FROM qh_categories ORDER BY name",
    "SELECT * FROM qh_city_events ORDER BY starts_at DESC",
    "SELECT * FROM qh_city_metrics ORDER BY observed_at DESC",
    "SELECT * FROM qh_localized_content ORDER BY updated_at DESC",
    "SELECT * FROM qh_practitioners ORDER BY name",
    "SELECT * FROM qh_services ORDER BY title",
  ].map(sql => env.DB.prepare(sql));
  const [listings, articles, templates, inquiries, outbox, cities, categories, events, metrics, localizedContent, practitioners, services] = await env.DB.batch(statements);
  return { listings: cmsRows(listings), articles: cmsRows(articles), templates: cmsRows(templates), inquiries: cmsRows(inquiries), outbox: cmsRows(outbox), cities: cmsRows(cities), categories: cmsRows(categories), events: cmsRows(events), metrics: cmsRows(metrics), localizedContent: cmsRows(localizedContent), practitioners: cmsRows(practitioners), services: cmsRows(services) };
}

const optionalString = z.string().trim().max(12000).optional().transform(value => value || null);

export const cmsSchemas = {
  listing: z.object({ id: z.number().int().positive().optional(), cityId: z.number().int().positive(), categoryId: z.number().int().positive(), name: z.string().trim().min(2).max(160), slug: z.string().trim().min(2).max(180), descriptor: optionalString, description: optionalString, neighbourhood: optionalString, address: optionalString, bookingUrl: optionalString, contactEmail: optionalString, imageUrl: optionalString, status: z.enum(["draft", "review", "published"]), isFeatured: z.boolean() }),
  city: z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(2).max(120), slug: z.string().trim().min(2).max(140), country: z.string().trim().min(2).max(120), countryCode: z.string().trim().length(2), primaryLocale: z.string().trim().min(2).max(16), introduction: optionalString, isActive: z.boolean() }),
  article: z.object({ id: z.number().int().positive().optional(), title: z.string().trim().min(6).max(255), slug: z.string().trim().min(6).max(280), excerpt: optionalString, body: optionalString, topic: z.string().trim().min(3).max(120), coverImageUrl: optionalString, status: z.enum(["draft", "review", "published"]) }),
  template: z.object({ id: z.number().int().positive().optional(), channel: z.enum(["email", "sms"]), title: z.string().trim().min(3).max(180), subject: optionalString, body: z.string().trim().min(3).max(10000), purpose: z.string().trim().min(3).max(180), status: z.enum(["draft", "approved", "archived"]) }),
  service: z.object({ id: z.number().int().positive().optional(), listingId: z.number().int().positive(), title: z.string().trim().min(2).max(160), durationMinutes: z.number().int().positive().max(1440).optional(), priceFromCents: z.number().int().min(0).max(100000000).optional(), description: optionalString, isBookable: z.boolean() }),
  practitioner: z.object({ id: z.number().int().positive().optional(), listingId: z.number().int().positive(), name: z.string().trim().min(2).max(160), role: optionalString, credentials: optionalString, biography: optionalString, imageUrl: optionalString }),
};

export async function saveListing(env: Env, user: WorkerUser, input: z.infer<typeof cmsSchemas.listing>) {
  if (input.id) {
    await env.DB.prepare("UPDATE qh_listings SET city_id=?, category_id=?, name=?, slug=?, descriptor=?, description=?, neighbourhood=?, address=?, booking_url=?, contact_email=?, image_url=?, status=?, is_featured=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(input.cityId, input.categoryId, input.name, input.slug, input.descriptor, input.description, input.neighbourhood, input.address, input.bookingUrl, input.contactEmail, input.imageUrl, input.status, input.isFeatured ? 1 : 0, input.id).run();
    return { id: input.id };
  }
  const result = await env.DB.prepare("INSERT INTO qh_listings (owner_id, city_id, category_id, name, slug, descriptor, description, neighbourhood, address, booking_url, contact_email, image_url, status, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(user.id, input.cityId, input.categoryId, input.name, input.slug, input.descriptor, input.description, input.neighbourhood, input.address, input.bookingUrl, input.contactEmail, input.imageUrl, input.status, input.isFeatured ? 1 : 0).run();
  return { id: Number(result.meta.last_row_id) };
}

export async function saveCity(env: Env, input: z.infer<typeof cmsSchemas.city>) {
  const args = [input.name, input.slug, input.country, input.countryCode, input.primaryLocale, input.introduction, input.isActive ? 1 : 0];
  if (input.id) { await env.DB.prepare("UPDATE qh_cities SET name=?, slug=?, country=?, country_code=?, primary_locale=?, introduction=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(...args, input.id).run(); return { id: input.id }; }
  const result = await env.DB.prepare("INSERT INTO qh_cities (name, slug, country, country_code, primary_locale, introduction, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(...args).run();
  return { id: Number(result.meta.last_row_id) };
}

export async function saveArticle(env: Env, user: WorkerUser, input: z.infer<typeof cmsSchemas.article>) {
  const publishedAt = input.status === "published" ? new Date().toISOString() : null;
  const args = [input.title, input.slug, input.excerpt, input.body, input.topic, input.coverImageUrl, input.status, publishedAt];
  if (input.id) { await env.DB.prepare("UPDATE qh_articles SET title=?, slug=?, excerpt=?, body=?, topic=?, cover_image_url=?, status=?, published_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(...args, input.id).run(); return { id: input.id }; }
  const result = await env.DB.prepare("INSERT INTO qh_articles (author_id, title, slug, excerpt, body, topic, cover_image_url, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(user.id, ...args).run();
  return { id: Number(result.meta.last_row_id) };
}

export async function saveTemplate(env: Env, input: z.infer<typeof cmsSchemas.template>) {
  const args = [input.channel, input.title, input.subject, input.body, input.purpose, input.status];
  if (input.id) { await env.DB.prepare("UPDATE qh_message_templates SET channel=?, title=?, subject=?, body=?, purpose=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(...args, input.id).run(); return { id: input.id }; }
  const result = await env.DB.prepare("INSERT INTO qh_message_templates (channel, title, subject, body, purpose, status) VALUES (?, ?, ?, ?, ?, ?)").bind(...args).run();
  return { id: Number(result.meta.last_row_id) };
}

export async function saveService(env: Env, input: z.infer<typeof cmsSchemas.service>) {
  const args = [input.listingId, input.title, input.durationMinutes ?? null, input.priceFromCents ?? null, input.description, input.isBookable ? 1 : 0];
  if (input.id) { await env.DB.prepare("UPDATE qh_services SET listing_id=?, title=?, duration_minutes=?, price_from_cents=?, description=?, is_bookable=? WHERE id=?").bind(...args, input.id).run(); return { id: input.id }; }
  const result = await env.DB.prepare("INSERT INTO qh_services (listing_id, title, duration_minutes, price_from_cents, description, is_bookable) VALUES (?, ?, ?, ?, ?, ?)").bind(...args).run();
  return { id: Number(result.meta.last_row_id) };
}

export async function savePractitioner(env: Env, input: z.infer<typeof cmsSchemas.practitioner>) {
  const args = [input.listingId, input.name, input.role, input.credentials, input.biography, input.imageUrl];
  if (input.id) { await env.DB.prepare("UPDATE qh_practitioners SET listing_id=?, name=?, role=?, credentials=?, biography=?, image_url=? WHERE id=?").bind(...args, input.id).run(); return { id: input.id }; }
  const result = await env.DB.prepare("INSERT INTO qh_practitioners (listing_id, name, role, credentials, biography, image_url) VALUES (?, ?, ?, ?, ?, ?)").bind(...args).run();
  return { id: Number(result.meta.last_row_id) };
}

export async function updateInquiryStatus(env: Env, id: number, status: "new" | "in_progress" | "closed") {
  await env.DB.prepare("UPDATE qh_inquiries SET status=? WHERE id=?").bind(status, id).run();
  return { id, status };
}

export async function queueMessage(env: Env, user: WorkerUser, input: { templateId: number; inquiryId: number; channel: "email" | "sms"; renderedContent: string }) {
  const [template, inquiry] = await env.DB.batch([
    env.DB.prepare("SELECT channel, status FROM qh_message_templates WHERE id=? LIMIT 1").bind(input.templateId),
    env.DB.prepare("SELECT consent_email, consent_sms, phone FROM qh_inquiries WHERE id=? LIMIT 1").bind(input.inquiryId),
  ]);
  const templateRow = template.results[0] as { channel?: string; status?: string } | undefined;
  const inquiryRow = inquiry.results[0] as { consent_email?: number; consent_sms?: number; phone?: string | null } | undefined;
  if (!templateRow || templateRow.status !== "approved" || templateRow.channel !== input.channel) throw new TRPCError({ code: "BAD_REQUEST", message: "The selected approved template does not match this channel." });
  if (!inquiryRow || (input.channel === "email" && !inquiryRow.consent_email) || (input.channel === "sms" && (!inquiryRow.consent_sms || !inquiryRow.phone))) throw new TRPCError({ code: "FORBIDDEN", message: "The inquiry has not granted consent for this channel." });
  const result = await env.DB.prepare("INSERT INTO qh_outbox_messages (template_id, inquiry_id, channel, rendered_content, status, approved_by) VALUES (?, ?, ?, ?, 'ready_for_provider', ?)").bind(input.templateId, input.inquiryId, input.channel, input.renderedContent, user.id).run();
  return { id: Number(result.meta.last_row_id) };
}

export async function checkoutPremium(env: Env, request: Request, user: WorkerUser, input: { listingId: number; tier: "city" | "country" }) {
  const listing = await env.DB.prepare("SELECT owner_id FROM qh_listings WHERE id=? LIMIT 1").bind(input.listingId).first<{ owner_id: number | null }>();
  if (!listing || (listing.owner_id !== user.id && user.role !== "admin")) throw new TRPCError({ code: "FORBIDDEN", message: "You can only purchase a listing you manage." });
  return { checkoutUrl: await createPremiumCheckout(env, { listingId: input.listingId, userId: user.id, userEmail: user.email, userName: user.name, origin: new URL(request.url).origin, tier: input.tier }) };
}
