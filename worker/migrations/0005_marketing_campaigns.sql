-- Outbound email/SMS marketing campaigns: audience (CSV upload or
-- city/country selection), delivery + engagement tracking, and inbound
-- reply capture. Separate from qh_outbox_messages/qh_inquiries, which are
-- built around replying to a visitor's own inquiry — campaigns send to an
-- audience that never contacted us first (e.g. every studio owner in a
-- city), so they need their own recipient list and status lifecycle.

CREATE TABLE IF NOT EXISTS qh_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject TEXT,
  body TEXT NOT NULL,
  audience_source TEXT NOT NULL CHECK (audience_source IN ('csv', 'city', 'country')),
  audience_filter TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS qh_campaign_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  listing_id INTEGER,
  name TEXT,
  email TEXT,
  phone TEXT,
  city_slug TEXT,
  country_code TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'unsubscribed')),
  provider_message_id TEXT,
  error TEXT,
  queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  delivered_at TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  bounced_at TEXT
);

CREATE INDEX IF NOT EXISTS qh_campaign_recipients_campaign_idx ON qh_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS qh_campaign_recipients_provider_msg_idx ON qh_campaign_recipients(provider_message_id);

-- Every reply/inbound message, from either channel — Cloudflare Email
-- Routing (email() handler in worker/index.ts) for email replies, Twilio's
-- inbound-SMS webhook for SMS replies. Shown in the admin inbox.
CREATE TABLE IF NOT EXISTS qh_inbound_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  campaign_recipient_id INTEGER,
  read_at TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS qh_inbound_messages_received_idx ON qh_inbound_messages(received_at DESC);

-- A permanent per-address opt-out, checked before every campaign send
-- regardless of audience source. Once here, an address never gets queued
-- again until removed.
CREATE TABLE IF NOT EXISTS qh_suppressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  address TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribed', 'bounced', 'complained')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel, address)
);
