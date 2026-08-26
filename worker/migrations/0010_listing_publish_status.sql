-- A real publish gate on the table the public site actually reads.
--
-- Every listing has been unconditionally public since the Apify migration:
-- `listings` (861 rows, 819 after the #0008 quarantine) has never had a status
-- column, and every public query in worker/directory.ts selects from it with
-- no filter. The CMS's existing "Listings" tab and its published/draft/review
-- status control (client/src/pages/Cms.tsx, worker/cms.ts saveListing) operate
-- entirely on the separate `qh_listings` table, which was populated once by
-- the #0003 sync migration and is never written to by the Apify importer —
-- so that control has had no effect on anything imported since. This adds the
-- one status column that actually governs what the public site serves.
--
-- Ships as a no-op: every existing row defaults to 'published', so applying
-- this migration does not remove a single listing from the site. It exists so
-- an admin can choose to hold a listing back — see worker/publish.ts and the
-- CMS "Publishing" tab — rather than because anything is being hidden today.

ALTER TABLE listings ADD COLUMN status TEXT NOT NULL DEFAULT 'published';

-- Explicit alongside the DEFAULT above, so this line documents the intent even
-- if a future SQLite/D1 version ever changes ADD COLUMN backfill behaviour.
UPDATE listings SET status = 'published' WHERE status IS NULL OR TRIM(status) = '';

CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status);
