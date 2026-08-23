import {
  boolean,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const cities = mysqlTable(
  "cities",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    country: varchar("country", { length: 120 }).notNull(),
    countryCode: varchar("countryCode", { length: 2 }).default("TH").notNull(),
    primaryLocale: varchar("primaryLocale", { length: 16 }).default("en").notNull(),
    introduction: text("introduction"),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ slugUnique: uniqueIndex("cities_slug_unique").on(table.slug) }),
);

export const cityEvents = mysqlTable("cityEvents", {
  id: int("id").autoincrement().primaryKey(),
  cityId: int("cityId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt"),
  category: varchar("category", { length: 120 }),
  venue: varchar("venue", { length: 180 }),
  description: text("description"),
  sourceName: varchar("sourceName", { length: 180 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1000 }).notNull(),
  sourceCheckedAt: timestamp("sourceCheckedAt").notNull(),
  status: mysqlEnum("status", ["draft", "verified", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const cityMetrics = mysqlTable("cityMetrics", {
  id: int("id").autoincrement().primaryKey(),
  cityId: int("cityId").notNull(),
  metricKey: varchar("metricKey", { length: 120 }).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  value: varchar("value", { length: 120 }).notNull(),
  methodology: text("methodology").notNull(),
  sourceName: varchar("sourceName", { length: 180 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1000 }).notNull(),
  observedAt: timestamp("observedAt").notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const localizedContent = mysqlTable(
  "localizedContent",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: mysqlEnum("entityType", ["city", "listing", "article", "category"]).notNull(),
    entityId: int("entityId").notNull(),
    locale: varchar("locale", { length: 16 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 280 }),
    excerpt: text("excerpt"),
    body: longtext("body"),
    status: mysqlEnum("status", ["draft", "native_review", "published"]).default("draft").notNull(),
    reviewedBy: int("reviewedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ localeEntityUnique: uniqueIndex("localized_content_entity_locale_unique").on(table.entityType, table.entityId, table.locale) }),
);

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    shortDescription: varchar("shortDescription", { length: 255 }),
    iconKey: varchar("iconKey", { length: 64 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ slugUnique: uniqueIndex("categories_slug_unique").on(table.slug) }),
);

export const listings = mysqlTable(
  "listings",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId"),
    cityId: int("cityId").notNull(),
    categoryId: int("categoryId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    descriptor: varchar("descriptor", { length: 255 }),
    description: longtext("description"),
    neighbourhood: varchar("neighbourhood", { length: 120 }),
    address: varchar("address", { length: 255 }),
    bookingUrl: varchar("bookingUrl", { length: 1000 }),
    contactEmail: varchar("contactEmail", { length: 320 }),
    imageUrl: varchar("imageUrl", { length: 1000 }),
    status: mysqlEnum("status", ["draft", "review", "published"]).default("draft").notNull(),
    isFeatured: boolean("isFeatured").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ slugUnique: uniqueIndex("listings_slug_unique").on(table.slug) }),
);

export const practitioners = mysqlTable("practitioners", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  role: varchar("role", { length: 160 }),
  credentials: text("credentials"),
  biography: longtext("biography"),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  durationMinutes: int("durationMinutes"),
  priceFromCents: int("priceFromCents"),
  description: text("description"),
  isBookable: boolean("isBookable").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const articles = mysqlTable(
  "articles",
  {
    id: int("id").autoincrement().primaryKey(),
    authorId: int("authorId"),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 280 }).notNull(),
    excerpt: text("excerpt"),
    body: longtext("body"),
    topic: varchar("topic", { length: 120 }).notNull(),
    coverImageUrl: varchar("coverImageUrl", { length: 1000 }),
    status: mysqlEnum("status", ["draft", "review", "published"]).default("draft").notNull(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ slugUnique: uniqueIndex("articles_slug_unique").on(table.slug) }),
);

export const inquiries = mysqlTable("inquiries", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId"),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  message: longtext("message").notNull(),
  consentEmail: boolean("consentEmail").default(false).notNull(),
  consentSms: boolean("consentSms").default(false).notNull(),
  status: mysqlEnum("status", ["new", "in_progress", "closed"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const contactConsents = mysqlTable("contactConsents", {
  id: int("id").autoincrement().primaryKey(),
  inquiryId: int("inquiryId").notNull(),
  channel: mysqlEnum("channel", ["email", "sms"]).notNull(),
  topic: varchar("topic", { length: 160 }).notNull(),
  consentSource: varchar("consentSource", { length: 255 }).notNull(),
  consentedAt: timestamp("consentedAt").notNull(),
  withdrawnAt: timestamp("withdrawnAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messageTemplates = mysqlTable("messageTemplates", {
  id: int("id").autoincrement().primaryKey(),
  channel: mysqlEnum("channel", ["email", "sms"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  body: longtext("body").notNull(),
  purpose: varchar("purpose", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["draft", "approved", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const outboxMessages = mysqlTable("outboxMessages", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  inquiryId: int("inquiryId").notNull(),
  channel: mysqlEnum("channel", ["email", "sms"]).notNull(),
  renderedContent: longtext("renderedContent").notNull(),
  status: mysqlEnum("status", ["draft", "ready_for_provider", "sent", "skipped"]).default("draft").notNull(),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
});

export const premiumSubscriptions = mysqlTable(
  "premiumSubscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    listingId: int("listingId").notNull(),
    tier: mysqlEnum("tier", ["city", "country"]).default("city").notNull(),
    stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
    stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
    placementEligible: boolean("placementEligible").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ listingUnique: uniqueIndex("premium_listing_unique").on(table.listingId) }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
