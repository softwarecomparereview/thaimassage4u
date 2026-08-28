// Shared quality/brand-safety gate for every scrape → import pipeline in this repo. Google Maps
// text search for "massage"/"spa" surfaces real adult-services businesses alongside legitimate
// ones — nothing in the actor's output flags this, so it has to be caught by pattern-matching the
// business's own text. Checked against BOTH the listing name and its website/email domain: one
// AU import slipped through with a clean name ("Touch By Venus Massage & Holistic Bodywork") but
// a giveaway contact domain (sensualmassagemelbourne.com) — name-only matching would have missed it.
//
// No word-boundary anchoring on purpose: a domain/email is one unbroken string
// ("sensualmassagemelbourne.com"), so \bsensual\b would never match it — only a plain substring
// check does. Each term below is specific enough on its own (not a bare word like "happy" or
// "body") that this doesn't reject legitimate names like "Happy Face Massage" or "Body Balance Spa".
// "eroti[ckq]" rather than "erotic", and "sensu[ae]l" rather than "sensual", because this
// directory is not English-only: DE is a live market and FR-Canada arrived with the 2026-08-28
// pull. "erotic" matches neither German "Erotik" nor French "érotique" (which folds to
// "erotique", not "erotic") — Montréal's "Secret Spa - Massage Érotique" walked through both
// the name and the domain gate on exactly that gap. Same for German "sensuell"/French "sensuel".
const ADULT_SERVICE_PATTERN = /tantra|eroti[ckq]|escort|happy[\s-]?ending|happy\s*finish|sensu[ae]l|nuru|body\s*2\s*body|\bb2b\b|incall|outcall|intimacy|intimate massage/i;

/**
 * Strip accents before matching. Montréal's "Secret Spa - Massage Érotique" survived both the
 * name and the domain gate purely because "Érotique" is not "erotic" to a regex — it took the
 * website read to catch it. Any francophone market (CA today, FR/BE later) can produce the
 * same miss, so fold the diacritics first and let the existing terms do their job.
 */
function fold(text) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function isAdultServiceMatch(name, ...contactFields) {
  if (name && ADULT_SERVICE_PATTERN.test(fold(name))) return true;
  const contactText = contactFields.filter(Boolean).join(" ");
  return contactText ? ADULT_SERVICE_PATTERN.test(fold(contactText)) : false;
}

/**
 * Second, stricter gate: read the business's OWN website and look for markers there.
 *
 * Needed because the name/domain gate above is blind to a clean-named business that
 * advertises the services openly on its site — the 2026-08-28 UAE pull had six
 * ("Kerala Spa Sharjah", "Corniche Spa Ajman", …) whose names and domains are
 * unremarkable but whose service menus are not.
 *
 * The pattern here is DELIBERATELY NARROWER than ADULT_SERVICE_PATTERN, because page
 * body text is a far noisier haystack than a name or a domain. Two terms had to be
 * dropped after they produced only false positives across 88 real UAE sites:
 *   - "four hand" / "four-hand" — a legitimate two-therapist modality. It matched 25
 *     sites including Jumeirah's Talise Ottoman Spa and Alba Spa at Royal Rose Hotel.
 *   - "b2b" — in body copy this is business-to-business (corporate/hotel bookings),
 *     not the euphemism it reliably is inside a business NAME.
 * Every term kept below has no legitimate therapeutic meaning in a spa's own copy.
 */
const SITE_ADULT_PATTERN = /nuru|body[\s-]?to[\s-]?body|body\s*2\s*body|happy[\s-]?ending|happy\s*finish|sensual|erotic|escort|incall|outcall|\btantric?\b/i;

/**
 * Fetch `website` and report the adult-service markers found in its visible text.
 * Returns [] for a site that is clean, unreachable, or not HTML — an unreachable
 * site must not disqualify a business, so failure is treated as "no evidence".
 */
export async function scanSiteForAdultMarkers(website, { timeoutMs = 12000 } = {}) {
  if (!website) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(website, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; QuietHourBot/1.0; +https://thaimassageforu.com)", accept: "text/html" },
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const text = (await response.text())
      .slice(0, 300_000)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    const hits = text.match(new RegExp(SITE_ADULT_PATTERN.source, "gi")) ?? [];
    return [...new Set(hits.map(hit => hit.toLowerCase()))];
  } catch {
    return [];
  }
}
