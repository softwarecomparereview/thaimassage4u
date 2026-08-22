export type OriginStory = {
  kicker: string;
  title: string;
  lede: string;
  body: string[];
};

const COUNTRY_ORIGINS: Record<string, OriginStory> = {
  us: {
    kicker: "United States",
    title: "How Thai massage took root in American cities",
    lede: "Thai massage did not arrive in the United States as a hotel spa extra. It travelled with Thai families, temple networks and neighbourhood storefronts — first on the West Coast, then into every dense downtown that now searches for a lunch-hour stretch.",
    body: [
      "Los Angeles still holds the country’s oldest public Thai cultural campus at Wat Thai in the San Fernando Valley, and the first generation of American Thai massage rooms grew in the same orbit: family-run shops, Thai grocery corridors, and therapists trained in Bangkok who kept the clothed, rhythmic style rather than converting it into oil massage. New York followed a different path. Midtown and downtown rooms opened for office workers who needed a fifty-minute reset between meetings, not a weekend retreat.",
      "Chicago, Miami, San Francisco and Las Vegas each grafted the practice onto a local habit. Winter cities wanted heat and indoor recovery. Visitor cities wanted late hours. Tech corridors wanted walkable lunch bookings. What the American map shares is density: enough search demand in a handful of metros to support a .com directory without splitting the brand across fifty state sites.",
      "On this directory the United States is not a generic “nationwide” page. It is six city landers with their own origin notes, photography and studio lists — because that is how people actually type the query: Thai massage plus a city name.",
    ],
  },
  uk: {
    kicker: "United Kingdom",
    title: "High streets, harbour cities and a Thai room on the way home",
    lede: "Britain’s Thai massage map grew out of late-twentieth-century Thai restaurants, then quietly filled the floors above them. London was first. Manchester, Birmingham, Edinburgh, Glasgow and Bristol each kept a local grain.",
    body: [
      "From the 1980s onward, Thai cooking made the cuisine familiar long before assisted stretching did. Therapists who had trained in Wat Pho-influenced schools in Thailand opened small rooms behind or above those restaurants, then independent studios on high streets where a walk-in hour after work was easier than a destination spa. The British version of the craft stayed close to the original: you remain clothed, the work happens on a mat or a low futon, and the session is a conversation between compression and stretch.",
      "London still concentrates the most searches, but the brief for this directory was never “London only”. Manchester is the worked example of a northern city with serious intent — Northern Quarter recoveries, match-day tightness, and a compact centre you can actually walk between studios. Edinburgh and Glasgow split Scotland’s demand between festival-season visitors and a year-round West End. Bristol and Birmingham sit on the same pattern: a harbour or canal city with a young professional core.",
      "Country colour on these pages is heritage navy and brass. City pages add the local overlay. The photography is of the real places — stone, brick, harbour light — because a directory that pretends every city looks the same is the reason people bounce.",
    ],
  },
  au: {
    kicker: "Australia",
    title: "Melbourne first, then the other capitals",
    lede: "This brand began as a Melbourne directory. Australia remains the home market: five capitals, late light, and a Thai-Australian community that made traditional massage ordinary rather than exotic.",
    body: [
      "Melbourne’s Thai story is not a tourist brochure. Springvale, Footscray and the CBD have hosted Thai grocers, temples and treatment rooms for decades, and the city’s laneway habit — compact, walkable, slightly hidden — suits a mat room behind a modest shopfront. People here already know the difference between a sports oil massage and a traditional Thai session. They search with the city name because they want a room they can reach after work, not a theory of wellness.",
      "Sydney layered harbour-city visitor demand on top of a resident base in Surry Hills, the CBD and the eastern suburbs. Brisbane brought subtropical heat and a river-city lunch hour. Perth, isolated by hours of flight, built a self-contained west-coast scene. Adelaide kept a tighter, walkable core around the park lands. Together they are enough search volume to justify a national .com without inventing towns that do not book.",
      "The Australian palette on this site — sand, eucalyptus green, late-light gold — is not decoration for its own sake. It is the original brand stretched across the capitals, with each city page carrying its own skyline and origin note so Melbourne is no longer asked to stand in for the whole country.",
    ],
  },
  de: {
    kicker: "Germany",
    title: "Why Germany is the fourth country, and why Berlin leads it",
    lede: "Germany was not added for flag-matching. Berlin’s Thai-massage keyword cluster is the strongest measured city on this map — tens of thousands of modelled monthly searches — so the fourth country had to be the one people are already typing.",
    body: [
      "After reunification, Berlin’s neighbourhoods filled with independent practices: yoga lofts, osteopathy rooms, and Thai massage studios that treated the craft as Körperarbeit rather than a novelty. Mitte, Prenzlauer Berg, Kreuzberg and Neukölln each grew their own kiez of treatment rooms. The German-language queries are specific — Thai-Massage, traditionelle Thai-Massage, Thai Massage Berlin — and they stack into a volume that outruns the next-candidate countries we modelled.",
      "Munich, Hamburg, Frankfurt and Cologne are not copies of Berlin. Munich mixes trade-fair weeks with a resident wellness habit. Hamburg’s harbour districts book recovery the way a port city always has. Frankfurt’s banking core wants a lunch-hour studio within a short walk of the towers. Cologne sits on the Rhine with cathedral-city visitor traffic and a dense Innenstadt.",
      "The German layer on this site is charcoal, warm gold and tighter radii. Berlin adds U-Bahn yellow. That stacking is deliberate: one country frame, then a city overlay, then the listings. It is how a single .com can feel local without becoming five disconnected websites.",
    ],
  },
};

const CITY_ORIGINS: Record<string, OriginStory> = {
  "us-new-york": {
    kicker: "New York",
    title: "A Dutch harbour that became the densest Thai-massage search in America",
    lede: "New York began as New Amsterdam in 1624, a trading post on a narrow island. The grid, the subway and the lunch hour are why Thai massage here is a Midtown and Downtown product as much as a wellness one.",
    body: [
      "The Dutch West India Company sited the colony for the harbour. The English took it in 1664 and kept the island’s talent for packing people into a walkable core. That compression is the origin of the modern booking: a fifty-minute traditional session between meetings, a walk from Penn Station or a downtown loft, no car required.",
      "Thai therapists arrived with the city’s late-twentieth-century Thai community and with itinerant practitioners who had already trained in Bangkok. The rooms that lasted were the ones that understood New York time — early, late, and uninterested in a two-hour spa theatre. Today the city page is built for the queries people actually use: Thai massage Midtown, Chelsea, Downtown, near me.",
    ],
  },
  "us-los-angeles": {
    kicker: "Los Angeles",
    title: "Pueblos, studios and the American home of Thai culture",
    lede: "Los Angeles began as El Pueblo de Nuestra Señora la Reina de los Ángeles in 1781. The Thai-American story, though, is a twentieth-century one, and it still shapes how the city books a traditional massage.",
    body: [
      "Before Hollywood, the basin was ranch land and a Mexican pueblo. The film industry and the Pacific port pulled in the world, including one of the largest Thai communities outside Thailand. Wat Thai of Los Angeles, founded in the 1970s in North Hollywood, became a civic landmark — food festivals, language, and a pipeline of therapists who treated Thai massage as cultural practice, not a spa menu line.",
      "That is why Los Angeles still feels like the U.S. origin market for the craft. Santa Monica, Hollywood, Downtown and the Valley each have a different pace, but they share the same expectation: a real Thai session, clothed, with stretching, not a generic oil massage rebranded for the boulevard.",
    ],
  },
  "us-chicago": {
    kicker: "Chicago",
    title: "Portage, prairie and a winter city that books indoor recovery",
    lede: "Chicago sits where Native portage routes met the Great Lakes. Rebuilt after the 1871 fire, it became a city of indoor lives — offices, elevated trains, and treatment rooms you reach without a beach.",
    body: [
      "The word Chicago likely comes from a term for the wild onion along the slow river. French traders, then a canal, then rail, made it the Midwest’s warehouse. Thai massage arrived much later, into neighbourhoods that already understood bodywork: Lincoln Park, Lakeview, the Loop’s lunch grid.",
      "Winter is the quiet business case. When the lake wind arrives, people look for heat, stretch and a room that does not require a weekend. The Chicago lander is written for that indoor season as much as for summer visitors.",
    ],
  },
  "us-miami": {
    kicker: "Miami",
    title: "A mangrove shore that learned hotel hours",
    lede: "Miami was incorporated in 1896 after Julia Tuttle and Henry Flagler forced a railroad to the foot of Florida. The city has been hosting visitors ever since, which is why Thai massage here runs later than in most American downtowns.",
    body: [
      "The Tequesta lived on this shore long before the hotel line. The modern city is a negotiation between Brickell’s towers, South Beach’s art-deco strip, and a resident Latin American and Caribbean core. Thai studios that last in Miami keep visitor hours without abandoning neighbourhood clients in Wynwood and Little Haiti.",
      "Search intent here mixes hotel guests and locals who want recovery after heat, not after snow. Listings on this page should read like a coastal city: late light, walkable clusters, and a price in dollars that still has to compete with every other spa on the beach.",
    ],
  },
  "us-san-francisco": {
    kicker: "San Francisco",
    title: "A Yerba Buena cove that still books on hills and lunch hours",
    lede: "San Francisco began as Yerba Buena, a small settlement on a cove, before the 1849 Gold Rush detonated it into a city. The hills, the fog and the Financial District lunch hour still decide how Thai massage is booked.",
    body: [
      "Ohlone land, then a Mexican pueblo, then a rush city: San Francisco has always packed ambitious people into a tiny peninsula. Thai rooms clustered where office workers could walk — SoMa, the Financial District, the Mission — and where the fog made an indoor stretch feel like a civic service.",
      "The craft here competes with a dense wellness market. What traditional Thai still offers, and what this lander emphasises, is a clothed, stretching session that is closer to assisted yoga than to a candlelit oil menu. That distinction is the search query.",
    ],
  },
  "us-las-vegas": {
    kicker: "Las Vegas",
    title: "A desert spring, a railroad, then a city that never clocks off",
    lede: "Las Vegas takes its name from the meadows that once sat over desert springs. The railroad and later the Strip turned a watering place into a 24-hour city — and Thai massage followed the shift workers, not just the tourists.",
    body: [
      "Southern Paiute people knew the springs first. American maps arrived with the railroad in 1905. Casinos rewrote the skyline, but the booking pattern for bodywork is local as much as visitor: night-shift recovery, convention weeks, and residents in Henderson and Summerlin who do not want to cross the Strip for a traditional session.",
      "This city overlay is darker on purpose — night purple, neon gold — because Las Vegas is the one lander that should not pretend it is a sleepy capital. Hours matter here more than in any other American city on the map.",
    ],
  },
  "uk-london": {
    kicker: "London",
    title: "A Roman crossing that still organises Thai massage by borough",
    lede: "London began as Londinium, a Roman river crossing. Two thousand years later the city still books services the way it always has: by neighbourhood, not by a single centre.",
    body: [
      "The Thames made the port; the port made the city. Thai restaurants clustered in Soho and beyond from the late twentieth century, and treatment rooms followed the same streets — then jumped to Shoreditch, Chelsea, Camden and the south-bank residential belts. A Londoner does not search “Thai massage UK”. They search a tube stop.",
      "That is why this lander is a borough problem as much as a city one. The directory keeps one London page for authority, then lists studios with the suburb grain people actually use when they walk out of the station.",
    ],
  },
  "uk-manchester": {
    kicker: "Manchester",
    title: "Cotton capital, Northern Quarter, and the brief’s example city",
    lede: "Manchester rose on cotton, canals and rain. The mills emptied; the bricks stayed. Thai massage here is a Northern Quarter and city-core product — the worked example of a British city with high-intent search beyond London.",
    body: [
      "Mamucium was a Roman fort. The industrial city that followed became the world’s cotton warehouse, then a music and university city with a tight walkable centre. Independent Thai rooms fit that grain: mill-brick buildings, compact streets, a clientele that books around matches, nights out and office parks in Salford and Spinningfields.",
      "The search phrase “Best Thai massage in Manchester” is in the original brief for a reason. This page exists to capture it with a unique H1, local photography and listings that do not pretend Manchester is a suburb of London.",
    ],
  },
  "uk-birmingham": {
    kicker: "Birmingham",
    title: "A market town that became the workshop of the world",
    lede: "Birmingham’s name points to a settlement of Beorma’s people. Canals and metal trades made it the workshop of the world; the Jewellery Quarter and the city core now hold the treatment rooms.",
    body: [
      "Unlike a port city, Birmingham grew inland on skill: guns, jewellery, cars. That workshop habit still shows up in how people book bodywork — practical, after-shift, close to New Street. Thai studios that last here sit on bus corridors and in the Chinese and independent quarters rather than in a single tourist strip.",
      "The canal teal on this overlay is a nod to the waterways that made the city, not a generic spa colour. Listings should feel like a Midlands capital: dense, multilingual, and uninterested in London copy.",
    ],
  },
  "uk-edinburgh": {
    kicker: "Edinburgh",
    title: "A crag, a castle, and a festival city that books in two speeds",
    lede: "Edinburgh grew under a volcanic crag. The Old Town stacked itself along the ridge; the New Town later added Georgian order. Thai massage here has to serve residents and the festival surge without becoming a Fringe stall.",
    body: [
      "Din Eidyn, the fortress on the rock, is older than the New Town’s symmetry. That double city — medieval close and planned square — still organises walking routes. Treatment rooms that work year-round sit in residential pockets and the East End, not only on the Royal Mile.",
      "August changes the search graph. Visitors type the city name; locals wait until September. The lander keeps a steady resident story so the page does not read like a three-week brochure.",
    ],
  },
  "uk-glasgow": {
    kicker: "Glasgow",
    title: "A Clyde trading city with a West End recovery habit",
    lede: "Glasgow’s name is often traced to a “green hollow”. Shipbuilding on the Clyde made it an imperial workshop; the West End and Merchant City now hold the quieter rooms.",
    body: [
      "St Mungo’s medieval burgh became a tobacco and then a shipbuilding giant. When the yards receded, the city kept its density and its nightlife, which is a serious clientele for traditional stretching. Thai massage here is after-work and weekend recovery, not a castle-view spa product.",
      "The overlay sits on Clyde navy. Listings should read as a working city: Byres Road, the Merchant City, and the south side, with prices in pounds and hours that match people who do not live on a tourist timetable.",
    ],
  },
  "uk-bristol": {
    kicker: "Bristol",
    title: "A harbour city that still faces the water",
    lede: "Bristol made its money on the harbour — cloth, then Atlantic trade, then a modern creative city on the same water. Thai massage followed the harbourside and the hill neighbourhoods above it.",
    body: [
      "The name likely means “bridge place”. The floating harbour still organises the centre. Independent studios fit Bristol’s grain: compact, slightly alternative, close to Clifton, Stokes Croft and the old town. People book a traditional session the way they book everything else here — locally, on foot or by bike, without a London comparison.",
      "Balloon-warm accents on this overlay are a local joke with a straight face. The photography is the harbour, because that is still the city’s first fact.",
    ],
  },
  "au-melbourne": {
    kicker: "Melbourne",
    title: "A falling-together city, and the original home of this directory",
    lede: "Melbourne occupies Kulin Nation land. The 1835 settlement on the Yarra became a gold-rush boomtown, then a laneway city. This directory started here, and the Melbourne page is still the brand’s origin lander.",
    body: [
      "John Batman’s notorious “treaty” and the later Crown grid do not erase the older country underneath. What visitors notice is the newer habit: lanes, coffee, a CBD you walk, and suburbs like Springvale and Footscray where Thai grocers and temples made traditional massage ordinary. The first version of this site existed because Melbourne already searched for Thai massage as a local errand, not as a holiday treat.",
      "Studios that last in Melbourne understand weather and lanes — a room you can reach from Flinders Street or from a tram, a session that fits between a meeting and a dinner. The city overlay is coffee-dark on Australian sand. It should feel like home market, because it is.",
    ],
  },
  "au-sydney": {
    kicker: "Sydney",
    title: "A harbour that became Australia’s first city",
    lede: "Sydney began as a British penal colony in 1788 on Gadigal land around a sandstone harbour. The Opera House and the Bridge are late decorations on a much older cove.",
    body: [
      "The Eora nations fished this harbour for thousands of years. The colony clustered around Sydney Cove, then climbed the ridges. Thai massage arrived with late-twentieth-century migration and with a visitor economy that still types the city name before the suburb. CBD, Surry Hills and Bondi are different queries with the same harbour light behind them.",
      "This lander uses harbour blue over Australian gold because Sydney should not inherit Melbourne’s laneway palette. The photography is the real skyline at dusk — sails and steel — so the page is unmistakably this city.",
    ],
  },
  "au-brisbane": {
    kicker: "Brisbane",
    title: "A river town that learned subtropical heat",
    lede: "Brisbane sits on Turrbal and Jagera land along a looping river. A penal outpost in 1824 became a state capital that books Thai massage around heat, humidity and a walkable inner city.",
    body: [
      "The river is the origin. Streets flood, then dry, then fill with office workers who want an indoor stretch at lunch. Thai rooms in the CBD, Fortitude Valley and South Bank serve that climate: less “cosy winter spa”, more cold-room recovery from a city that stays warm.",
      "The overlay is brighter green and heat-haze gold on purpose. Copy that could sit on a Melbourne page is the wrong copy. This lander talks about the river city, not the south.",
    ],
  },
  "au-perth": {
    kicker: "Perth",
    title: "An isolated capital on the Indian Ocean",
    lede: "Perth occupies Whadjuk Noongar country on the Swan River. Founded in 1829, it remains one of the world’s most isolated capitals — which is exactly why it grew its own Thai-massage scene instead of borrowing Melbourne’s.",
    body: [
      "Distance is the origin story. Flights from the east coast are a commitment, so Perth residents book locally: CBD, Northbridge, the beaches, Fremantle as a separate gravitational pull. Thai therapists who settle here tend to stay; the market is self-contained.",
      "Ocean teal over west-coast sand is the overlay. Evening light off the Indian Ocean is not a metaphor — it is the hour people actually leave the office. Listings should feel like a city that does not need Sydney’s permission.",
    ],
  },
  "au-adelaide": {
    kicker: "Adelaide",
    title: "A planned city between hills and gulf",
    lede: "Adelaide was laid out in 1836 on Kaurna land as a planned, park-laced capital. The grid, the church spires and the plains still make it a walking city — and a tidy market for traditional Thai rooms.",
    body: [
      "Colonel Light’s plan put park lands around a compact centre. That geometry still helps a directory: studios in the CBD and inner north are actually reachable. The Thai-Australian presence is smaller than Melbourne’s but established, and the search graph is honest rather than inflated.",
      "Wine-stone warmth on the Australian frame is the local note. This page should read like a plains capital with a gulf sunset, not like a cloned eastern-city lander.",
    ],
  },
  "de-berlin": {
    kicker: "Berlin",
    title: "A marsh town that became Europe’s strongest Thai-massage keyword cluster",
    lede: "Berlin began as twin towns on a sandy river in the thirteenth century. It has been a court, an imperial capital, a divided city and a reunified laboratory. The Thai-massage search volume followed the last chapter.",
    body: [
      "The name likely points to a marsh or a Slavic root; the origin is wet ground, not marble. After 1990 the empty Mitte filled with independent practices, and Thai massage became part of the kiez mix alongside yoga and physiotherapy. People search in German and in English. The documented monthly volumes for Berlin variants — tens of thousands when stacked — are why Germany is on this .com at all.",
      "This lander is the keyword-volume capital of the directory. U-Bahn yellow on charcoal is the overlay. Listings should feel like neighbourhood rooms in Prenzlauer Berg, Kreuzberg, Neukölln and Charlottenburg, not like a single Unter den Linden spa.",
    ],
  },
  "de-munich": {
    kicker: "Munich",
    title: "A monks’ settlement at the salt road",
    lede: "Munich — München — remembers the monks who sat on a salt-trading route. The court city that followed still books Thai massage around an Altstadt core and a trade-fair belt that fills hotels on rotation.",
    body: [
      "Henry the Lion’s 1158 market is the conventional founding. Alpine hinterland, beer gardens and a precise service culture produced a wellness market that expects credentials. Thai studios here compete with an established spa and physiotherapy scene; the ones that last keep traditional mat work rather than dissolving into a generic hotel massage.",
      "Alpine green and cream over the German layer mark the overlay. Fair weeks spike the searches. The page stays useful in the quiet months by talking to residents in Schwabing, Haidhausen and the city core.",
    ],
  },
  "de-hamburg": {
    kicker: "Hamburg",
    title: "A Hanseatic port that still thinks in harbours",
    lede: "Hamburg’s origin is a fortress on the Alster and the Elbe. The Hanseatic port that followed never stopped booking recovery for people who work strange hours.",
    body: [
      "Hammaburg was a ninth-century fort. The later free city lived on water: warehouses, the Speicherstadt, then HafenCity’s new brick and glass. Thai massage arrived into a town that already understood shift work and damp winters. Studios in the Innenstadt, St Pauli’s edges and the wealthier west serve different clocks.",
      "Brick-warehouse red on maritime navy is the overlay. The photography is the landing piers because Hamburg should not be illustrated with a generic Brandenburg Gate.",
    ],
  },
  "de-frankfurt": {
    kicker: "Frankfurt",
    title: "A ford on the Main, then a skyline of lunch hours",
    lede: "Frankfurt — the ford of the Franks — grew as a fair and coronation city on the Main. The towers are new. The lunch-hour booking is older than the towers.",
    body: [
      "A river crossing is the whole origin. Trade fairs made it wealthy; banking made it vertical. Thai massage in Frankfurt is a district product: a room you can reach from the banking core, the Hauptbahnhof belt or Sachsenhausen without losing the afternoon.",
      "Glass-skyline blue on the national grid is the overlay. Copy on this page talks about minutes, not weekends. That is the local truth.",
    ],
  },
  "de-cologne": {
    kicker: "Cologne",
    title: "A Roman colony on the Rhine",
    lede: "Cologne began as Colonia Claudia Ara Agrippinensium, a Roman colony. The cathedral and the river still organise the skyline, and Thai massage sits in the Innenstadt the way every other errand does — close, dense, walkable.",
    body: [
      "Rome’s colony on the Rhine became an ecclesiastical capital, then a carnival and media city. Visitor traffic around the Dom is real, but the listings that last serve residents in the Belgian Quarter, Ehrenfeld and Deutz as well as hotel guests who typed the city on a phone at the station.",
      "Cathedral stone and river silver over German gold mark the overlay. The photograph is the Rhine cranes and the old town, not a stock spa interior pretending to be Köln.",
    ],
  },
};

export function countryOrigin(code: string): OriginStory | null {
  return COUNTRY_ORIGINS[code] ?? null;
}

export function cityOrigin(countryCode: string, citySlug: string): OriginStory | null {
  return CITY_ORIGINS[`${countryCode}-${citySlug}`] ?? null;
}

export function originKeys(): string[] {
  return Object.keys(CITY_ORIGINS);
}
