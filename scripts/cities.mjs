// Shared city/country metadata used by both the OSM scraper and the seed generator.
// Keeping one source of truth means the two scripts can never drift out of sync on
// which cities exist or where their coordinates point.

export const countries = [
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

// [countryCode, citySlug, name, region, wikiTitle, monthlySearches, lat, lng, radiusMeters]
export const cities = [
  ["us", "new-york", "New York", "NY", "New_York_City", 18500, 40.7128, -74.006, 18000],
  ["us", "los-angeles", "Los Angeles", "CA", "Los_Angeles", 14200, 34.0522, -118.2437, 20000],
  ["us", "chicago", "Chicago", "IL", "Chicago", 6100, 41.8781, -87.6298, 18000],
  ["us", "miami", "Miami", "FL", "Miami", 5400, 25.7617, -80.1918, 16000],
  ["us", "san-francisco", "San Francisco", "CA", "San_Francisco", 4800, 37.7749, -122.4194, 14000],
  ["us", "las-vegas", "Las Vegas", "NV", "Las_Vegas", 3900, 36.1699, -115.1398, 14000],
  ["uk", "london", "London", "England", "London", 16800, 51.5072, -0.1276, 18000],
  ["uk", "manchester", "Manchester", "England", "Manchester", 4200, 53.4808, -2.2426, 14000],
  ["uk", "birmingham", "Birmingham", "England", "Birmingham", 2800, 52.4862, -1.8904, 14000],
  ["uk", "edinburgh", "Edinburgh", "Scotland", "Edinburgh", 1900, 55.9533, -3.1883, 12000],
  ["uk", "glasgow", "Glasgow", "Scotland", "Glasgow", 1700, 55.8642, -4.2518, 12000],
  ["uk", "bristol", "Bristol", "England", "Bristol", 1400, 51.4545, -2.5879, 12000],
  ["au", "melbourne", "Melbourne", "VIC", "Melbourne", 7200, -37.8136, 144.9631, 16000],
  ["au", "sydney", "Sydney", "NSW", "Sydney", 6800, -33.8688, 151.2093, 16000],
  ["au", "brisbane", "Brisbane", "QLD", "Brisbane", 2900, -27.4705, 153.026, 14000],
  ["au", "perth", "Perth", "WA", "Perth", 2100, -31.9505, 115.8605, 14000],
  ["au", "adelaide", "Adelaide", "SA", "Adelaide", 1600, -34.9285, 138.6007, 12000],
  ["de", "berlin", "Berlin", "Berlin", "Berlin", 43100, 52.52, 13.405, 16000],
  ["de", "munich", "Munich", "Bavaria", "Munich", 8900, 48.1351, 11.582, 14000],
  ["de", "hamburg", "Hamburg", "Hamburg", "Hamburg", 6400, 53.5511, 9.9937, 14000],
  ["de", "frankfurt", "Frankfurt", "Hesse", "Frankfurt", 4100, 50.1109, 8.6821, 12000],
  ["de", "cologne", "Cologne", "North Rhine-Westphalia", "Cologne", 3600, 50.9375, 6.9603, 12000],
];

export const cityIntros = {
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

export const keywordStats = [
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

export const currencyFor = { us: "USD", uk: "GBP", au: "AUD", de: "EUR" };
