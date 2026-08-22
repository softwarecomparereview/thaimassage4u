-- Your own Fresha partner-referral link (unique to your Fresha account once you
-- sign up — Fresha doesn't publish one per prospect, so this is a single value
-- shown identically on every CRM row for copy-paste into outreach).
ALTER TABLE affiliate_defaults ADD COLUMN fresha_referral_link TEXT;
