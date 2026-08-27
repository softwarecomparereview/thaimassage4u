// Fills listings.image_url for every listing with no real photo, using the Google
// Maps hero photo via the google-maps-scraper actor's imageBackfill mode.
//
// Why: enrichment could only take og:image from a business's own site (~358 hits);
// the other ~800 listings render as gradient placeholders. Nearly every place has a
// Google hero photo, and the actor already knows how to read it off the place page.
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
  found.push(...results.filter(r => r.slug && typeof r.imageUrl === "string" && r.imageUrl.startsWith("https://")));
  console.log(`progress: ${found.length} images found so far`);
}

const esc = value => value.replace(/'/g, "''");
const lines = found.flatMap(row => [
  `UPDATE listings SET image_url = '${esc(row.imageUrl)}' WHERE slug = '${esc(row.slug)}' AND (image_url IS NULL OR image_url = '' OR image_url = '/images/hero.svg');`,
  `UPDATE qh_listings SET image_url = '${esc(row.imageUrl)}' WHERE slug = '${esc(row.slug)}' AND (image_url IS NULL OR image_url = '' OR image_url = '/images/hero.svg');`,
]);
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Done: ${found.length} images; SQL written to ${outPath}`);
