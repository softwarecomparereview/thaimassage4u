#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/images");
const UA = "ThaiMassageForU/1.0 (https://thaimassageforu.com; hello@thaimassageforu.com) photo-ingest";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "image/*,application/json" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function wikiThumb(title, size = 1280) {
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("prop", "pageimages");
  api.searchParams.set("piprop", "thumbnail");
  api.searchParams.set("pithumbsize", String(size));
  api.searchParams.set("titles", title);
  const res = await fetch(api, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`wiki ${res.status} ${title}`);
  const json = await res.json();
  const page = Object.values(json.query.pages)[0];
  const src = page?.thumbnail?.source;
  if (!src) throw new Error(`no thumbnail for ${title}`);
  return src;
}

async function commonsThumb(filename, width = 1280) {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("titles", `File:${filename}`);
  api.searchParams.set("prop", "imageinfo");
  api.searchParams.set("iiprop", "url|mime");
  api.searchParams.set("iiurlwidth", String(width));
  const res = await fetch(api, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`commons ${res.status} ${filename}`);
  const json = await res.json();
  const page = Object.values(json.query.pages)[0];
  const info = page?.imageinfo?.[0];
  const src = info?.thumburl || info?.url;
  if (!src) throw new Error(`no commons url for ${filename}`);
  return src;
}

async function save(path, url) {
  const buf = await fetchBuf(url);
  if (buf.length < 12_000) throw new Error(`tiny ${url} ${buf.length}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  console.log("ok", path.replace(root, ""), Math.round(buf.length / 1024) + "kb");
}

const retries = [
  ["cities/de.jpg", () => wikiThumb("Brandenburg Gate", 1280)],
  ["cities/us.jpg", () => wikiThumb("Statue of Liberty", 1280)],
  ["cities/uk.jpg", () => wikiThumb("Palace of Westminster", 1280)],
  ["cities/au.jpg", () => wikiThumb("Sydney Opera House", 1280)],
  ["cities/au-perth.jpg", () => wikiThumb("Perth", 1100)],
  ["cities/au-adelaide.jpg", () => wikiThumb("Adelaide", 1100)],
  ["cities/de-berlin.jpg", () => wikiThumb("Berlin", 1100)],
  ["cities/de-munich.jpg", () => wikiThumb("Munich", 1100)],
  ["cities/de-hamburg.jpg", () => wikiThumb("Hamburg", 1100)],
  ["cities/de-cologne.jpg", () => wikiThumb("Cologne", 1100)],
];

const spa = [
  ["spa/spa-7.jpg", "https://images.unsplash.com/photo-1600618528240-fb9fc964b853?auto=format&fit=crop&w=1400&q=78"],
  ["spa/spa-9.jpg", "https://images.unsplash.com/photo-1519823551278-64ac92734fb4?auto=format&fit=crop&w=1400&q=78"],
  ["spa/spa-10.jpg", "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=70"],
  ["spa/spa-13.jpg", "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=900&q=70"],
  ["spa/hero.jpg", "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1800&q=80"],
];

const commonsFallback = [
  ["cities/au-perth.jpg", "Perth_skyline.jpg"],
  ["cities/au-adelaide.jpg", "Adelaide_CBD.jpg"],
  ["cities/de-berlin.jpg", "Berlin_skyline_2017.jpg"],
  ["cities/de-munich.jpg", "Munich_skyline.jpg"],
  ["cities/de-hamburg.jpg", "Speicherstadt_Hamburg.jpg"],
  ["cities/de-cologne.jpg", "Cologne_Cathedral.jpg"],
];

for (const [rel, getter] of retries) {
  const path = join(outDir, rel);
  if (existsSync(path) && statSync(path).size > 40_000) {
    console.log("have", rel);
    continue;
  }
  try {
    await sleep(900);
    const url = await getter();
    await sleep(400);
    await save(path, url);
  } catch (error) {
    console.error("retry fail", rel, error.message);
  }
}

for (const [rel, file] of commonsFallback) {
  const path = join(outDir, rel);
  if (existsSync(path) && statSync(path).size > 40_000) continue;
  try {
    await sleep(1200);
    const url = await commonsThumb(file, 1200);
    await sleep(400);
    await save(path, url);
  } catch (error) {
    console.error("commons fail", rel, file, error.message);
  }
}

for (const [rel, url] of spa) {
  const path = join(outDir, rel);
  if (existsSync(path) && statSync(path).size > 20_000) {
    console.log("have", rel);
    continue;
  }
  try {
    await save(path, url);
  } catch (error) {
    console.error("spa fail", rel, error.message);
  }
}
