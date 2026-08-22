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
});
