# Thai Massage For U — international directory

`thaimassageforu.com` is now a Cloudflare Worker city directory for **USA**, **UK**, **Australia**, and **Germany**. Listings, offers, claims and keyword evidence live in **D1**. The previous Melbourne-only HTML files 301 into `/au/melbourne`.

## Why Germany is the fourth country

USA, UK and Australia were required. The extra country was chosen on documented SERP/search volume, not adjacency:

| Signal | Why it matters |
| --- | --- |
| `thai massage in berlin` **16,400**/mo | Performance Suite DE keyword DB |
| `thaimassagen berlin` **14,300**/mo | Same source |
| `thai massagen berlin` **7,400**/mo | Same source |
| `thaimassage berlin` **5,000**/mo | Same source |
| **Berlin cluster ≈ 43,100**/mo | Largest measured city cluster among candidates |

Canada (~604 Thai massage POIs) and New Zealand are smaller English markets. Thailand has tourist volume but overlaps the origin keyword and is a weaker B2B listing market for a Western .com. Germany wins on **commercial local keywords** that a dedicated portal can still rank.

Those numbers are stored in D1 (`keyword_stats`) and rendered on `/` and `/de`.

## SEO architecture

Clean country folders keep one .com authority:

- `/` international hub + `WebSite` SearchAction
- `/us` `/uk` `/au` `/de` country hubs
- `/us/los-angeles` city landers with unique H1s
- `/de/berlin/lotus-river-berlin` storefronts + LocalBusiness JSON-LD
- `/sitemap.xml` and `/robots.txt`
- Legacy `*.html` URLs 301 to the AU folder

## Cloudflare map

| Feature | Use |
| --- | --- |
| Workers + static assets | SSR HTML, `/styles.css`, `/images/*` |
| D1 | countries, cities, listings, keywords, offers, claims, scrape jobs |
| KV | HTML + sitemap cache |
| R2 | archived offers/leads |
| Queues | lead fan-out + city scrape jobs |
| Durable Objects | form rate limits |
| Workflows | sale-offer intake |
| Browser Run | scrape allowlisted OSM + Wikipedia pages |
| Analytics Engine | path events |
| Cron | 6-hourly Places/OSM refresh + daily 06:20 UTC SERP rewrite |
| Observability | logs + traces |

Live studios come from the **Google Places API** (not Maps HTML). Thumbnails prefer Place photos, then the spa website `og:image`, then a Browser Run screenshot of that website. Daily **SerpAPI** snapshots rewrite city titles, H1s, FAQs and related-search chips.

## Country + city look-and-feel

Each public page stacks CSS layers on `<body>`:

1. `theme-base` — shared spa chrome
2. `theme-us` / `theme-uk` / `theme-au` / `theme-de` — country palette, type and hero wash
3. `theme-de-berlin` (and one class per city) — local overlay on top of the country tokens

`/de` shows the German layer only. `/de/berlin` keeps that layer and adds Berlin U-Bahn yellow on top. Copy for both layers is in `src/lib/themes.ts`; colours live in `public/themes.css`.

Password-protected CMS: `/admin` (set `ADMIN_PASSWORD`). It edits D1 listings without moving the site to WordPress or Webflow.

Set secrets before production enrich/SERP jobs:

```bash
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put SERPAPI_KEY
npx wrangler secret put ADMIN_SCRAPE_KEY
```

## Local

```bash
npm install
npm run seed:local
npm test
npm run dev
```

## Seed data: real listings, not placeholders

`seed/seed.sql` is generated, not hand-written. Every business in it (bar four
hand-picked Melbourne rooms marked `source = 'editor'`) is a real point of
interest scraped from **OpenStreetMap** — real name, real street address, and
real phone/website/opening hours where the OSM mapper recorded them. Nothing
is invented: a listing with no known phone says so instead of making one up.

To refresh it:

```bash
node scripts/scrape-osm-listings.mjs   # queries Overpass for shop=massage / amenity=spa
                                        # per city in scripts/cities.mjs, writes data/osm-listings.json
node scripts/generate-seed.mjs         # turns that cache + country/city metadata into seed/seed.sql
```

Each listing's description is composed from its own scraped facts (street,
contact details, posted hours) through one of several sentence shapes chosen
per-listing, so copy never repeats verbatim across ~500 businesses. Thumbnails
come from `listingPhoto()` (`src/lib/photos.ts`), which falls back to a
rotating pool of real interior photos for any listing without its own image —
scraped listings intentionally don't set `image_url`, so they always get one.

OSM data is © OpenStreetMap contributors, ODbL — attributed in the site
footer. See `https://www.openstreetmap.org/copyright`.

Open `http://localhost:8787`. Put `ADMIN_PASSWORD=dev-admin` in `.dev.vars` to use `/admin` locally. For Browser Run you need `wrangler dev --remote` (or `"remote": true` on the browser binding) plus an account.

Admin scrape (after `wrangler secret put ADMIN_SCRAPE_KEY`):

```bash
curl -X POST https://thaimassageforu.com/api/scrape/de/berlin \
  -H "x-admin-key: $ADMIN_SCRAPE_KEY"
```

## Deploy

Production Worker is live at **https://thaimassageforu.aniruddh-6d3.workers.dev**.

D1, KV (`CACHE`), R2 (`thaimassageforu-media`), and queue (`thaimassageforu-leads`) are in the Cloudflare account. Custom domains `thaimassageforu.com` and `www.thaimassageforu.com` are configured on the Worker.

Nameservers are Cloudflare (`bruce.ns.cloudflare.com`, `piper.ns.cloudflare.com`). The Worker is attached as a custom domain on `thaimassageforu.com` and `www`.

Do **not** add a `CNAME` file or a GitHub Pages custom domain for this hostname. The old Melbourne site in `softwarecomparereview/directoryservices` still has Pages bound to `thaimassageforu.com`; that makes any resolver still holding GoDaddy/GitHub IPs show Pages instead of the Worker. Remove that Pages custom domain so the hostname cannot revert.

First visit from the USA, UK, Australia or Germany is sent to `/us`, `/uk`, `/au` or `/de`. Clicking another country is remembered, so you can browse and test that market. **All countries** (`/?intl=1`) shows the international hub. Search engines still see `/` un-redirected.

Redeploy:

```bash
npx wrangler deploy
```

Optional secrets (Places/SERP jobs):

```bash
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put SERPAPI_KEY
```

## Sale

`/for-sale` is the public offer page (cute spa-cottage graphic + form). Offers write to D1, R2 and a Workflow. Any serious offer is considered.
