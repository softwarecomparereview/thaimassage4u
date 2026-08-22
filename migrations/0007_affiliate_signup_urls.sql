-- Official partner URLs checked 2026-08-22. Several kit links 404'd.
UPDATE affiliate_programs SET
  signup_url = 'https://biz.yelp.com/claim',
  login_url = 'https://biz.yelp.com/login',
  notes = 'US neighbourhood reviews. Claim or add the business page, then advertise city pages. Do not scrape listings.'
WHERE program_name = 'Yelp Ads / Affiliates';

UPDATE affiliate_programs SET
  signup_url = 'https://www.tripadvisor.com/Owners',
  login_url = 'https://www.tripadvisor.com/Owners',
  notes = 'Hospitality reviews. Management Center for owners. Partnership access — not a bulk review dump.'
WHERE program_name = 'TripAdvisor owners';

UPDATE affiliate_programs SET
  signup_url = 'https://business.trustpilot.com/signup',
  login_url = 'https://businessapp.b2b.trustpilot.com/',
  notes = 'UK and EU review layer. Invite studios you work with; do not import Google text.'
WHERE program_name = 'Trustpilot Business';

UPDATE affiliate_programs SET
  signup_url = 'https://connect.treatwell.co.uk/join/',
  login_url = 'https://connect.treatwell.co.uk/login',
  notes = 'UK spa bookings. Strong for London and Manchester rooms. Marketing page is treatwell.co.uk/partners/.'
WHERE program_name = 'Treatwell Partner';

UPDATE affiliate_programs SET
  signup_url = 'https://www.productreview.com.au/for-businesses',
  login_url = 'https://www.productreview.com.au/',
  notes = 'The Australian review habit. Claim a brand page, then link city landers.'
WHERE program_name = 'ProductReview business';

UPDATE affiliate_programs SET
  signup_url = 'https://my.yellow.com.au/online-signup/',
  login_url = 'https://www.truelocal.com.au/',
  notes = 'AU local directory under Yellow/Sensis. Add or claim a listing via myYellow, then confirm Melbourne/Sydney phones on True Local.'
WHERE program_name = 'True Local business';

UPDATE affiliate_programs SET
  signup_url = 'https://www.provenexpert.com/en-us/register/',
  login_url = 'https://www.provenexpert.com/en-us/login/',
  notes = 'German review profiles for Körperarbeit. Berlin first.'
WHERE program_name = 'ProvenExpert';

UPDATE affiliate_programs SET
  signup_url = 'https://business.trustpilot.com/signup',
  login_url = 'https://businessapp.b2b.trustpilot.com/',
  notes = 'German and English reviews on one profile.'
WHERE program_name = 'Trustpilot Business DE';

UPDATE affiliate_programs SET
  signup_url = 'https://partners.fresha.com/users/sign-up',
  login_url = 'https://partners.fresha.com/users/sign-in',
  notes = 'Booking software many Thai studios already use. Country-agnostic. Marketing page is fresha.com/for-business.'
WHERE program_name = 'Fresha Partner';

UPDATE affiliate_programs SET
  signup_url = 'https://foursquare.com/developers/signup',
  login_url = 'https://foursquare.com/developers/login',
  notes = 'POI popularity signals. Commercial key required. Cache ratings, not review essays.'
WHERE program_name = 'Foursquare Places (developer)';
