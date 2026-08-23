# Cloudflare Workers AI Handoffs

Workers AI should support bounded research and editorial preparation, not make publishing, payment, consent, or safety decisions. Every AI result enters the Quiet Hour CMS in a reviewable state and only a human can move it to `published` or send it to a live delivery provider.

| Handoff | Input | Worker result | Mandatory CMS gate |
| --- | --- | --- | --- |
| Query clustering | Approved SERP exports with country and locale | Intent cluster, candidate page type, ambiguity flags | SEO editor validates the query set and page brief. |
| Translation preparation | Approved source copy and target locale | Draft translation plus literalness/terminology flags | Native-language reviewer approves or requests revision. |
| Translation QA | Source, translation, locale glossary | Missing-content, untranslated-string, and terminology checks | Reviewer resolves every warning before publication. |
| City-signal triage | Source URL, event title, date, city | Duplicate and date-validity warnings | City editor verifies source, date, and local relevance. |

The Worker must reject requests containing payment data, private contact details, raw secrets, or claims requiring medical diagnosis. It must return structured output with a `draft` state and source references. The CMS is the system of record for the human review decision.
