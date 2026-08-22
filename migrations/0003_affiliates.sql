CREATE TABLE affiliate_defaults (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Thai Massage For U',
  contact_email TEXT,
  login_email TEXT,
  login_secret TEXT,
  website TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO affiliate_defaults (id, company_name, contact_email, login_email, website, notes) VALUES
  (1, 'Thai Massage For U', 'hello@thaimassageforu.com', 'hello@thaimassageforu.com', 'https://thaimassageforu.com', 'Preferred signup identity for review and booking partner sites. Store one password you use only for those dashboards. This Worker never submits the form on another company’s website.');

CREATE TABLE affiliate_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL,
  program_name TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'Thai Massage For U',
  signup_url TEXT NOT NULL,
  login_url TEXT,
  contact_email TEXT,
  affiliate_id TEXT,
  login_email TEXT,
  login_secret TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO affiliate_programs (country_code, program_name, company_name, signup_url, login_url, notes, status) VALUES
  ('us', 'Yelp Ads / Affiliates', 'Thai Massage For U', 'https://biz.yelp.com/claim', 'https://biz.yelp.com/login', 'US neighbourhood reviews. Claim or add the business page, then advertise city pages. Do not scrape listings.', 'todo'),
  ('us', 'TripAdvisor owners', 'Thai Massage For U', 'https://www.tripadvisor.com/Owners', 'https://www.tripadvisor.com/Owners', 'Hospitality reviews. Management Center for owners. Partnership access — not a bulk review dump.', 'todo'),
  ('uk', 'Trustpilot Business', 'Thai Massage For U', 'https://business.trustpilot.com/signup', 'https://businessapp.b2b.trustpilot.com/', 'UK and EU review layer. Invite studios you work with; do not import Google text.', 'todo'),
  ('uk', 'Treatwell Partner', 'Thai Massage For U', 'https://connect.treatwell.co.uk/join/', 'https://connect.treatwell.co.uk/login', 'UK spa bookings. Strong for London and Manchester rooms. Marketing page is treatwell.co.uk/partners/.', 'todo'),
  ('au', 'ProductReview business', 'Thai Massage For U', 'https://www.productreview.com.au/for-businesses', 'https://www.productreview.com.au/', 'The Australian review habit. Claim a brand page, then link city landers.', 'todo'),
  ('au', 'True Local business', 'Thai Massage For U', 'https://my.yellow.com.au/online-signup/', 'https://www.truelocal.com.au/', 'AU local directory under Yellow/Sensis. Add or claim a listing via myYellow, then confirm Melbourne/Sydney phones on True Local.', 'todo'),
  ('de', 'ProvenExpert', 'Thai Massage For U', 'https://www.provenexpert.com/en-us/register/', 'https://www.provenexpert.com/en-us/login/', 'German review profiles for Körperarbeit. Berlin first.', 'todo'),
  ('de', 'Trustpilot Business DE', 'Thai Massage For U', 'https://business.trustpilot.com/signup', 'https://businessapp.b2b.trustpilot.com/', 'German and English reviews on one profile.', 'todo'),
  ('all', 'Fresha Partner', 'Thai Massage For U', 'https://partners.fresha.com/users/sign-up', 'https://partners.fresha.com/users/sign-in', 'Booking software many Thai studios already use. Country-agnostic. Marketing page is fresha.com/for-business.', 'todo'),
  ('all', 'Foursquare Places (developer)', 'Thai Massage For U', 'https://foursquare.com/developers/signup', 'https://foursquare.com/developers/login', 'POI popularity signals. Commercial key required. Cache ratings, not review essays.', 'todo');
