# Listing data audit — 2026-08-26

All 861 live listings were pulled from the public API and checked field by
field. The point of the audit was reputability: which rows make the directory
look less trustworthy than the data behind it actually is.

## What was wrong

| Class | Rows | Why it is a problem |
|---|---:|---|
| Unactionable | 38 | No phone, no website, no email, no address. A visitor cannot call, visit or book. A crawler gets a contentless page. The claim flow sends its one-time code to a contact address that does not exist, so the business cannot repair it either. |
| Off-category | 5 | Nail salons that passed the importer's name filter because "Spa" appears in their name, and offer no massage service. |
| Broken website link | 3 | Stored without a scheme (`www.theplaceformassage.com`), so the rendered link resolved relative to thaimassageforu.com and 404'd instead of reaching the studio. |

The unactionable rows concentrate in the thinnest cities — Birmingham 9,
Adelaide 8, Las Vegas 6, Chicago 5, Miami 4 — which is exactly where a
contentless page does the most damage per visit.

## What was checked and found to be fine

Four things looked like problems and were not. They are recorded here so the
next audit does not re-litigate them.

- **7 × "Bua Siam Thai Massage Spa" in Munich, 16 × endota spa** — genuinely
  distinct branches at distinct addresses. Real chains, not duplicates.
- **283 addresses that do not contain the assigned city name** — "München" vs
  Munich, "Köln" vs Cologne, and suburbs such as Wandsbek (Hamburg) and Glebe
  (Sydney). All correctly assigned.
- **6 pairs sharing an address** — street-level addresses with no building
  number ("High Street, Bristol"), held by two different businesses. Low
  precision, not duplication.
- **No adult-services signals** in any name, description or service list, on
  any of the 861 rows.

## What was deliberately left in place

- **79 rows with an address but no phone, website or email.** A visitor can
  still walk in, and the address makes the row repairable.
- **757 rows with no image.** Incomplete, not wrong.
- **15 rows whose address has no street number.** Imprecise, but a real place.

## Where the bad rows went

`worker/migrations/0008_quarantine_unusable_listings.sql` moves them to
`listings_quarantine`, which clones the live `listings` schema and adds
`quarantine_reason` and `quarantined_at`. Nothing is deleted, the original `id`
is preserved, and the matching `qh_listings` copy is removed only where nobody
owns it.

Rows that are claimed or paying are never quarantined, whatever else they match.

The migration is idempotent: rerunning it moves nothing further and does not
double-prefix a repaired URL. It was tested against a local SQLite fixture
built from all 861 live records before being committed.

### Restoring a row

Repair the row in place, then move it back. The column list keeps the insert
independent of column order:

```sql
-- 1. fix whatever made it unusable
UPDATE listings_quarantine SET phone = '+1 312 555 0100' WHERE slug = 'the-now-chicago';

-- 2. move it back (list the columns of `listings`, in that order)
INSERT INTO listings (<columns>) SELECT <columns> FROM listings_quarantine WHERE slug = 'the-now-chicago';
DELETE FROM listings_quarantine WHERE slug = 'the-now-chicago';
```

### Applying it

D1 migrations in this repo are applied by hand; the Cloudflare build only runs
`pnpm run worker:deploy`, which does not touch the database.

```bash
npx wrangler d1 migrations apply thaimassageforu --remote
```

Verify afterwards:

```bash
npx wrangler d1 execute thaimassageforu --remote \
  --command "SELECT quarantine_reason, COUNT(*) FROM listings_quarantine GROUP BY 1"
```

Expect roughly 38 unactionable and 5 off-category. The SQL evaluates the real
columns rather than a fixed list of slugs, so the live numbers decide.

## Preventing recurrence

`scripts/import-apify-listings.mjs` now rejects both classes at import time: a
name that says nails and never says massage, and any record with no phone,
website, email or address. Both are reported in the import summary.
