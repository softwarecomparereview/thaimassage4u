import { env, SELF } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import { parseOsmNames, wikiIntroFromMarkdown } from "../src/scrape";
import { cityThemeKeys, resolveTheme } from "../src/lib/themes";

describe("directory SEO app", () => {
  beforeAll(async () => {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO countries (code, name, slug, locale, currency, flag, tagline, intro, monthly_searches)
       VALUES ('de', 'Germany', 'de', 'de-DE', 'EUR', 'DE', 'Berlin demand', 'Germany wins on keyword volume.', 74000)`
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO cities (country_code, slug, name, region, intro, monthly_searches)
       VALUES ('de', 'berlin', 'Berlin', 'Berlin', 'Berlin Thai massage keywords exceed 43k monthly searches.', 43100)`
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO listings (slug, name, country_code, city_slug, services, description, premium, claimed, source)
       VALUES ('lotus-river-berlin', 'Lotus River Thai Massage', 'de', 'berlin', 'Traditional Thai', 'Unclaimed Berlin listing.', 1, 0, 'seed')`
    ).run();
  });

  it("renders an SEO homepage with country folders", async () => {
    const response = await SELF.fetch("https://thaimassageforu.com/");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Thai massage in the USA, UK, Australia and Germany");
    expect(text).toContain('rel="canonical"');
    expect(text).toContain("application/ld+json");
    expect(text).toContain("/de");
  });

  it("geo-routes visitors to their country hub", async () => {
    const au = await SELF.fetch("https://thaimassageforu.com/", {
      redirect: "manual",
      headers: { "CF-IPCountry": "AU" },
    });
    expect(au.status).toBe(302);
    expect(au.headers.get("location")).toBe("/au");

    const gb = await SELF.fetch("https://thaimassageforu.com/", {
      redirect: "manual",
      headers: { "CF-IPCountry": "GB" },
    });
    expect(gb.status).toBe(302);
    expect(gb.headers.get("location")).toBe("/uk");

    const us = await SELF.fetch("https://thaimassageforu.com/", {
      redirect: "manual",
      headers: { "CF-IPCountry": "US" },
    });
    expect(us.status).toBe(302);
    expect(us.headers.get("location")).toBe("/us");

    const de = await SELF.fetch("https://thaimassageforu.com/", {
      redirect: "manual",
      headers: { "CF-IPCountry": "DE" },
    });
    expect(de.status).toBe(302);
    expect(de.headers.get("location")).toBe("/de");

    const bot = await SELF.fetch("https://thaimassageforu.com/", {
      redirect: "manual",
      headers: { "CF-IPCountry": "AU", "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    expect(bot.status).toBe(200);

    const intl = await SELF.fetch("https://thaimassageforu.com/?intl=1", {
      redirect: "manual",
      headers: { "CF-IPCountry": "AU" },
    });
    expect(intl.status).toBe(200);
  });

  it("lets visitors browse another country after they switch", async () => {
    const germany = await SELF.fetch("https://thaimassageforu.com/de", {
      redirect: "manual",
      headers: { "CF-IPCountry": "AU" },
    });
    expect(germany.status).toBe(200);
    const text = await germany.text();
    expect(text).toContain("theme-de");
    expect(text).not.toContain("theme-de-berlin");
    expect(germany.headers.get("set-cookie") ?? "").toContain("tmfu_country=de");

    const home = await SELF.fetch("https://thaimassageforu.com/", {
      redirect: "manual",
      headers: {
        "CF-IPCountry": "AU",
        cookie: "tmfu_country=uk",
      },
    });
    expect(home.status).toBe(302);
    expect(home.headers.get("location")).toBe("/uk");
  });

  it("renders a unique Berlin city lander", async () => {
    const response = await SELF.fetch("https://thaimassageforu.com/de/berlin");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("<h1>Thai massage in Berlin, Germany</h1>");
    expect(text).toContain("Lotus River Thai Massage");
    expect(text).toContain("Top studios in Berlin");
  });

  it("stacks a country look-and-feel layer under a city overlay", async () => {
    const countryOnly = resolveTheme("de");
    expect(countryOnly.className).toBe("theme-base theme-de");
    expect(countryOnly.city).toBeNull();
    const stacked = resolveTheme("de", "berlin");
    expect(stacked.className).toBe("theme-base theme-de theme-de-berlin");
    expect(stacked.country?.label).toBe("Germany");
    expect(stacked.city?.label).toBe("Berlin");
    expect(cityThemeKeys()).toContain("uk-manchester");
    expect(cityThemeKeys()).toContain("us-los-angeles");

    const germany = await SELF.fetch("https://thaimassageforu.com/de");
    const germanyHtml = await germany.text();
    expect(germanyHtml).toContain('class="theme-base theme-de"');
    expect(germanyHtml).toContain("Thai-Massage in Deutschland");
    expect(germanyHtml).toContain("Choose a city below to open its origin story");
    expect(germanyHtml).toContain("/images/cities/de.jpg");
    expect(germanyHtml).toContain("Why Germany is the fourth country");
    expect(germanyHtml).not.toContain("theme-de-berlin");
    expect(germanyHtml).toContain("Featured in Germany");
    expect(germanyHtml).toContain("featured-hero");

    const berlin = await SELF.fetch("https://thaimassageforu.com/de/berlin");
    const berlinHtml = await berlin.text();
    expect(berlinHtml).toContain("theme-de");
    expect(berlinHtml).toContain("theme-de-berlin");
    expect(berlinHtml).toContain("Kiez by Kiez");
    expect(berlinHtml).toContain("/themes.css");
    expect(berlinHtml).toContain("/images/cities/de-berlin.jpg");
    expect(berlinHtml).toContain("A marsh town that became Europe");
    expect(berlinHtml).toContain("/images/spa/");
    expect(berlinHtml).not.toContain("/images/room.svg");
  });

  it("protects admin and lets a password create a listing", async () => {
    const locked = await SELF.fetch("https://thaimassageforu.com/admin", { redirect: "manual" });
    expect(locked.status).toBe(302);
    expect(locked.headers.get("location")).toBe("/admin/login");

    const denied = await SELF.fetch("https://thaimassageforu.com/admin/login", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "wrong" }),
    });
    expect(denied.status).toBe(303);
    expect(denied.headers.get("location")).toBe("/admin/login?err=1");

    const login = await SELF.fetch("https://thaimassageforu.com/admin/login", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "test-admin" }),
    });
    expect(login.status).toBe(303);
    const cookie = login.headers.get("set-cookie");
    expect(cookie).toContain("tmfu_admin=");
    const session = cookie?.split(";")[0] ?? "";

    const created = await SELF.fetch("https://thaimassageforu.com/admin/listings", {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: session,
      },
      body: new URLSearchParams({
        name: "Prenzlauer Berg Sala",
        slug: "prenzlauer-berg-sala",
        country_code: "de",
        city_slug: "berlin",
        services: "Traditional Thai, Oil",
        description: "Admin-created Berlin studio.",
      }),
    });
    expect(created.status).toBe(303);
    const row = await env.DB.prepare("SELECT name FROM listings WHERE slug = ?")
      .bind("prenzlauer-berg-sala")
      .first<{ name: string }>();
    expect(row?.name).toBe("Prenzlauer Berg Sala");
  });

  it("stores a for-sale offer in D1", async () => {
    const response = await SELF.fetch("https://thaimassageforu.com/api/offers", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: "Sam Buyer",
        email: "sam@example.com",
        message: "I would like to buy the directory and keep the city pages.",
        currency: "USD",
        offer_amount: "20000",
        consent: "yes",
      }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/for-sale?sent=1");
    const row = await env.DB.prepare("SELECT email FROM sale_offers WHERE email = ?").bind("sam@example.com").first();
    expect(row?.email).toBe("sam@example.com");
  });

  it("301s legacy Melbourne URLs into the AU folder", async () => {
    const response = await SELF.fetch("https://thaimassageforu.com/thai-massage-melbourne.html", {
      redirect: "manual",
    });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/au/melbourne");
  });

  it("exposes a sitemap of directory URLs", async () => {
    const response = await SELF.fetch("https://thaimassageforu.com/sitemap.xml");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("/de/berlin");
    expect(text).toContain("/for-sale");
  });

  it("parses Browser Run OSM scrape payloads", () => {
    const names = parseOsmNames({
      success: true,
      result: [
        {
          selector: ".name",
          results: [{ text: "Siam Thai Massage" }, { text: "OpenStreetMap" }, { text: "Cafe" }],
        },
      ],
    });
    expect(names).toEqual(["Siam Thai Massage"]);
  });

  it("builds a wiki intro from markdown", () => {
    const intro = wikiIntroFromMarkdown(
      "Berlin is the capital and largest city of Germany, with a long spa and wellness tradition that includes neighbourhood Thai massage studios across Mitte and Prenzlauer Berg.",
      "Berlin"
    );
    expect(intro).toContain("Berlin");
  });

  it("publishes original Thai massage benefit articles", async () => {
    const index = await SELF.fetch("https://thaimassageforu.com/blog");
    const indexHtml = await index.text();
    expect(index.status).toBe(200);
    expect(indexHtml).toContain("The real benefits of traditional Thai massage");
    expect(indexHtml).toContain("/blog/benefits-of-traditional-thai-massage");

    const article = await SELF.fetch("https://thaimassageforu.com/blog/benefits-of-traditional-thai-massage");
    const html = await article.text();
    expect(article.status).toBe(200);
    expect(html).toContain("Why the stretching is the point");
    expect(html).toContain("Traditional Thai massage is not a quieter version");
    expect(html).toContain("/images/spa/");

    const sitemap = await SELF.fetch("https://thaimassageforu.com/sitemap.xml");
    expect(await sitemap.text()).toContain("/blog/from-wat-pho-to-berlin-and-melbourne");
  });

  it("keeps a stable spa photo for listings without a real image", async () => {
    const { listingPhoto, isPlaceholderImage } = await import("../src/lib/photos");
    const first = listingPhoto({ slug: "lotus-river-berlin", image_url: null });
    const again = listingPhoto({ slug: "lotus-river-berlin", image_url: "/images/room.svg" });
    expect(first).toMatch(/^\/images\/spa\/spa-\d+\.jpg$/);
    expect(again).toBe(first);
    expect(isPlaceholderImage("/images/room.svg")).toBe(true);
    expect(listingPhoto({ slug: "claimed", image_url: "/media/listings/claimed.jpg" })).toBe("/media/listings/claimed.jpg");
  });

  it("scores studios and points to country-specific review sites", async () => {
    const { decideListing, countryReferralSites, countryReviewGuide } = await import("../src/lib/decide");
    const base = {
      id: 1,
      slug: "siam-house",
      name: "Siam House",
      country_code: "us",
      city_slug: "new-york",
      suburb: "Midtown",
      address: "12 W 46th St",
      phone: "+12125550100",
      email: "hello@example.com",
      website: "https://example.com",
      services: "Traditional Thai, Oil, Foot",
      description: "A claimed Midtown room.",
      price_from: 80,
      currency: "USD",
      premium: 1,
      claimed: 1,
      hours: "10:00-20:00",
      image_url: null,
      source: "seed",
      source_url: null,
      rating: 4.7,
      review_count: 88,
    };
    const strong = decideListing(base, "New York");
    expect(strong.verdict).toBe("strong");
    expect(strong.score).toBeGreaterThanOrEqual(68);
    expect(strong.label).toBe("Strong first pick");
    expect(strong.summary).toContain("do not keep a private copy of Google");

    const thin = decideListing(
      { ...base, claimed: 0, phone: null, address: null, hours: null, website: null, premium: 0, rating: null, review_count: null, services: "Traditional Thai" },
      "New York"
    );
    expect(thin.verdict).toBe("confirm");
    expect(thin.label).toBe("Confirm before you go");

    const yelpBoost = decideListing(
      { ...base, claimed: 0, phone: "+12125550100", address: "12 W 46th St", hours: null, website: null, premium: 0, rating: null, review_count: null, services: "Traditional Thai" },
      "New York",
      { yelp: { name: "Siam House", rating: 4.6, reviewCount: 120, url: "https://www.yelp.com/biz/siam-house" } }
    );
    expect(yelpBoost.referrals[0]?.name).toBe("Yelp");
    expect(yelpBoost.referrals[0]?.href).toContain("yelp.com/biz/siam-house");
    expect(yelpBoost.checks.some((item) => item.includes("Yelp"))).toBe(true);

    expect(countryReferralSites("us", base, "New York").map((site) => site.name)).toContain("Yelp");
    expect(countryReferralSites("uk", { name: "Siam House" }, "London").map((site) => site.name)).toContain("Trustpilot");
    expect(countryReferralSites("au", { name: "Siam House" }, "Melbourne").map((site) => site.name)).toContain("ProductReview");
    expect(countryReferralSites("de", { name: "Siam House" }, "Berlin").map((site) => site.name)).toContain("ProvenExpert");
    expect(countryReviewGuide("au").intro).toContain("ProductReview");
  });

  it("helps a visitor decide on a listing without copying Google review text", async () => {
    const page = await SELF.fetch("https://thaimassageforu.com/de/berlin/lotus-river-berlin");
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("decide-card");
    expect(html).toContain("How to decide");
    expect(html).toContain("ProvenExpert");
    expect(html).toContain("Trustpilot");
    expect(html).toContain("do not keep a private copy of Google");
    expect(html).not.toContain("Google reviews");
    expect(html).not.toContain("login_secret");

    const city = await SELF.fetch("https://thaimassageforu.com/de/berlin");
    const cityHtml = await city.text();
    expect(cityHtml).toContain("pick-guide");
    expect(cityHtml).toContain("ProvenExpert");
    expect(cityHtml).toContain("Confirm before you go");

    const faq = await SELF.fetch("https://thaimassageforu.com/faq");
    expect(await faq.text()).toContain("How should I pick a studio?");
  });

  it("keeps affiliate passwords in admin only and never auto-registers partners", async () => {
    const locked = await SELF.fetch("https://thaimassageforu.com/admin/affiliates", { redirect: "manual" });
    expect(locked.status).toBe(302);

    const login = await SELF.fetch("https://thaimassageforu.com/admin/login", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "test-admin" }),
    });
    const session = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(session).toContain("tmfu_admin=");

    const kit = await SELF.fetch("https://thaimassageforu.com/admin/affiliates", { headers: { cookie: session } });
    expect(kit.status).toBe(200);
    const kitHtml = await kit.text();
    expect(kitHtml).toContain("noindex");
    expect(kitHtml).toContain("Trustpilot");
    expect(kitHtml).toContain("ProductReview");
    expect(kitHtml).toContain("ProvenExpert");
    expect(kitHtml).toContain("never creates accounts on other companies");
    expect(kitHtml).toContain("https://business.trustpilot.com/signup");

    const saved = await SELF.fetch("https://thaimassageforu.com/admin/affiliates/defaults", {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: session,
      },
      body: new URLSearchParams({
        company_name: "Thai Massage For U",
        contact_email: "hello@thaimassageforu.com",
        login_email: "partners@thaimassageforu.com",
        login_secret: "kit-pass-9f3a",
        website: "https://thaimassageforu.com",
        notes: "Preferred partner password",
      }),
    });
    expect(saved.status).toBe(303);

    const ready = await SELF.fetch("https://thaimassageforu.com/admin/affiliates", { headers: { cookie: session } });
    const readyHtml = await ready.text();
    expect(readyHtml).toContain("kit-pass-9f3a");
    expect(readyHtml).toContain("partners@thaimassageforu.com");
    expect(readyHtml).toContain(">saved<");

    const publicPage = await SELF.fetch("https://thaimassageforu.com/de/berlin/lotus-river-berlin");
    const publicHtml = await publicPage.text();
    expect(publicHtml).not.toContain("kit-pass-9f3a");
    expect(publicHtml).not.toContain("partners@thaimassageforu.com");
    expect(publicHtml).not.toContain("/admin/affiliates");
  });

  it("puts Haruka, NOIR 33, then Betty first in Australia as rooms the editor knows", async () => {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO countries (code, name, slug, locale, currency, flag, tagline, intro, monthly_searches)
       VALUES ('au', 'Australia', 'au', 'en-AU', 'AUD', 'AU', 'Home market', 'Australia remains the origin market.', 22000)`
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO cities (country_code, slug, name, region, intro, monthly_searches)
       VALUES ('au', 'melbourne', 'Melbourne', 'VIC', 'Melbourne is the original market.', 7200)`
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO listings (slug, name, country_code, city_slug, suburb, address, phone, services, description, currency, premium, claimed, hours, image_url, source)
       VALUES ('haruka-japanese-massage', 'Haruka Japanese Massage', 'au', 'melbourne', 'Melbourne CBD', '413/365 Little Collins St, Melbourne VIC 3000', '+61 468 480 365', 'Japanese massage', 'The Japanese room on Little Collins I send people to.', 'AUD', 2, 1, 'From 11:00', '/images/partners/haruka.jpg', 'editor')`
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, currency, premium, claimed, hours, image_url, source)
       VALUES ('noir-33-south-yarra', 'NOIR 33 Massage & Spa', 'au', 'melbourne', 'South Yarra', '10/209 Toorak Rd, South Yarra VIC 3141', '+61 481 333 209', 'bookings@noir33.com.au', 'https://noir33.com.au', 'Private lounge', 'South Yarra, not the CBD.', 'AUD', 2, 1, 'Closes 20:00', '/images/partners/noir33.jpg', 'editor')`
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO listings (slug, name, country_code, city_slug, suburb, address, phone, services, description, currency, premium, claimed, hours, image_url, source)
       VALUES ('betty-werribee', 'Betty — independent masseuse', 'au', 'melbourne', 'Werribee', 'Werribee, western suburbs, Melbourne VIC', '+61 478 898 557', 'Independent massage, Personal massage, Relaxation', 'The independent masseuse I name in the west.', 'AUD', 2, 1, 'Call to book', '/images/partners/betty.jpg', 'editor')`
    ).run();

    const australia = await SELF.fetch("https://thaimassageforu.com/au");
    expect(australia.status).toBe(200);
    const html = await australia.text();
    expect(html).toContain("Three Melbourne rooms I actually know");
    expect(html).toContain("Haruka Japanese Massage");
    expect(html).toContain("NOIR 33 Massage &amp; Spa");
    expect(html).toContain("Betty — independent masseuse");
    expect(html.indexOf("Haruka Japanese Massage")).toBeLessThan(html.indexOf("NOIR 33 Massage"));
    expect(html.indexOf("NOIR 33 Massage")).toBeLessThan(html.indexOf("Betty — independent masseuse"));
    expect(html).toContain("Why we love them · 01");
    expect(html).toContain("Why we love them · 02");
    expect(html).toContain("Why we love them · 03");
    expect(html).toContain("+61 468 480 365");
    expect(html).toContain("+61 478 898 557");
    expect(html).toContain("Werribee");
    expect(html).not.toContain("What a personal masseuse should be");
    expect(html).not.toContain("One client at a time");
    expect(html).not.toContain("A room I send people to");
    expect(html).not.toContain("A room I know ·");
    expect(html).toContain("known-hero");
    expect(html.toLowerCase()).not.toContain("paid");
    expect(html).not.toContain("Sponsored");

    const haruka = await SELF.fetch("https://thaimassageforu.com/au/melbourne/haruka-japanese-massage");
    const harukaHtml = await haruka.text();
    expect(haruka.status).toBe(200);
    expect(harukaHtml).toContain("Haruka Japanese Massage in Melbourne");
    expect(harukaHtml).toContain("Written from sitting in the room");
    expect(harukaHtml).toContain("Reviews from visits");
    expect(harukaHtml).toContain("The neck work is why I keep going back");
    expect(harukaHtml).toContain("Japanese pressure");
    expect(harukaHtml).not.toContain("Featured on this directory.");
    expect(harukaHtml).not.toContain("What looks solid");
    expect(harukaHtml.toLowerCase()).not.toContain("paid");
    expect(harukaHtml).not.toContain("Premium listing");

    const noir = await SELF.fetch("https://thaimassageforu.com/au/melbourne/noir-33-south-yarra");
    const noirHtml = await noir.text();
    expect(noir.status).toBe(200);
    expect(noirHtml).toContain("The city goes quiet once you are inside");
    expect(noirHtml).toContain("Toorak Road");
    expect(noirHtml).not.toContain("Featured on this directory.");

    const betty = await SELF.fetch("https://thaimassageforu.com/au/melbourne/betty-werribee");
    const bettyHtml = await betty.text();
    expect(betty.status).toBe(200);
    expect(bettyHtml).toContain("Betty — independent masseuse in Melbourne");
    expect(bettyHtml).toContain("Highly skilled, qualified");
    expect(bettyHtml).toContain("amazing service");
    expect(bettyHtml).toContain("What a personal masseuse should be");
    expect(bettyHtml).toContain("One client at a time");
    expect(bettyHtml).toContain("+61 478 898 557");
    expect(bettyHtml).toContain("Werribee");
    expect(bettyHtml).toContain("Reviews from visits");
    expect(bettyHtml).not.toContain("Featured on this directory.");
    expect(bettyHtml).not.toContain("Advertise here");
    expect(bettyHtml.toLowerCase()).not.toContain("paid");
    expect(bettyHtml).not.toContain("Sponsored");
  });
});
