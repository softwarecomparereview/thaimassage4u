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
const ADULT_SERVICE_PATTERN = /tantra|erotic|escort|happy[\s-]?ending|happy\s*finish|sensual|nuru|body\s*2\s*body|\bb2b\b|incall|outcall|intimacy|intimate massage/i;

export function isAdultServiceMatch(name, ...contactFields) {
  if (name && ADULT_SERVICE_PATTERN.test(name)) return true;
  const contactText = contactFields.filter(Boolean).join(" ");
  return contactText ? ADULT_SERVICE_PATTERN.test(contactText) : false;
}
