import type { Listing } from "./db";
import { knownRoom } from "./known-reviews";

export type ReferralSite = {
  name: string;
  why: string;
  href: string;
};

export type Decision = {
  score: number;
  verdict: "strong" | "call" | "confirm";
  label: string;
  summary: string;
  checks: string[];
  gaps: string[];
  referrals: ReferralSite[];
};

function hasText(value?: string | null): boolean {
  return Boolean(value && value.trim() && !/unconfirmed|pending|after the owner|after claim/i.test(value));
}

export function searchHref(base: string, query: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

export type ReviewGuide = {
  title: string;
  intro: string;
  sites: Array<{ name: string; why: string }>;
};

export function countryReviewGuide(countryCode: string): ReviewGuide {
  if (countryCode === "us") {
    return {
      title: "Where Americans actually read a spa",
      intro: "Yelp is the neighbourhood habit. The Better Business Bureau is for complaints. Treatwell and Fresha show whether a room still takes walk-ins. We do not copy Google’s review text into our own database.",
      sites: [
        { name: "Yelp", why: "The usual US neighbourhood read on a walk-in spa." },
        { name: "Better Business Bureau", why: "Complaints and whether the business answers them." },
        { name: "Treatwell / Fresha", why: "Live diaries for rooms that take bookings." },
      ],
    };
  }
  if (countryCode === "uk") {
    return {
      title: "Where Britain checks a high-street room",
      intro: "Trustpilot is still the first tab. Treatwell shows hours and last-minute slots. Reviews.io appears when a studio collects verified notes. We point you there instead of storing Google’s words.",
      sites: [
        { name: "Trustpilot", why: "UK readers still check this before they book." },
        { name: "Treatwell", why: "Britain’s spa booking layer — hours and last-minute slots." },
        { name: "Reviews.io", why: "Verified-purchase style notes when a studio collects them." },
      ],
    };
  }
  if (countryCode === "au") {
    return {
      title: "Where Australia reads a studio first",
      intro: "ProductReview is the local habit. True Local still carries phone numbers a map pin can hide. Word of Mouth threads help in Melbourne and Sydney. Ratings here are public signals, not a private copy of Google.",
      sites: [
        { name: "ProductReview", why: "The Australian habit: read this before you walk in." },
        { name: "True Local", why: "Local directories still carry phone numbers the map sometimes hides." },
        { name: "Word of Mouth", why: "Neighbourhood threads, especially in Melbourne and Sydney." },
      ],
    };
  }
  return {
    title: "Where Germany actually reads a spa room",
    intro: "ProvenExpert is the German-language read for Körperarbeit. Trustpilot sits next to it for English notes. Treatwell shows whether the room is still taking appointments. We send you there rather than keeping Google’s review corpus.",
    sites: [
      { name: "ProvenExpert", why: "German readers look here for Körperarbeit and spa rooms." },
      { name: "Trustpilot", why: "DE and EU reviews in one place, next to the German-language ones." },
      { name: "Treatwell", why: "Booking and last-minute hours for Thai-Massage studios." },
    ],
  };
}

export function cityLabel(slug: string): string {
  return slug.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function countryReferralSites(countryCode: string, listing: Pick<Listing, "name">, cityName: string): ReferralSite[] {
  const q = `${listing.name} ${cityName}`;
  const loc = `${cityName}`;
  const common: ReferralSite[] = [
    {
      name: "Treatwell / Fresha",
      why: "Live booking diaries for many Thai rooms in this country.",
      href: searchHref("https://www.treatwell.com/search/", { query: q }),
    },
  ];
  if (countryCode === "us") {
    return [
      {
        name: "Yelp",
        why: "The usual US neighbourhood read on a walk-in spa.",
        href: searchHref("https://www.yelp.com/search", { find_desc: listing.name, find_loc: loc }),
      },
      {
        name: "Better Business Bureau",
        why: "Complaints and whether the business answers them.",
        href: searchHref("https://www.bbb.org/search", { find_text: q }),
      },
      ...common,
    ];
  }
  if (countryCode === "uk") {
    return [
      {
        name: "Trustpilot",
        why: "UK readers still check this before they book a high-street room.",
        href: searchHref("https://www.trustpilot.com/search", { query: q }),
      },
      {
        name: "Treatwell",
        why: "Britain’s spa booking layer — hours and last-minute slots.",
        href: searchHref("https://www.treatwell.co.uk/search/", { query: q }),
      },
      {
        name: "Reviews.io",
        why: "Verified-purchase style notes when a studio collects them.",
        href: searchHref("https://www.reviews.io/search", { query: q }),
      },
    ];
  }
  if (countryCode === "au") {
    return [
      {
        name: "ProductReview",
        why: "The Australian habit: read ProductReview before you walk in.",
        href: searchHref("https://www.productreview.com.au/search", { q }),
      },
      {
        name: "True Local",
        why: "Local directories still carry phone numbers the map sometimes hides.",
        href: searchHref("https://www.truelocal.com.au/search", { query: listing.name, location: loc }),
      },
      {
        name: "Word of Mouth",
        why: "Neighbourhood threads, especially in Melbourne and Sydney.",
        href: searchHref("https://www.google.com/search", { q: `${q} site:wom.com.au OR \"word of mouth\"` }),
      },
    ];
  }
  return [
    {
      name: "ProvenExpert",
      why: "German readers look here for Körperarbeit and spa rooms.",
      href: searchHref("https://www.provenexpert.com/en-us/search/", { q }),
    },
    {
      name: "Trustpilot",
      why: "DE and EU reviews in one place, next to the German-language ones.",
      href: searchHref("https://www.trustpilot.com/search", { query: q }),
    },
    {
      name: "Treatwell",
      why: "Booking and last-minute hours for Thai-Massage studios.",
      href: searchHref("https://www.treatwell.de/suche/", { query: q }),
    },
  ];
}

export function withPublicSignals(
  listing: Listing,
  extra?: { rating?: number | null; reviewCount?: number | null; sourceName?: string; sourceUrl?: string | null }
): Listing {
  if (listing.rating != null || extra?.rating == null) return listing;
  return {
    ...listing,
    rating: extra.rating,
    review_count: listing.review_count ?? extra.reviewCount ?? null,
  };
}

export function decideListing(
  listing: Listing,
  cityName: string,
  extra?: { yelp?: { name: string; rating: number | null; reviewCount: number | null; url: string | null } | null }
): Decision {
  const known = knownRoom(listing.slug);
  if (known) {
    return {
      score: 94,
      verdict: "strong",
      label: "Why we love them",
      summary: known.verdict,
      checks: known.noticed,
      gaps: [],
      referrals: countryReferralSites(listing.country_code, listing, cityName),
    };
  }
  const scored = withPublicSignals(listing, extra?.yelp ? { rating: extra.yelp.rating, reviewCount: extra.yelp.reviewCount } : undefined);
  const checks: string[] = [];
  const gaps: string[] = [];
  let score = 12;

  if (scored.premium >= 1) {
    score += 8;
    checks.push("Featured on this directory.");
  }
  if (scored.claimed) {
    score += 18;
    checks.push("The studio has claimed this page.");
  } else {
    gaps.push("The owner has not confirmed this page yet.");
  }
  if (hasText(scored.phone)) {
    score += 12;
    checks.push("A phone number is on the page — call before you travel.");
  } else {
    gaps.push("No phone listed. Use a review site or walk by in daylight first.");
  }
  if (hasText(scored.address)) {
    score += 10;
    checks.push("There is a street address.");
  } else {
    gaps.push("No street address yet.");
  }
  if (hasText(scored.hours)) {
    score += 8;
    checks.push("Hours are written down.");
  } else {
    gaps.push("Hours are not confirmed.");
  }
  if (hasText(scored.website)) {
    score += 7;
    checks.push("They have a website.");
  }
  if (scored.rating != null) {
    if (scored.rating >= 4.5) {
      score += 16;
      checks.push(`Public rating ${scored.rating.toFixed(1)} — a strong neighbourhood signal.`);
    } else if (scored.rating >= 4) {
      score += 11;
      checks.push(`Public rating ${scored.rating.toFixed(1)}.`);
    } else if (scored.rating >= 3.5) {
      score += 6;
      checks.push(`Public rating ${scored.rating.toFixed(1)} — read a second source.`);
    } else {
      gaps.push(`Public rating ${scored.rating.toFixed(1)} is mixed. Cross-check another site.`);
    }
  }
  if (scored.review_count != null) {
    if (scored.review_count >= 40) {
      score += 10;
      checks.push(`${scored.review_count} public reviews — enough volume to trust the average.`);
    } else if (scored.review_count >= 8) {
      score += 6;
      checks.push(`${scored.review_count} public reviews.`);
    } else if (scored.review_count > 0) {
      score += 3;
      checks.push("Only a handful of public reviews so far.");
    }
  }
  if (extra?.yelp?.url) {
    checks.push(`Yelp lists a matching business${extra.yelp.rating != null ? ` at ${extra.yelp.rating.toFixed(1)}★` : ""}.`);
  }
  const services = scored.services.split(",").map((item) => item.trim()).filter(Boolean);
  if (services.length >= 3) {
    score += 4;
    checks.push(`Offers ${services.slice(0, 3).join(", ").toLowerCase()}.`);
  }

  score = Math.max(5, Math.min(98, score));
  const verdict: Decision["verdict"] = score >= 68 ? "strong" : score >= 42 ? "call" : "confirm";
  const label = verdict === "strong" ? "Strong first pick" : verdict === "call" ? "Worth a call" : "Confirm before you go";

  const summary = [
    `${listing.name} in ${cityName} does ${services.slice(0, 2).join(" and ").toLowerCase() || "traditional Thai massage"}.`,
    verdict === "strong"
      ? "On what we can show here, this is a reasonable first booking — still open the local review sites below."
      : verdict === "call"
        ? "Enough to walk over if you are nearby; call or message before you make a special trip."
        : "Treat this as a name on a map until the studio confirms hours and a phone.",
    "We do not keep a private copy of Google’s review text. Ratings you see here are public signals, then we send you to Yelp, Trustpilot, ProductReview or ProvenExpert for the words people actually wrote.",
  ].join(" ");

  return {
    score,
    verdict,
    label,
    summary,
    checks,
    gaps,
    referrals: mergeYelpReferral(countryReferralSites(listing.country_code, listing, cityName), extra?.yelp),
  };
}

function mergeYelpReferral(
  referrals: ReferralSite[],
  yelp?: { name: string; rating: number | null; reviewCount: number | null; url: string | null } | null
): ReferralSite[] {
  if (!yelp?.url) return referrals;
  const rest = referrals.filter((site) => site.name !== "Yelp");
  return [
    {
      name: "Yelp",
      why: yelp.reviewCount
        ? `Official Yelp page · ${yelp.rating?.toFixed(1) ?? "rated"} from ${yelp.reviewCount} reviews.`
        : "Official Yelp page for this business name.",
      href: yelp.url,
    },
    ...rest,
  ];
}
