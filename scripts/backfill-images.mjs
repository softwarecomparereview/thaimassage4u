// Fills listings.image_url, .hours and .phone for listings missing them, using the
// Google Maps hero photo / opening-hours table / phone button via the
// google-maps-scraper actor's imageBackfill mode — one page visit gets all three.
//
// Why: enrichment could only take og:image from a business's own site (~358 hits);
// the other ~800 listings render as gradient placeholders. Separately, every
// published listing has no `hours` on file at all (see 0017_listing_hours.sql —
// the AI enrichment rewrite used to silently destroy them out of `description`).
// Nearly every place has all three on Google, and the actor already knows how to
// read them off the place page.
//
// Input rows come in via a JSON file (exported from D1 by the caller — see usage in
// the repo's session notes): [{slug, name, city, place_id}]. place_id in the stored
// "0x..:0x.." CID form becomes a decimal cid for a direct maps.google.com/?cid= hit;
// rows without one fall back to a name+city search.
//
// Usage: APIFY_TOKEN=... node scripts/backfill-images.mjs <rows.json> <out.sql>

import { readFileSync, writeFileSync } from "node:fs";

const TOKEN = process.env.APIFY_TOKEN;
const ACTOR = "0wvCeRnRcrfUKYm5q";
const [, , rowsPath, outPath] = process.argv;
if (!TOKEN || !rowsPath || !outPath) {
  console.error("Usage: APIFY_TOKEN=... node scripts/backfill-images.mjs <rows.json> <out.sql>");
  process.exit(1);
}

const rows = JSON.parse(readFileSync(rowsPath, "utf8"));
const items = rows.map(row => {
  const match = typeof row.place_id === "string" ? row.place_id.match(/^0x[0-9a-f]+:(0x[0-9a-f]+)$/i) : null;
  return {
    slug: row.slug,
    cid: match ? BigInt(match[1]).toString() : undefined,
    query: match ? undefined : `${row.name} ${row.city ?? ""} massage`.trim(),
  };
});
console.log(`Backfilling ${items.length} listings (${items.filter(i => i.cid).length} via cid, rest via search).`);

const CHUNK = 120;

async function runChunk(chunk, index) {
  const start = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ imageBackfill: chunk }),
  });
  if (!start.ok) throw new Error(`run start failed: HTTP ${start.status}`);
  const { data: run } = await start.json();
  let status = run.status;
  let datasetId = run.defaultDatasetId;
  const deadline = Date.now() + 35 * 60 * 1000;
  while (!["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(status) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    const poll = await (await fetch(`https://api.apify.com/v2/actor-runs/${run.id}`, { headers: { authorization: `Bearer ${TOKEN}` } })).json();
    status = poll.data.status;
    datasetId = poll.data.defaultDatasetId;
  }
  console.log(`chunk ${index}: ${status}`);
  if (status !== "SUCCEEDED") return [];
  return (await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=1000`, { headers: { authorization: `Bearer ${TOKEN}` } })).json());
}

const found = [];
for (let i = 0; i < items.length; i += CHUNK) {
  const results = await runChunk(items.slice(i, i + CHUNK), 1 + i / CHUNK);
  // A row can carry any subset of the three facts — keep it if it found at least one.
  found.push(...results.filter(r => r.slug && (
    (typeof r.imageUrl === "string" && r.imageUrl.startsWith("https://")) ||
    (Array.isArray(r.openingHours) && r.openingHours.length) ||
    typeof r.phone === "string"
  )));
  console.log(`progress: ${found.length} rows with at least one fact found so far`);
}

const esc = value => value.replace(/'/g, "''");
// Each fact is written independently and only into a currently-empty column — this can run
// against already-enriched listings with zero interaction with worker/enrichment.ts, and a row
// missing one fact (e.g. no phone button on the page) still writes the others it did find.
const lines = found.flatMap(row => {
  const statements = [];
  if (typeof row.imageUrl === "string" && row.imageUrl.startsWith("https://")) {
    statements.push(`UPDATE listings SET image_url = '${esc(row.imageUrl)}' WHERE slug = '${esc(row.slug)}' AND (image_url IS NULL OR image_url = '' OR image_url = '/images/hero.svg');`);
    statements.push(`UPDATE qh_listings SET image_url = '${esc(row.imageUrl)}' WHERE slug = '${esc(row.slug)}' AND (image_url IS NULL OR image_url = '' OR image_url = '/images/hero.svg');`);
  }
  if (Array.isArray(row.openingHours) && row.openingHours.length) {
    statements.push(`UPDATE listings SET hours = '${esc(JSON.stringify(row.openingHours))}' WHERE slug = '${esc(row.slug)}' AND hours IS NULL;`);
  }
  if (typeof row.phone === "string" && row.phone) {
    statements.push(`UPDATE listings SET phone = '${esc(row.phone)}' WHERE slug = '${esc(row.slug)}' AND (phone IS NULL OR phone = '');`);
  }
  return statements;
});
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Done: ${found.length} rows with at least one fact; SQL written to ${outPath}`);
