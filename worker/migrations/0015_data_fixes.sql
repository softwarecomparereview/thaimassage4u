-- Two data fixes found in a live-site audit (2026-09-04).

-- 1. Three of the twenty journal articles were imported with literal quote
-- characters in their slug (scripts/build_worker_article_migration.mjs did
-- naive `key: value` frontmatter parsing with no YAML library, so
-- `slug: "choosing-a-massage-style"` kept its quotes verbatim). The URL with
-- quotes (/journal/"choosing-a-massage-style") served 200; the clean URL
-- 404'd, and Google was indexing the ugly one. Fixed at the source in that
-- script; this cleans the three rows already in the database. A redirect
-- from the old quoted path to the new clean one is in worker/ssr.tsx, for
-- whatever's already been indexed or bookmarked.
UPDATE qh_articles SET slug = TRIM(slug, '''"') WHERE slug LIKE '"%' OR slug LIKE '''%';

-- 2. The directory's own flagship listing was still carrying its scrape-time
-- placeholder — "123 Example Street, Melbourne VIC 3000" and
-- "+61 4XX XXX XXX" — live on the public page. Whatever the real details are,
-- a placeholder is worse than nothing: it reads as broken to a visitor and is
-- wrong as structured data to a crawler. Nulled rather than guessed; the CMS
-- (or /cms/publishing once the real details are in hand) is where this gets
-- its real address and number.
UPDATE listings SET address = NULL, phone = NULL
WHERE slug = 'thai-massage-for-u-melbourne' AND (address = '123 Example Street, Melbourne VIC 3000' OR phone = '+61 4XX XXX XXX');
