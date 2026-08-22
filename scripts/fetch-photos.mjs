#!/usr/bin/env node
/**
 * Download city photography (Wikipedia lead images) and spa interiors (Unsplash).
 * Wikipedia/Wikimedia content is used under CC licenses; Unsplash photos under the Unsplash License.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/images");
const UA = "ThaiMassageForU/1.0 (https://thaimassageforu.com; hello@thaimassageforu.com) photo-ingest";

const CITIES = {
  "us": "United States",
  "uk": "United Kingdom",
  "au": "Australia",
  "de": "Germany",
  "us-new-york": "New York City",
  "us-los-angeles": "Los Angeles",
  "us-chicago": "Chicago",
  "us-miami": "Miami",
  "us-san-francisco": "San Francisco",
  "us-las-vegas": "Las Vegas",
  "uk-london": "London",
  "uk-manchester": "Manchester",
  "uk-birmingham": "Birmingham",
  "uk-edinburgh": "Edinburgh",
  "uk-glasgow": "Glasgow",
  "uk-bristol": "Bristol",
  "au-melbourne": "Melbourne",
  "au-sydney": "Sydney",
  "au-brisbane": "Brisbane",
  "au-perth": "Perth",
  "au-adelaide": "Adelaide",
  "de-berlin": "Berlin",
  "de-munich": "Munich",
  "de-hamburg": "Hamburg",
  "de-frankfurt": "Frankfurt",
  "de-cologne": "Cologne",
};

const SPA = [
  ["spa-1.jpg", "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=78"],
  ["spa-2.jpg", "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1400&q=78"],
  ["spa-3.jpg", "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1400&q=78"],
  ["spa-4.jpg", "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1400&q=78"],
  ["spa-5.jpg", "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1400&q=78"],
  ["spa-6.jpg", "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=1400&q=78"],
  ["spa-7.jpg", "https://images.unsplash.com/photo-1552693673-1bf682506171?auto=format&fit=crop&w=1400&q=78"],
  ["spa-8.jpg", "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1400&q=78"],
  ["spa-9.jpg", "https://images.unsplash.com/photo-154055301672-83c8c1fc4d1e?auto=format&fit=crop&w=1400&q=78"],
  ["spa-10.jpg", "https://images.unsplash.com/photo-1616391182219-e080b4d52b37?auto=format&fit=crop&w=1400&q=78"],
  ["spa-11.jpg", "https://images.unsplash.com/photo-1519824145371-296894a0daa9?auto=format&fit=crop&w=1400&q=78"],
  ["spa-12.jpg", "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1400&q=78"],
];

async function fetchBuf(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "image/*,application/json" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
}

async function wikiThumb(title) {
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("prop", "pageimages");
  api.searchParams.set("piprop", "thumbnail");
  api.searchParams.set("pithumbsize", "1600");
  api.searchParams.set("titles", title);
  const res = await fetch(api, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`wiki ${res.status} ${title}`);
  const json = await res.json();
  const page = Object.values(json.query.pages)[0];
  const src = page?.thumbnail?.source;
  if (!src) throw new Error(`no thumbnail for ${title}`);
  return src;
}

async function save(path, url) {
  if (existsSync(path) && (await import("node:fs")).statSync(path).size > 20_000) {
    console.log("skip", path);
    return;
  }
  const { buf } = await fetchBuf(url);
  if (buf.length < 8_000) throw new Error(`tiny file ${url} ${buf.length}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  console.log("ok", path.replace(root, ""), Math.round(buf.length / 1024) + "kb");
}

const credits = [];

await mkdir(join(outDir, "cities"), { recursive: true });
await mkdir(join(outDir, "spa"), { recursive: true });

for (const [key, title] of Object.entries(CITIES)) {
  try {
    const src = await wikiThumb(title);
    await save(join(outDir, "cities", `${key}.jpg`), src);
    credits.push({ file: `cities/${key}.jpg`, source: "Wikipedia / Wikimedia Commons", title, url: src.split("/").slice(0, 3).join("/") });
  } catch (error) {
    console.error("city fail", key, title, error.message);
  }
}

for (const [name, url] of SPA) {
  try {
    await save(join(outDir, "spa", name), url);
    credits.push({ file: `spa/${name}`, source: "Unsplash License", url });
  } catch (error) {
    console.error("spa fail", name, error.message);
  }
}

await writeFile(join(outDir, "photo-credits.json"), JSON.stringify(credits, null, 2));
console.log("done", credits.length, "files");
