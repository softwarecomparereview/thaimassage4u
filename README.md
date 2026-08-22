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

Open `http://localhost:8787`. Put `ADMIN_PASSWORD=dev-admin` in `.dev.vars` to use `/admin` locally. For Browser Run you need `wrangler dev --remote` (or `"remote": true` on the browser binding) plus an account.

Admin scrape (after `wrangler secret put ADMIN_SCRAPE_KEY`):

```bash
curl -X POST https://thaimassageforu.com/api/scrape/de/berlin \
  -H "x-admin-key: $ADMIN_SCRAPE_KEY"
```

## Deploy

Production Worker is live at **https://thaimassageforu.aniruddh-6d3.workers.dev**.

D1 (`thaimassageforu`) and queue (`thaimassageforu-leads`) are created in the Cloudflare account. KV/R2 were skipped because this API token cannot create those products; page cache and media uploads no-op until a token with Workers KV + R2 edit is used.

Redeploy:

```bash
npx wrangler deploy
```

Optional secrets (Places/SERP jobs):

```bash
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put SERPAPI_KEY
```

`thaimassageforu.com` still points at GitHub Pages. Attach the Worker custom domain after the hostname is added as a zone in this Cloudflare account (Workers cannot bind a domain whose nameservers are not on Cloudflare). Then turn off GitHub Pages for the `.com`.

## Sale

`/for-sale` is the public offer page (cute spa-cottage graphic + form). Offers write to D1, R2 and a Workflow. Any serious offer is considered.
