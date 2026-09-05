/**
 * Minimal, deliberately small locale layer — not a full i18n framework. Covers exactly the
 * user-facing strings that matter for a German visitor deciding whether to pay or claim a
 * listing (the premium checkout box and the claim-listing box on client/src/pages/
 * ListingDetail.tsx, plus the claim CTA on CountryGuide.tsx), keyed off the listing/city's own
 * country_code — the same field already used for the site's city-blurb personalization in
 * worker/campaigns.ts. Adding a real i18n library is not worth it for two languages and a
 * handful of strings; this is worth it because a German business owner deciding whether to trust
 * a payment form reads far more carefully than someone browsing listings, and every one of these
 * strings sits directly in front of that decision.
 */
export type Lang = "en" | "de";

export function langForCountry(countryCode: string | null | undefined): Lang {
  return countryCode?.toLowerCase() === "de" ? "de" : "en";
}

export const STRINGS = {
  en: {
    premiumBox: {
      eyebrow: "Premium placement",
      headline: "Get this listing seen first.",
      subhead: "No account needed — pay once and it's live.",
      redirecting: "Redirecting…",
      note: "Cancel anytime. Billed securely by Stripe.",
      checkoutError: "Couldn't start checkout — please try again.",
      tierLabels: { city: "Premium city listing", country: "Premium country listing" },
    },
    claimBox: {
      eyebrow: "Own this place?",
      headline: "Claim this listing.",
      startIntro: "We'll text or email a one-time code to the contact details already on file.",
      emailButton: "Email me a code",
      smsButton: "Text me a code",
      codeIntro: (address: string) => `Enter the code sent to ${address}.`,
      codePlaceholder: "6-digit code",
      verifying: "Verifying…",
      verifyButton: "Verify & claim",
      note: "One listing per code. No password to remember.",
      sendError: "Couldn't send a code — please try again.",
      sendSuccess: (channel: "email" | "sms") => `Code sent — check ${channel === "email" ? "your email" : "your phone"}.`,
      verifyError: "That code didn't work — please try again.",
      verifySuccess: "Listing claimed — you're logged in.",
      genericError: "Something went wrong — please try again.",
    },
    claimCta: {
      headline: "See your business here?",
      bodyCountry: (country: string) => `Claim your listing in ${country} to keep it up to date — no account to set up, just a one-time code to the contact details already on file.`,
      button: "Claim your listing",
    },
  },
  de: {
    premiumBox: {
      eyebrow: "Premium-Platzierung",
      headline: "Damit dieser Eintrag zuerst gesehen wird.",
      subhead: "Kein Konto nötig — einmal zahlen, sofort live.",
      redirecting: "Weiterleitung …",
      note: "Jederzeit kündbar. Sichere Zahlungsabwicklung über Stripe.",
      checkoutError: "Der Bezahlvorgang konnte nicht gestartet werden — bitte versuchen Sie es erneut.",
      tierLabels: { city: "Premium-Eintrag für eine Stadt", country: "Premium-Eintrag für ein ganzes Land" },
    },
    claimBox: {
      eyebrow: "Gehört Ihnen dieser Betrieb?",
      headline: "Diesen Eintrag beanspruchen.",
      startIntro: "Wir senden Ihnen einen einmaligen Code per SMS oder E-Mail an die hinterlegten Kontaktdaten.",
      emailButton: "Code per E-Mail senden",
      smsButton: "Code per SMS senden",
      codeIntro: (address: string) => `Geben Sie den Code ein, den wir an ${address} gesendet haben.`,
      codePlaceholder: "6-stelliger Code",
      verifying: "Wird geprüft …",
      verifyButton: "Bestätigen und übernehmen",
      note: "Ein Code pro Eintrag. Kein Passwort nötig.",
      sendError: "Der Code konnte nicht gesendet werden — bitte versuchen Sie es erneut.",
      sendSuccess: (channel: "email" | "sms") => `Code gesendet — bitte prüfen Sie ${channel === "email" ? "Ihr E-Mail-Postfach" : "Ihr Telefon"}.`,
      verifyError: "Dieser Code war leider ungültig — bitte versuchen Sie es erneut.",
      verifySuccess: "Eintrag übernommen — Sie sind jetzt angemeldet.",
      genericError: "Es ist ein Fehler aufgetreten — bitte versuchen Sie es erneut.",
    },
    claimCta: {
      headline: "Ihr Betrieb noch nicht dabei?",
      bodyCountry: (country: string) => `Beanspruchen Sie Ihren Eintrag in ${country}, um ihn aktuell zu halten — kein Konto nötig, nur ein einmaliger Code an die bereits hinterlegten Kontaktdaten.`,
      button: "Eintrag beanspruchen",
    },
  },
} as const;
