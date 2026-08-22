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
| Cron | enqueue city scrapes every 6 hours |
| Observability | logs + traces |

Browser Run only hits `openstreetmap.org` and `en.wikipedia.org`. It does **not** scrape Google or login-walled directories. Map-derived names are attributed ODbL.

## Local

```bash
npm install
npm run seed:local
npm test
npm run dev
```

Open `http://localhost:8787`. For Browser Run locally you need `wrangler dev --remote` (or `"remote": true` on the browser binding) plus an account.

Admin scrape (after `wrangler secret put ADMIN_SCRAPE_KEY`):

```bash
curl -X POST https://thaimassageforu.com/api/scrape/de/berlin \
  -H "x-admin-key: $ADMIN_SCRAPE_KEY"
```

## Deploy

Create the D1 database, KV namespace, R2 bucket and queue, put their IDs in `wrangler.jsonc`, then:

```bash
npx wrangler d1 migrations apply thaimassageforu --remote
npx wrangler d1 execute thaimassageforu --remote --file=./seed/seed.sql
npx wrangler secret put ADMIN_SCRAPE_KEY
npx wrangler deploy
```

Replace placeholder IDs in `wrangler.jsonc` before production deploy.

## Sale

`/for-sale` is the public offer page (cute spa-cottage graphic + form). Offers write to D1, R2 and a Workflow. Any serious offer is considered.
