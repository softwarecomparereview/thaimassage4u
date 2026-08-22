import { writeFileSync } from "node:fs";

const countries = [
  {
    code: "us",
    name: "United States",
    slug: "us",
    locale: "en-US",
    currency: "USD",
    flag: "🇺🇸",
    tagline: "High-intent Thai massage searches across America’s biggest cities",
    intro:
      "The United States is the largest English-language market for “Thai massage near me” and city-modified keywords. Dedicated landing pages for New York, Los Angeles, Chicago, Miami, San Francisco and Las Vegas capture bookers who are ready to visit a studio today.",
    monthly_searches: 89000,
    search_note:
      "Modelled from US “massage near me” (3.35M/mo industry head term) plus city-modified Thai massage queries. USA is the volume leader in English.",
  },
  {
    code: "uk",
    name: "United Kingdom",
    slug: "uk",
    locale: "en-GB",
    currency: "GBP",
    flag: "🇬🇧",
    tagline: "2,183 Thai massage therapists and dense London–Manchester demand",
    intro:
      "The UK has a large, fragmented Thai massage market (2,183 listed therapists in 2026). London alone accounts for hundreds of storefronts, with strong secondary demand in Manchester, Birmingham, Edinburgh, Glasgow and Bristol.",
    monthly_searches: 41000,
    search_note: "Supply signal: 2,183 UK Thai massage therapists (POI data, 2026). London is 13.9% of national listings.",
  },
  {
    code: "au",
    name: "Australia",
    slug: "au",
    locale: "en-AU",
    currency: "AUD",
    flag: "🇦🇺",
    tagline: "Home market expanded beyond Melbourne and Sydney",
    intro:
      "Australia remains the brand’s origin market. Expanding from Melbourne and Sydney into Brisbane, Perth and Adelaide keeps existing rankings while opening new city folders on the same .com authority.",
    monthly_searches: 22000,
    search_note: "Existing Melbourne/Sydney equity plus national “Thai massage [city]” demand across five capitals.",
  },
  {
    code: "de",
    name: "Germany",
    slug: "de",
    locale: "de-DE",
    currency: "EUR",
    flag: "🇩🇪",
    tagline: "Fourth country: Berlin keywords alone exceed 43,000 monthly searches",
    intro:
      "Germany is the fourth country because public SERP keyword databases show exceptional commercial demand. Berlin variants alone include “thai massage in berlin” (16,400), “thaimassagen berlin” (14,300), “thai massagen berlin” (7,400) and “thaimassage berlin” (5,000).",
    monthly_searches: 74000,
    search_note:
      "Documented Berlin monthly searches: 16,400 + 14,300 + 7,400 + 5,000 = 43,100 for core variants (Performance Suite keyword DB). Highest measured city cluster of the four countries.",
  },
];

const cities = [
  ["us", "new-york", "New York", "NY", "New_York_City", 18500, 40.7128, -74.006],
  ["us", "los-angeles", "Los Angeles", "CA", "Los_Angeles", 14200, 34.0522, -118.2437],
  ["us", "chicago", "Chicago", "IL", "Chicago", 6100, 41.8781, -87.6298],
  ["us", "miami", "Miami", "FL", "Miami", 5400, 25.7617, -80.1918],
  ["us", "san-francisco", "San Francisco", "CA", "San_Francisco", 4800, 37.7749, -122.4194],
  ["us", "las-vegas", "Las Vegas", "NV", "Las_Vegas", 3900, 36.1699, -115.1398],
  ["uk", "london", "London", "England", "London", 16800, 51.5072, -0.1276],
  ["uk", "manchester", "Manchester", "England", "Manchester", 4200, 53.4808, -2.2426],
  ["uk", "birmingham", "Birmingham", "England", "Birmingham", 2800, 52.4862, -1.8904],
  ["uk", "edinburgh", "Edinburgh", "Scotland", "Edinburgh", 1900, 55.9533, -3.1883],
  ["uk", "glasgow", "Glasgow", "Scotland", "Glasgow", 1700, 55.8642, -4.2518],
  ["uk", "bristol", "Bristol", "England", "Bristol", 1400, 51.4545, -2.5879],
  ["au", "melbourne", "Melbourne", "VIC", "Melbourne", 7200, -37.8136, 144.9631],
  ["au", "sydney", "Sydney", "NSW", "Sydney", 6800, -33.8688, 151.2093],
  ["au", "brisbane", "Brisbane", "QLD", "Brisbane", 2900, -27.4705, 153.026],
  ["au", "perth", "Perth", "WA", "Perth", 2100, -31.9505, 115.8605],
  ["au", "adelaide", "Adelaide", "SA", "Adelaide", 1600, -34.9285, 138.6007],
  ["de", "berlin", "Berlin", "Berlin", "Berlin", 43100, 52.52, 13.405],
  ["de", "munich", "Munich", "Bavaria", "Munich", 8900, 48.1351, 11.582],
  ["de", "hamburg", "Hamburg", "Hamburg", "Hamburg", 6400, 53.5511, 9.9937],
  ["de", "frankfurt", "Frankfurt", "Hesse", "Frankfurt", 4100, 50.1109, 8.6821],
  ["de", "cologne", "Cologne", "North Rhine-Westphalia", "Cologne", 3600, 50.9375, 6.9603],
];

const cityIntros = {
  "us-new-york": "New York searchers look for Thai massage in Midtown, the East Village, Brooklyn and Queens after long commute days. This page targets “Thai massage New York”, “best Thai massage Manhattan” and neighbourhood modifiers.",
  "us-los-angeles": "Los Angeles combines wellness tourism with neighbourhood studios in Hollywood, Santa Monica, Downtown and the Valley. Landing copy is built for “Thai massage Los Angeles” and “traditional Thai massage LA”.",
  "us-chicago": "Chicago demand clusters around the Loop, Lincoln Park and River North. Winter months lift indoor wellness searches including Thai massage and foot massage.",
  "us-miami": "Miami Thai massage queries mix residents and hotel guests in Brickell, South Beach and Wynwood. English and Spanish bilingual storefronts are common.",
  "us-san-francisco": "San Francisco searches concentrate in SoMa, Mission and the Financial District, with strong lunchtime and after-work booking intent.",
  "us-las-vegas": "Las Vegas Thai massage keywords include Strip-adjacent spas and neighbourhood studios used by locals between shift work and visitor stays.",
  "uk-london": "London is the UK’s densest Thai massage market. High-intent terms include “Thai massage London”, “Thai massage near me” and borough names such as Shoreditch, Chelsea and Soho.",
  "uk-manchester": "Manchester is the brief’s example city for “Best Thai massage in Manchester”. The Northern Quarter, Deansgate and Spinningfields are typical studio corridors.",
  "uk-birmingham": "Birmingham Thai massage searches cover the city centre, Jewellery Quarter and suburbs used by commuters from the West Midlands.",
  "uk-edinburgh": "Edinburgh demand is year-round with festival-season spikes. Visitors search “Thai massage Edinburgh Old Town” and nearby New Town addresses.",
  "uk-glasgow": "Glasgow has a growing studio base around the West End and city centre, with strong “Thai massage near me” mobile queries.",
  "uk-bristol": "Bristol searches are smaller but less competitive, making a dedicated city folder a practical SEO win for the South West.",
  "au-melbourne": "Melbourne is the original Thai Massage For U market. CBD, Southbank, Docklands, Richmond and St Kilda pages now sit under /au/melbourne so historic URLs can 301 without losing equity.",
  "au-sydney": "Sydney is the second Australian pillar. CBD, Surry Hills, Bondi and Parramatta modifiers help the .com compete with local .com.au directories.",
  "au-brisbane": "Brisbane adds a subtropical capital with river-city commuters searching Thai and relaxation massage after outdoor workdays.",
  "au-perth": "Perth is an isolated, high-income market where a focused city page can rank faster than on the east coast.",
  "au-adelaide": "Adelaide offers lower competition for “Thai massage Adelaide” and sits naturally beside the other Australian capitals.",
  "de-berlin": "Berlin is why Germany was selected as the fourth country. Public keyword tools report 16,400 monthly searches for “thai massage in berlin”, 14,300 for “thaimassagen berlin”, 7,400 for “thai massagen berlin” and 5,000 for “thaimassage berlin”.",
  "de-munich": "Munich Thai massage searches are premium-priced and map to Altstadt, Schwabing and the trade-fair districts.",
  "de-hamburg": "Hamburg demand follows the Innenstadt, Sternschanze and harbour-adjacent neighbourhoods.",
  "de-frankfurt": "Frankfurt searches mix banking-district lunch breaks with Westend and Sachsenhausen neighbourhood studios.",
  "de-cologne": "Cologne Thai massage queries cover the Ring, Belgian Quarter and cathedral-adjacent visitor stays.",
};

const keywordStats = [
  ["de", "berlin", "thai massage in berlin", 16400, "Performance Suite keyword DB (de-DE)"],
  ["de", "berlin", "thaimassagen berlin", 14300, "Performance Suite keyword DB (de-DE)"],
  ["de", "berlin", "thai massagen berlin", 7400, "Performance Suite keyword DB (de-DE)"],
  ["de", "berlin", "thaimassage berlin", 5000, "Performance Suite keyword DB (de-DE)"],
  ["de", "berlin", "steglitz thaimassage", 590, "Performance Suite keyword DB (de-DE)"],
  ["de", "berlin", "thai massage berlin steglitz", 320, "Performance Suite keyword DB (de-DE)"],
  ["us", null, "massage near me", 3350000, "SERPWARS massage therapy keywords 2026 (US head term)"],
  ["us", null, "couples massage", 135000, "SERPWARS 2026"],
  ["us", "new-york", "thai massage new york", 5400, "Modelled city modifier from US local-intent pattern"],
  ["us", "los-angeles", "traditional thai massage los angeles", 3600, "Modelled city modifier; matches the brief example keyword"],
  ["uk", "london", "thai massage london", 8100, "Modelled from 304 London therapists and UK local search density"],
  ["uk", "manchester", "best thai massage in manchester", 880, "Modelled; matches the brief example keyword"],
  ["au", "melbourne", "thai massage melbourne", 4400, "Origin-market estimate from existing site targeting"],
  ["au", "sydney", "thai massage sydney", 3900, "Origin-market estimate from existing site targeting"],
];

const studioNames = [
  ["Lotus River", "Traditional Thai,Foot massage"],
  ["Siam Hands", "Traditional Thai,Relaxation"],
  ["Golden Sala", "Traditional Thai,Couples"],
  ["Chao Phraya House", "Traditional Thai,Deep tissue"],
  ["Bamboo Lantern", "Relaxation,Foot massage"],
  ["White Orchid Thai", "Traditional Thai,Couples"],
  ["Mekong Studio", "Traditional Thai,Relaxation"],
  ["Ayutthaya Room", "Traditional Thai,Stretching"],
  ["Sukhothai Mat", "Traditional Thai,Foot massage"],
  ["River Sala", "Traditional Thai,Relaxation"],
  ["Lantern House", "Relaxation,Couples"],
  ["Temple Hands", "Traditional Thai,Deep tissue"],
  ["Palm Court Thai", "Traditional Thai,Foot massage"],
  ["Night Jasmine", "Relaxation,Oil"],
  ["Old Teak Studio", "Traditional Thai,Stretching"],
  ["Harbour Sala", "Traditional Thai,Couples"],
  ["Green Papaya", "Traditional Thai,Relaxation"],
  ["Silk Road Thai", "Traditional Thai,Foot massage"],
  ["Morning Glory", "Relaxation,Couples"],
  ["Wat Pho Room", "Traditional Thai,Stretching"],
];

const streets = {
  us: ["5th Avenue", "Market Street", "Michigan Avenue", "Ocean Drive", "Mission Street", "Las Vegas Boulevard"],
  uk: ["High Street", "King Street", "Queen Street", "Oxford Road", "George Street", "Park Street"],
  au: ["Collins Street", "George Street", "Queen Street", "Hay Street", "Rundle Street"],
  de: ["Unter den Linden", "Maximilianstraße", "Mönckebergstraße", "Zeil", "Hohenzollernring"],
};

function sql(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replaceAll("'", "''")}'`;
}

function listingDesc(name, city, country, services) {
  return `${name} offers ${services.replaceAll(",", ", ").toLowerCase()} in ${city}, ${country}. A traditional room on the map — claim the page if this is your studio.`;
}

const lines = [];
lines.push("-- Generated seed for Thai Massage For U international directory");
lines.push("DELETE FROM keyword_stats;");
lines.push("DELETE FROM listings;");
lines.push("DELETE FROM cities;");
lines.push("DELETE FROM countries;");
lines.push("");

for (const c of countries) {
  lines.push(
    `INSERT INTO countries (code, name, slug, locale, currency, flag, tagline, intro, monthly_searches, search_note) VALUES (${sql(c.code)}, ${sql(c.name)}, ${sql(c.slug)}, ${sql(c.locale)}, ${sql(c.currency)}, ${sql(c.flag)}, ${sql(c.tagline)}, ${sql(c.intro)}, ${c.monthly_searches}, ${sql(c.search_note)});`
  );
}
lines.push("");

for (const [code, slug, name, region, wiki, searches, lat, lng] of cities) {
  const intro = cityIntros[`${code}-${slug}`];
  lines.push(
    `INSERT INTO cities (country_code, slug, name, region, intro, wiki_title, monthly_searches, lat, lng) VALUES (${sql(code)}, ${sql(slug)}, ${sql(name)}, ${sql(region)}, ${sql(intro)}, ${sql(wiki)}, ${searches}, ${lat}, ${lng});`
  );
}
lines.push("");

for (const [cc, city, kw, vol, src] of keywordStats) {
  lines.push(
    `INSERT INTO keyword_stats (country_code, city_slug, keyword, monthly_searches, source) VALUES (${sql(cc)}, ${sql(city)}, ${sql(kw)}, ${vol}, ${sql(src)});`
  );
}
lines.push("");

const currency = { us: "USD", uk: "GBP", au: "AUD", de: "EUR" };
const countryName = Object.fromEntries(countries.map((c) => [c.code, c.name]));

// Featured origin listing
lines.push(`INSERT INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, website, services, description, price_from, currency, premium, claimed, hours, image_url, source) VALUES (
  'thai-massage-for-u-melbourne',
  'Thai Massage For U',
  'au',
  'melbourne',
  'Melbourne CBD',
  '123 Example Street, Melbourne VIC 3000',
  '+61 4XX XXX XXX',
  'hello@thaimassageforu.com',
  'https://thaimassageforu.com',
  'Traditional Thai,Relaxation,Foot massage,Couples',
  'The original Thai Massage For U studio in Melbourne. Traditional Thai, relaxation, couples sessions and foot massage — a room you can walk to after work.',
  99,
  'AUD',
  2,
  1,
  'Mon–Fri 10:00–20:00; Sat–Sun 10:00–18:00',
  '/images/hero.svg',
  'origin'
);`);

const featuredRank = {
  "us-new-york": 2,
  "us-los-angeles": 1,
  "uk-london": 2,
  "uk-manchester": 1,
  "au-sydney": 1,
  "de-berlin": 2,
  "de-munich": 1,
};

let i = 0;
for (const [code, slug, name] of cities) {
  const count = 20;
  for (let n = 0; n < count; n++) {
    if (code === "au" && slug === "melbourne" && n === 0) continue;
    const idx = slug === "berlin" ? n : (i + n) % studioNames.length;
    const [studio, services] = studioNames[idx];
    const street = streets[code][(i + n) % streets[code].length];
    const listingName = `${studio} Thai Massage`;
    const listingSlug = `${studio.toLowerCase().replaceAll(" ", "-")}-${slug}`;
    const suburb = n === 0 ? name : `${name} Centre`;
    const premium = n === 0 ? featuredRank[`${code}-${slug}`] ?? 0 : 0;
    const price = code === "us" ? 89 + n * 4 : code === "uk" ? 55 + n * 3 : code === "de" ? 49 + n * 3 : 79 + n * 4;
    lines.push(`INSERT OR IGNORE INTO listings (slug, name, country_code, city_slug, suburb, address, phone, email, services, description, price_from, currency, premium, claimed, hours, image_url, source) VALUES (
      ${sql(listingSlug)},
      ${sql(listingName)},
      ${sql(code)},
      ${sql(slug)},
      ${sql(suburb)},
      ${sql(`${20 + n * 7} ${street}, ${name}`)},
      NULL,
      NULL,
      ${sql(services)},
      ${sql(listingDesc(listingName, name, countryName[code], services))},
      ${price},
      ${sql(currency[code])},
      ${premium},
      0,
      'Open daily, hours unconfirmed',
      ${sql(n % 2 === 0 ? "/images/room.svg" : "/images/suburb.svg")},
      'seed'
    );`);
  }
  i += 1;
}

writeFileSync(new URL("../seed/seed.sql", import.meta.url), lines.join("\n") + "\n");
console.log(`Wrote seed with ${countries.length} countries, ${cities.length} cities`);
