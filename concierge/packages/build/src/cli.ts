#!/usr/bin/env node
// `concierge-build --site sites/quiet-hour --out ../../client/public/concierge [--no-llm]`
// §5 the full pipeline, steps 1-2, 4-10 (step 3, LLM-tag-the-remainder, is P1 — see tag.ts).

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { IndexListing, IndexManifest, ManifestPlace } from "@concierge/core";
import { d1ConfigFromEnv } from "./d1.js";
import { extractQuietHour } from "./adapters/quiet-hour.js";
import { computePriceBands, toIndexListing, type Override } from "./tag.js";

const SMALL_CITY_THRESHOLD = 30;

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { args[key] = next; i++; } else { args[key] = true; }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteDir = resolve(String(args.site ?? "sites/quiet-hour"));
  const outDir = resolve(String(args.out ?? join(siteDir, "dist")));
  const noLlm = Boolean(args["no-llm"]) || true; // P1 not implemented yet — always true today, see tag.ts

  const siteName = siteDir.split("/").pop()!;
  const taxonomyModule = await import(pathToFileURL(join(siteDir, "taxonomy.ts")).href);
  const taxonomy = taxonomyModule.taxonomy;

  const overridePath = join(siteDir, "vocab.overrides.json");
  const override: Override = existsSync(overridePath) ? JSON.parse(readFileSync(overridePath, "utf8")) : {};

  console.log(`[concierge-build] extracting ${siteName} from D1...`);
  const config = d1ConfigFromEnv();
  const { listings: rawListings, places: rawPlaces } = await extractQuietHour(config);
  console.log(`[concierge-build] ${rawListings.length} published listings, ${rawPlaces.length} cities`);

  const priceBands = computePriceBands(rawListings);
  const cityNameBySlug = new Map(rawPlaces.map(p => [p.slug, p.name]));

  const indexListings: IndexListing[] = rawListings.map(raw =>
    toIndexListing(raw, taxonomy, cityNameBySlug.get(raw.city_slug) ?? raw.city_slug, priceBands, override),
  );

  // §5 step 9: shard per city; cities under the threshold collapse into a per-country shard.
  const byCity = new Map<string, IndexListing[]>();
  for (const listing of indexListings) {
    if (!byCity.has(listing.city)) byCity.set(listing.city, []);
    byCity.get(listing.city)!.push(listing);
  }
  const shardNameForCity = (citySlug: string, count: number, country: string) => (count >= SMALL_CITY_THRESHOLD ? citySlug : `country-${country}`);

  const shards = new Map<string, IndexListing[]>();
  const placeShardName = new Map<string, string>();
  for (const [city, cityListings] of byCity) {
    const country = cityListings[0].country;
    const shardName = shardNameForCity(city, cityListings.length, country);
    placeShardName.set(city, shardName);
    if (!shards.has(shardName)) shards.set(shardName, []);
    shards.get(shardName)!.push(...cityListings);
  }

  mkdirSync(join(outDir, "shards"), { recursive: true });
  const builtAt = new Date().toISOString();
  let totalBytes = 0;
  for (const [shardName, shardListings] of shards) {
    const payload = JSON.stringify({ site: siteName, shard: shardName, builtAt, listings: shardListings });
    writeFileSync(join(outDir, "shards", `${shardName}.json`), payload);
    totalBytes += Buffer.byteLength(payload);
  }

  const places: ManifestPlace[] = [...byCity.entries()].map(([citySlug, cityListings]) => {
    const raw = rawPlaces.find(p => p.slug === citySlug);
    const band = priceBands.get(citySlug);
    return {
      slug: citySlug,
      name: cityNameBySlug.get(citySlug) ?? citySlug,
      country: cityListings[0].country,
      shard: placeShardName.get(citySlug)!,
      count: cityListings.length,
      lat: raw?.lat ?? 0,
      lon: raw?.lng ?? 0,
      aliases: aliasesFor(citySlug, cityNameBySlug.get(citySlug) ?? citySlug),
      ...(band ? { priceBands: { p33: band.p33, p66: band.p66, currency: cityListings[0].currency ?? "USD" } } : {}),
    };
  });

  const manifest: IndexManifest = { site: siteName, builtAt, version: 1, places, taxonomy };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(join(outDir, "taxonomy.json"), JSON.stringify(taxonomy));

  const flowFiles = ["flow.en.json", "flow.th.json", "flow.zh.json"].filter(f => existsSync(join(siteDir, f)));
  for (const flowFile of flowFiles) writeFileSync(join(outDir, flowFile), readFileSync(join(siteDir, flowFile)));

  writeBuildReport(siteDir, indexListings, taxonomy);

  console.log(`[concierge-build] wrote ${shards.size} shard(s), ${places.length} places, ${indexListings.length} listings.`);
  console.log(`[concierge-build] total shard payload: ${(totalBytes / 1024).toFixed(1)} KB (uncompressed)`);
  if (noLlm) console.log(`[concierge-build] --no-llm: step 3 (LLM tag-the-remainder) skipped — every facet here is a real synonym hit or an override.`);
}

function aliasesFor(slug: string, name: string): string[] {
  const aliases = new Set<string>([name.toLowerCase(), slug.replace(/-/g, " ")]);
  const KNOWN: Record<string, string[]> = {
    "new-york": ["nyc", "new york city", "manhattan"],
    "los-angeles": ["la", "los angeles"],
    "san-francisco": ["sf", "san fran"],
    "las-vegas": ["vegas"],
  };
  for (const alias of KNOWN[slug] ?? []) aliases.add(alias);
  return [...aliases];
}

function writeBuildReport(siteDir: string, listings: IndexListing[], taxonomy: { facets: { key: string }[] }) {
  const lines: string[] = ["# Concierge build report", ""];
  const byCity = new Map<string, IndexListing[]>();
  for (const listing of listings) {
    if (!byCity.has(listing.city)) byCity.set(listing.city, []);
    byCity.get(listing.city)!.push(listing);
  }
  lines.push("## Facet coverage per city", "", "| City | Listings | " + taxonomy.facets.map(f => f.key).join(" | ") + " | No facets |", "|---|---|" + taxonomy.facets.map(() => "---").join("|") + "|---|");
  for (const [city, cityListings] of [...byCity.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const counts = taxonomy.facets.map(f => cityListings.filter(l => l.facets[f.key]?.length).length);
    const none = cityListings.filter(l => Object.keys(l.facets).length === 0).length;
    lines.push(`| ${city} | ${cityListings.length} | ${counts.join(" | ")} | ${none} |`);
  }
  const thin = listings.filter(l => l.completeness < 0.4);
  lines.push("", `## ${thin.length} listings with completeness < 0.4 (enrichment backlog)`, "");
  for (const listing of thin.slice(0, 200)) lines.push(`- ${listing.slug} (${listing.city}) — completeness ${listing.completeness.toFixed(2)}`);
  writeFileSync(join(siteDir, "build-report.md"), lines.join("\n"));
}

main().catch(error => {
  console.error("[concierge-build] failed:", error);
  process.exitCode = 1;
});
