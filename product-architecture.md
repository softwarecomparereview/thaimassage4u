# Quiet Hour Product Architecture

## Public Experience

Quiet Hour opens as a city-first wellness field guide. The public experience has five connected areas: the home page establishes the city and the platform’s point of view; the directory makes treatments, practitioners, and studios discoverable; city pages collect local knowledge by neighbourhood and modality; listing profiles turn discovery into an enquiry or external booking action; and the editorial journal adds trustworthy, clearly-labelled wellbeing reading.

| Route | Purpose | Primary action |
|---|---|---|
| `/` | City wellness directory landing page | Search a place, treatment, or neighbourhood |
| `/directory` | Filterable wellness discovery | Open a listing or refine results |
| `/city/:slug` | Local city guide with featured and premium listings | Explore a neighbourhood or treatment |
| `/listing/:slug` | Independent provider profile, service menu, portfolio, and contact path | Enquire or book with the provider |
| `/journal` | Mindfulness, massage, and everyday circulation reading | Read an article |
| `/journal/:slug` | Individual editorial article | Discover related reading or a local practitioner |
| `/list-your-place` | Partner value proposition and US$21/week listing purchase | Start a premium listing |

## Content Model

The database separates editorial content, directory content, and messaging consent so that each area can evolve without being stored as one overloaded profile record.

| Entity | Required fields | Notes |
|---|---|---|
| City | name, slug, country, introduction, active | An editable local guide rather than a hard-coded location list. |
| Neighbourhood | city_id, name, slug, descriptor | Supports local discovery and city page structure. |
| Category | name, slug, short_description, icon_key | Initial categories: Massage, Mindfulness, Movement, Recovery, and Rest. |
| Listing | owner_id, city_id, category_id, name, slug, descriptor, status, booking_url, address, contact_email, featured | A business or practitioner’s public directory identity. |
| Practitioner | listing_id, name, role, credentials, biography, image_url | Allows a studio to represent multiple practitioners. |
| Service | listing_id, title, duration_minutes, price_from, description, bookable | Communicates concrete value without pretending to provide live availability. |
| ListingMedia | listing_id, url, alt_text, sort_order | Holds portfolio and profile imagery. |
| PremiumSubscription | listing_id, weekly_price_usd, status, starts_at, ends_at, payment_reference | Fixed at US$21 weekly for the initial plan. |
| Article | title, slug, excerpt, body, category, cover_image_url, status, published_at | Supports draft, review, and published editorial states. |
| Inquiry | listing_id, name, email, phone, message, consent_channels, status | Records a visitor’s contact request and permissions separately. |
| ContactConsent | contact_id, channel, topic, consent_source, consented_at, withdrawn_at | Stores separate permissions for email and SMS introduction sequences. |
| MessageTemplate | channel, title, subject, body, purpose, status, variables | Uses `draft`, `approved`, and `archived` states. |
| OutboxMessage | template_id, contact_id, rendered_content, channel, status, approved_by, sent_at | Records planned and sent communications without coupling to one provider. |

## Premium Listing Behaviour

Premium listings are a transparent discovery upgrade, not a fabricated social-proof device. The homepage and city pages will surface these paid placements in a defined “Featured in this city” band. The band renders as a balanced static composition while one to three eligible listings exist. Once the fourth eligible listing is present, it changes to the slow scrolling ribbon described in `ideas.md`; its content is duplicated only for visual continuity, never as duplicate listing records, and it pauses on hover or focus.

| Premium condition | Interface behaviour |
|---|---|
| 0 eligible listings | Premium area is hidden. |
| 1–3 eligible listings | Static, evenly spaced cards with no automatic motion. |
| 4+ eligible listings | A controlled horizontal ribbon begins its low-speed scroll. |
| Reduced-motion preference | Static cards regardless of listing count. |

## Introductory Communications

Quiet Hour will use useful, non-generic templates to introduce the directory to businesses and, only where a recipient has expressly opted in, to visitors. A communication record is always channel-specific and topic-specific. The builder must never treat a submitted phone number as broad marketing consent.

| Template | Channel | Trigger | Intended voice |
|---|---|---|---|
| Partner introduction | Email | Curated prospective partner with validated consent | Observant, brief, and specific to the city. |
| Partner follow-up | Email | Three days after an unopened or unresponded introduction | Helpful, never pressure-driven. |
| Listing approved | Email | Listing is approved in CMS | Clear next step and preview link. |
| Premium listing live | Email | Successful weekly purchase | Confirmation with start date, price, and management link. |
| Welcome to Quiet Hour | SMS | Visitor explicitly opts in to welcome messages | Short, direct, and identifies Quiet Hour. |
| Browse reminder | SMS | Future optional sequence; only when recurring SMS consent exists | One useful city-specific prompt with STOP language. |

> Quiet Hour will not send any outbound SMS or email in this build. The CMS will provide templates, approval statuses, consent records, and a provider-ready outbox. Live delivery requires the user to connect a transactional email provider and an SMS provider with compliant sender registration and recipient consent.

## Foundational Copy

The directory begins with honest, editorially useful language rather than inflated promises. The homepage headline is “Your next exhale has an address.” The directory search prompt is “Find a practitioner worth leaving your neighbourhood for.” The premium partner invitation is “A clearer place to be found.” The price statement is “Premium City Listing — US$21 per week. Pause or cancel anytime from your dashboard.”
