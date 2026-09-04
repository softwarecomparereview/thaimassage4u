-- worker/enrich.ts and worker/enrichment.ts were two separate, unreconciled
-- Workers AI enrichment jobs, built concurrently on diverged branches and
-- merged without either side noticing the other existed:
--
--   worker/enrich.ts    — writes descriptor + description + services + image
--                          straight to `listings`, unconditionally, every 15
--                          minutes, with no on/off switch, no daily cap, no
--                          review step, and no visibility in the CMS.
--   worker/enrichment.ts — a description-only proposal queue gated by CMS
--                          settings (on/off, daily cap, model, auto-publish),
--                          with a review UI at /cms/enrichment. Because
--                          enrich.ts's cron always ran first and unconditionally,
--                          most rows were already enriched — and their
--                          description already past the "thin" threshold this
--                          job selects on — before this job's own review queue
--                          ever had a chance to matter.
--
-- This reconciles them into one engine: enrich.ts's richer, better-grounded
-- generation (title/meta-description/og:image extraction, German-language
-- support, descriptor + description + services output) running inside
-- enrichment.ts's governance (on/off, daily cap, concurrency, model choice,
-- run history, review queue). See worker/enrichment.ts.
--
-- These three columns hold the extra fields a proposal now carries besides
-- the description column added in #0009 — nullable, so an old
-- description-only proposal row still reads back fine.
ALTER TABLE qh_enrichment_items ADD COLUMN generated_descriptor TEXT;
ALTER TABLE qh_enrichment_items ADD COLUMN generated_services TEXT;
ALTER TABLE qh_enrichment_items ADD COLUMN generated_image_url TEXT;
