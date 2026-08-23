# Modern Directory Research Notes

## Product patterns to adapt—not copy

Fresha’s customer-facing experience starts with location-led self-care discovery, foregrounds categories, and uses city/category landing pages to make a large inventory navigable. Its business product combines listings with operational tools such as booking, payment, client management, and marketing.[1] Booksy makes individual business profiles feel like digital storefronts by combining discovery, portfolio-led trust, service details, availability, and online booking.[2] ClassPass demonstrates the value of a concise multi-category proposition across fitness, wellness, and beauty.[3]

Quiet Hour will not imitate any product’s visuals, language, or UI. The design will adapt only the useful interaction principles: fast location-first exploration, transparent listing value, concise service cards, rich independent-profile pages, clear calls to book or enquire, and a partner experience that makes a premium upgrade intelligible.

## Design implications

The directory will be city-first rather than a generic global search portal. The landing page will introduce the platform as a considered guide to calm, credible wellness experiences in a selected city. A distinctive editorial layer—mindfulness, massage, and circulation guides—will sit alongside the service discovery layer so the brand creates context rather than simply listing businesses.

The premium city listing will be presented as a clear, paid visibility option at **US$21 per week**. Its controlled ribbon will show a static arrangement when there are one to three premium listings, then enable a slow, non-distracting continuous movement only when there are four or more. This avoids the appearance of false activity in the platform’s early growth stage.

## CMS and communications implications

The CMS requires separate entities for City, Category, Listing, Practitioner, Service, Editorial Article, Inquiry, Message Template, and Premium Listing Subscription. A business owner needs an editable profile, service menu, image portfolio, contact/booking destination, and visibility status. An administrator needs a publishing and review workflow, listing placement controls, editorial management, and templated introduction communications with consent status.

## Communications decision

The CMS will treat introductory messages as **marketing outreach**, separate from functional booking or payment messages. Every prospect record will hold a consent source, consent timestamp, message-topic permissions, and unsubscribe status. The message template manager will support a human review state, but no individual message will be sent from the prototype. A future live SMS integration must only send to consented recipients, clearly identify Quiet Hour, preserve consent evidence, and include simple opt-out instructions; these are baseline requirements described in Twilio’s Messaging Policy.[4] For email, the system will distinguish functional messages from relationship-building messages and include unsubscribe controls for marketing-oriented templates; Resend documents one-click unsubscribe handling for bulk mail and recommends a clear opt-out option for nurturing content.[5] [6]

The project has no enabled SMS provider and no enabled transactional-email provider. The CMS interface will therefore be built with a provider-agnostic outbox and approval workflow. A sending integration can be activated only once the user chooses and connects a compliant provider such as Twilio for SMS and Resend for email.

## International content and search expansion

Quiet Hour will use explicit, stable locale URLs such as `/en-au/sydney/` and `/th-th/bangkok/`, instead of changing page language by cookie, browser setting, or IP address. Google recommends distinct URLs for language variants, visible page content in one clear language, user-selectable language alternatives, and explicit locale annotations or sitemap entries.[7] Each native-language page will be linked to its valid alternates, including itself, with an `x-default` country and language selector where appropriate.[8]

SERP information will shape research briefs rather than be scraped or republished. A country or city page will be created only after a human-reviewed brief includes local terminology, a genuine treatment/category intent, useful local discovery information, and appropriate language review. This avoids boilerplate translation at scale; Google identifies large numbers of translated or automatically transformed pages with little added value as scaled-content abuse.[9]

| Workflow stage | Human or system role | Publication status |
| --- | --- | --- |
| Country and city opportunity | SERP data records locale, intent cluster, and directory gap | Research only |
| Native content brief | Cloudflare Workers AI may structure terms and compare approved wording | Requires editor review |
| Locale draft | AI creates a clearly labelled draft from the approved brief | Requires native-language review |
| Search and editorial QA | CMS verifies meaningful content, locale alternatives, canonical path, and schema data | Eligible for publication |

## Mailbox decision

For a real mailbox at `hello@thaimassageforu.com`, Purelymail advertises a US$10/year simple plan with no hard limits on users, domains, or storage, and supports custom-domain DNS setup.[10] Zoho Mail has a more polished business mailbox experience and may offer a no-cost custom-domain plan for up to five users in select data centres, but its free tier excludes IMAP, POP, and ActiveSync.[11] For the lowest-cost launch, Purelymail is a viable mailbox choice; Resend remains the separate transactional-sending choice for the CMS outbox.[12]

## References

[1]: https://www.fresha.com/ "Fresha marketplace"
[2]: https://biz.booksy.com/features/marketplace "Booksy Marketplace"
[3]: https://classpass.com/ "ClassPass"
[4]: https://www.twilio.com/en-us/legal/messaging-policy "Twilio Messaging Policy"
[5]: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails "Resend: Add an unsubscribe link to transactional emails"
[6]: https://resend.com/docs/knowledge-base/should-i-add-an-unsubscribe-link "Resend: Do you need to add an unsubscribe link?"
[7]: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites "Google Search Central: Managing multi-regional and multilingual sites"
[8]: https://developers.google.com/search/docs/specialty/international/localized-versions "Google Search Central: Localized versions of pages"
[9]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central: Spam policies"
[10]: https://purelymail.com/pricing "Purelymail pricing"
[11]: https://www.zoho.com/mail/zohomail-pricing.html "Zoho Mail pricing"
[12]: https://resend.com/pricing "Resend pricing"
