import { env, SELF } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import { parseOsmNames, wikiIntroFromMarkdown } from "../src/scrape";

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

  it("renders a unique Berlin city lander", async () => {
    const response = await SELF.fetch("https://thaimassageforu.com/de/berlin");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("<h1>Thai massage in Berlin, Germany</h1>");
    expect(text).toContain("Lotus River Thai Massage");
    expect(text).toContain("43");
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
});
