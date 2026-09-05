-- 407 of 1,564 published listings (26%) had no row in qh_listings at all — the legacy mirror
-- table worker/stripe.ts's premium-checkout flow looked up by slug. Every one of those listing
-- pages' "buy premium placement" button 404'd with "That listing isn't in the directory yet",
-- even though the listing was live and fully published. Backfills the missing rows from the real
-- `listings` table so checkout works for every currently-published listing in every country.
-- worker/stripe.ts's handlePublicPremiumCheckout also now self-heals this on the fly for any
-- future listing that hits the same gap, so this is a one-time catch-up, not the actual fix.
INSERT INTO qh_listings (city_id, category_id, name, slug, descriptor, description, neighbourhood, address, booking_url, contact_email, image_url, status)
SELECT qc.id, 1, l.name, l.slug, l.descriptor, l.description, l.suburb, l.address, l.website, l.email, l.image_url, 'published'
FROM listings l
JOIN qh_cities qc ON qc.slug = l.city_slug
WHERE l.status = 'published' AND l.slug NOT IN (SELECT slug FROM qh_listings);
