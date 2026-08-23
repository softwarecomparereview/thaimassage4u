-- Quiet Hour tables intentionally use the qh_ prefix so legacy production data remains intact.
CREATE TABLE IF NOT EXISTS qh_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  open_id TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  login_method TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_signed_in TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'TH',
  primary_locale TEXT NOT NULL DEFAULT 'en',
  introduction TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  icon_key TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER,
  city_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descriptor TEXT,
  description TEXT,
  neighbourhood TEXT,
  address TEXT,
  booking_url TEXT,
  contact_email TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_practitioners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  credentials TEXT,
  biography TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER,
  price_from_cents INTEGER,
  description TEXT,
  is_bookable INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  body TEXT,
  topic TEXT NOT NULL,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_city_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  category TEXT,
  venue TEXT,
  description TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_checked_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_city_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL,
  metric_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  methodology TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_localized_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('city', 'listing', 'article', 'category')),
  entity_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT,
  excerpt TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'native_review', 'published')),
  reviewed_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, locale)
);

CREATE TABLE IF NOT EXISTS qh_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  consent_email INTEGER NOT NULL DEFAULT 0,
  consent_sms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_contact_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquiry_id INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  topic TEXT NOT NULL,
  consent_source TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  title TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qh_outbox_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  inquiry_id INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  rendered_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready_for_provider', 'sent', 'skipped')),
  approved_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS qh_premium_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'city' CHECK (tier IN ('city', 'country')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  placement_eligible INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS qh_listings_city_status_idx ON qh_listings(city_id, status);
CREATE INDEX IF NOT EXISTS qh_articles_status_published_idx ON qh_articles(status, published_at);
CREATE INDEX IF NOT EXISTS qh_events_city_status_idx ON qh_city_events(city_id, status);
