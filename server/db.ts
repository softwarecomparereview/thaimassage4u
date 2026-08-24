import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  articles,
  categories,
  cityEvents,
  cityMetrics,
  cities,
  contactConsents,
  inquiries,
  InsertUser,
  listings,
  localizedContent,
  messageTemplates,
  outboxMessages,
  premiumSubscriptions,
  practitioners,
  services,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getDirectoryData() {
  const db = await getDb();
  if (!db) return { listings: [], articles: [], cities: [], categories: [], premiumListings: [], verifiedEvents: [], cityMetrics: [] };

  const publishedListings = await db
    .select({
      id: listings.id,
      name: listings.name,
      slug: listings.slug,
      descriptor: listings.descriptor,
      neighbourhood: listings.neighbourhood,
      imageUrl: listings.imageUrl,
      isFeatured: listings.isFeatured,
      cityName: cities.name,
      citySlug: cities.slug,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .innerJoin(categories, eq(listings.categoryId, categories.id))
    .where(eq(listings.status, "published"))
    .orderBy(desc(listings.isFeatured), desc(listings.createdAt));

  const publishedArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt));

  const activeCities = await db.select().from(cities).where(eq(cities.isActive, true));
  const activeCategories = await db.select().from(categories).where(eq(categories.isActive, true));
  const verifiedEvents = await db.select().from(cityEvents).where(eq(cityEvents.status, "verified")).orderBy(cityEvents.startsAt);
  const publishedMetrics = await db.select().from(cityMetrics).where(eq(cityMetrics.isPublished, true));
  const premium = await getPremiumListings();
  return { listings: publishedListings, articles: publishedArticles, cities: activeCities, categories: activeCategories, premiumListings: premium, verifiedEvents, cityMetrics: publishedMetrics };
}

export async function getCityGuideBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const city = await db.select().from(cities).where(and(eq(cities.slug, slug), eq(cities.isActive, true))).limit(1);
  if (!city[0]) return undefined;
  const [placeCards, verifiedEvents, publishedMetrics] = await Promise.all([
    db.select({ id: listings.id, name: listings.name, slug: listings.slug, descriptor: listings.descriptor, neighbourhood: listings.neighbourhood, imageUrl: listings.imageUrl, categoryName: categories.name })
      .from(listings).innerJoin(categories, eq(listings.categoryId, categories.id))
      .where(and(eq(listings.cityId, city[0].id), eq(listings.status, "published"))).orderBy(desc(listings.isFeatured), desc(listings.createdAt)),
    db.select().from(cityEvents).where(and(eq(cityEvents.cityId, city[0].id), eq(cityEvents.status, "verified"))).orderBy(cityEvents.startsAt),
    db.select().from(cityMetrics).where(and(eq(cityMetrics.cityId, city[0].id), eq(cityMetrics.isPublished, true))).orderBy(cityMetrics.metricKey),
  ]);
  return { city: city[0], listings: placeCards, events: verifiedEvents, metrics: publishedMetrics };
}

const COUNTRY_NAMES: Record<string, string> = { us: "United States", uk: "United Kingdom", au: "Australia", de: "Germany" };

export async function getCountryGuideBySlug(code: string) {
  const db = await getDb();
  if (!db || !COUNTRY_NAMES[code]) return undefined;
  const countryCities = await db.select().from(cities).where(and(eq(cities.countryCode, code), eq(cities.isActive, true))).orderBy(cities.name);
  const cityIds = countryCities.map(city => city.id);
  if (!cityIds.length) return undefined;
  const placeCards = await db
    .select({ id: listings.id, name: listings.name, slug: listings.slug, descriptor: listings.descriptor, neighbourhood: listings.neighbourhood, imageUrl: listings.imageUrl, cityName: cities.name, citySlug: cities.slug, categoryName: categories.name })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .innerJoin(categories, eq(listings.categoryId, categories.id))
    .where(and(eq(cities.countryCode, code), eq(listings.status, "published")))
    .orderBy(desc(listings.isFeatured), desc(listings.createdAt));
  return { country: { code, name: COUNTRY_NAMES[code], listingCount: placeCards.length }, cities: countryCities, listings: placeCards };
}

export async function getPremiumListings() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: listings.id,
      name: listings.name,
      slug: listings.slug,
      descriptor: listings.descriptor,
      neighbourhood: listings.neighbourhood,
      imageUrl: listings.imageUrl,
      cityName: cities.name,
      categoryName: categories.name,
    })
    .from(premiumSubscriptions)
    .innerJoin(listings, eq(premiumSubscriptions.listingId, listings.id))
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .innerJoin(categories, eq(listings.categoryId, categories.id))
    .where(and(eq(premiumSubscriptions.placementEligible, true), eq(listings.status, "published")));
}

export async function getListingBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const listing = await db
    .select({ listing: listings, city: cities, category: categories })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .innerJoin(categories, eq(listings.categoryId, categories.id))
    .where(and(eq(listings.slug, slug), eq(listings.status, "published")))
    .limit(1);
  if (!listing[0]) return undefined;
  const menu = await db.select().from(services).where(eq(services.listingId, listing[0].listing.id));
  return { ...listing[0], services: menu };
}

export async function getArticleBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(articles).where(and(eq(articles.slug, slug), eq(articles.status, "published"))).limit(1);
  return result[0];
}

export async function createInquiry(input: {
  listingId?: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  consentEmail: boolean;
  consentSms: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const result = await db.insert(inquiries).values({
    listingId: input.listingId ?? null,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    message: input.message,
    consentEmail: input.consentEmail,
    consentSms: input.consentSms,
  });
  const inquiryId = Number(result[0].insertId);
  const now = new Date();
  if (input.consentEmail) await db.insert(contactConsents).values({ inquiryId, channel: "email", topic: "Quiet Hour introductions", consentSource: "directory inquiry form", consentedAt: now });
  if (input.consentSms) await db.insert(contactConsents).values({ inquiryId, channel: "sms", topic: "Quiet Hour introductions", consentSource: "directory inquiry form", consentedAt: now });
  return { inquiryId };
}

export async function updateInquiryStatus(input: { id: number; status: "new" | "in_progress" | "closed" }) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  await db.update(inquiries).set({ status: input.status }).where(eq(inquiries.id, input.id));
  return { id: input.id, status: input.status };
}

export async function getCmsSummary() {
  const db = await getDb();
  if (!db) return { listings: [], articles: [], templates: [], inquiries: [], outbox: [], cities: [], categories: [], events: [], metrics: [], localizedContent: [], practitioners: [], services: [] };
  const [allListings, allArticles, templates, allInquiries, outbox, allCities, allCategories, events, metrics, translations, allPractitioners, allServices] = await Promise.all([
    db.select().from(listings).orderBy(desc(listings.updatedAt)),
    db.select().from(articles).orderBy(desc(articles.updatedAt)),
    db.select().from(messageTemplates).orderBy(desc(messageTemplates.updatedAt)),
    db.select().from(inquiries).orderBy(desc(inquiries.createdAt)),
    db.select().from(outboxMessages).orderBy(desc(outboxMessages.createdAt)),
    db.select().from(cities).orderBy(cities.name),
    db.select().from(categories).orderBy(categories.name),
    db.select().from(cityEvents).orderBy(desc(cityEvents.startsAt)),
    db.select().from(cityMetrics).orderBy(desc(cityMetrics.observedAt)),
    db.select().from(localizedContent).orderBy(desc(localizedContent.updatedAt)),
    db.select().from(practitioners).orderBy(practitioners.name),
    db.select().from(services).orderBy(services.title),
  ]);
  return { listings: allListings, articles: allArticles, templates, inquiries: allInquiries, outbox, cities: allCities, categories: allCategories, events, metrics, localizedContent: translations, practitioners: allPractitioners, services: allServices };
}

export async function saveListing(input: {
  id?: number;
  ownerId: number;
  cityId: number;
  categoryId: number;
  name: string;
  slug: string;
  descriptor?: string;
  description?: string;
  neighbourhood?: string;
  address?: string;
  bookingUrl?: string;
  contactEmail?: string;
  imageUrl?: string;
  status: "draft" | "review" | "published";
  isFeatured: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, descriptor: input.descriptor || null, description: input.description || null, neighbourhood: input.neighbourhood || null, address: input.address || null, bookingUrl: input.bookingUrl || null, contactEmail: input.contactEmail || null, imageUrl: input.imageUrl || null };
  if (input.id) {
    await db.update(listings).set(values).where(eq(listings.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(listings).values(values);
  return { id: Number(result[0].insertId) };
}

export async function savePractitioner(input: {
  id?: number;
  listingId: number;
  name: string;
  role?: string;
  credentials?: string;
  biography?: string;
  imageUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, role: input.role || null, credentials: input.credentials || null, biography: input.biography || null, imageUrl: input.imageUrl || null };
  if (input.id) {
    await db.update(practitioners).set(values).where(eq(practitioners.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(practitioners).values(values);
  return { id: Number(result[0].insertId) };
}

export async function saveService(input: {
  id?: number;
  listingId: number;
  title: string;
  durationMinutes?: number;
  priceFromCents?: number;
  description?: string;
  isBookable: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, durationMinutes: input.durationMinutes ?? null, priceFromCents: input.priceFromCents ?? null, description: input.description || null };
  if (input.id) {
    await db.update(services).set(values).where(eq(services.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(services).values(values);
  return { id: Number(result[0].insertId) };
}

export async function saveArticle(input: {
  id?: number;
  authorId: number;
  title: string;
  slug: string;
  excerpt?: string;
  body?: string;
  topic: string;
  coverImageUrl?: string;
  status: "draft" | "review" | "published";
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, excerpt: input.excerpt || null, body: input.body || null, coverImageUrl: input.coverImageUrl || null, publishedAt: input.status === "published" ? new Date() : null };
  if (input.id) {
    await db.update(articles).set(values).where(eq(articles.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(articles).values(values);
  return { id: Number(result[0].insertId) };
}

export async function saveMessageTemplate(input: {
  id?: number;
  channel: "email" | "sms";
  title: string;
  subject?: string;
  body: string;
  purpose: string;
  status: "draft" | "approved" | "archived";
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, subject: input.subject || null };
  if (input.id) {
    await db.update(messageTemplates).set(values).where(eq(messageTemplates.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(messageTemplates).values(values);
  return { id: Number(result[0].insertId) };
}

export async function saveCity(input: {
  id?: number;
  name: string;
  slug: string;
  country: string;
  countryCode: string;
  primaryLocale: string;
  introduction?: string;
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, introduction: input.introduction || null };
  if (input.id) {
    await db.update(cities).set(values).where(eq(cities.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(cities).values(values);
  return { id: Number(result[0].insertId) };
}

export async function saveCategory(input: { id?: number; name: string; slug: string; shortDescription?: string; iconKey?: string; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, shortDescription: input.shortDescription || null, iconKey: input.iconKey || null };
  if (input.id) {
    await db.update(categories).set(values).where(eq(categories.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(categories).values(values);
  return { id: Number(result[0].insertId) };
}

export async function saveCityEvent(input: {
  id?: number;
  cityId: number;
  title: string;
  startsAt: Date;
  endsAt?: Date;
  category?: string;
  venue?: string;
  description?: string;
  sourceName: string;
  sourceUrl: string;
  sourceCheckedAt: Date;
  status: "draft" | "verified" | "archived";
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, endsAt: input.endsAt || null, category: input.category || null, venue: input.venue || null, description: input.description || null };
  if (input.id) {
    await db.update(cityEvents).set(values).where(eq(cityEvents.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(cityEvents).values(values);
  return { id: Number(result[0].insertId) };
}

export async function saveCityMetric(input: {
  id?: number;
  cityId: number;
  metricKey: string;
  label: string;
  value: string;
  methodology: string;
  sourceName: string;
  sourceUrl: string;
  observedAt: Date;
  isPublished: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  if (input.id) {
    await db.update(cityMetrics).set(input).where(eq(cityMetrics.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(cityMetrics).values(input);
  return { id: Number(result[0].insertId) };
}

export async function saveLocalizedContent(input: {
  id?: number;
  entityType: "city" | "listing" | "article" | "category";
  entityId: number;
  locale: string;
  title: string;
  slug?: string;
  excerpt?: string;
  body?: string;
  status: "draft" | "native_review" | "published";
  reviewedBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const values = { ...input, slug: input.slug || null, excerpt: input.excerpt || null, body: input.body || null, reviewedBy: input.reviewedBy || null };
  if (input.id) {
    await db.update(localizedContent).set(values).where(eq(localizedContent.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(localizedContent).values(values);
  return { id: Number(result[0].insertId) };
}

export async function queueMessage(input: { templateId: number; inquiryId: number; channel: "email" | "sms"; renderedContent: string; approvedBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("The directory database is not available");
  const [template, inquiry] = await Promise.all([
    db.select().from(messageTemplates).where(eq(messageTemplates.id, input.templateId)).limit(1),
    db.select().from(inquiries).where(eq(inquiries.id, input.inquiryId)).limit(1),
  ]);
  if (!template[0]) throw new Error("Message template was not found");
  if (template[0].status !== "approved") throw new Error("Only approved templates can enter the delivery queue");
  if (template[0].channel !== input.channel) throw new Error("Message channel must match the selected template");
  if (!inquiry[0]) throw new Error("Inquiry was not found");
  if (input.channel === "email" && !inquiry[0].consentEmail) throw new Error("This inquiry has not opted in to email introductions");
  if (input.channel === "sms" && (!inquiry[0].consentSms || !inquiry[0].phone)) throw new Error("This inquiry has not opted in to SMS introductions with a usable phone number");
  const result = await db.insert(outboxMessages).values({ ...input, status: "ready_for_provider" });
  return { id: Number(result[0].insertId) };
}

export async function getOwnedListing(listingId: number, ownerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(listings).where(and(eq(listings.id, listingId), eq(listings.ownerId, ownerId))).limit(1);
  return result[0];
}

export async function registerPremiumSubscription(input: { listingId: number; tier: "city" | "country"; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null }) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(premiumSubscriptions).where(eq(premiumSubscriptions.listingId, input.listingId)).limit(1);
  if (existing[0]) {
    await db.update(premiumSubscriptions).set({ tier: input.tier, stripeCustomerId: input.stripeCustomerId ?? null, stripeSubscriptionId: input.stripeSubscriptionId ?? null, placementEligible: true }).where(eq(premiumSubscriptions.id, existing[0].id));
    return;
  }
  await db.insert(premiumSubscriptions).values({ ...input, placementEligible: true });
}
