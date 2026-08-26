// One-shot deploy of apify-actor/google-maps-scraper to this Apify account as a private actor,
// then triggers a build and waits for it to finish. Safe to re-run — updates the existing actor
// (matched by name) with a new version instead of creating a duplicate.
//
// Usage: APIFY_TOKEN=xxx node scripts/deploy-custom-actor.mjs

import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) { console.error("APIFY_TOKEN not set"); process.exit(1); }

const ACTOR_NAME = "quiet-hour-google-maps-scraper";
const ROOT = new URL("../apify-actor/google-maps-scraper", import.meta.url).pathname;

function listFiles(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out = out.concat(listFiles(full));
    else out.push(full);
  }
  return out;
}

const files = listFiles(ROOT);
const sourceFiles = files.map(full => ({
  name: relative(ROOT, full).split("\\").join("/"),
  format: "TEXT",
  content: readFileSync(full, "utf8"),
}));
console.log("Packing files:", sourceFiles.map(f => f.name).join(", "));

async function apiFetch(path, opts = {}) {
  const res = await fetch(`https://api.apify.com/v2${path}`, {
    ...opts,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...(opts.headers || {}) },
  });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = body; }
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  return json;
}

async function findExistingActor() {
  const list = await apiFetch(`/acts?my=1&limit=100`);
  return list.data.items.find(a => a.name === ACTOR_NAME) ?? null;
}

async function main() {
  const existing = await findExistingActor();
  const versionBody = {
    versionNumber: "0.1",
    sourceType: "SOURCE_FILES",
    sourceFiles,
  };

  let actorId;
  if (existing) {
    actorId = existing.id;
    console.log(`Actor exists (${actorId}), updating version 0.1…`);
    await apiFetch(`/acts/${actorId}/versions/0.1`, {
      method: "PUT",
      body: JSON.stringify(versionBody),
    }).catch(async () => {
      // version doesn't exist yet on this actor — create it
      await apiFetch(`/acts/${actorId}/versions`, { method: "POST", body: JSON.stringify(versionBody) });
    });
  } else {
    console.log("Creating new actor…");
    const created = await apiFetch(`/acts`, {
      method: "POST",
      body: JSON.stringify({ name: ACTOR_NAME, versions: [versionBody] }),
    });
    actorId = created.data.id;
  }
  console.log("Actor ID:", actorId);

  await apiFetch(`/acts/${actorId}`, {
    method: "PUT",
    body: JSON.stringify({ defaultRunOptions: { timeoutSecs: 1800, memoryMbytes: 2048, build: "latest" } }),
  }).catch(error => console.warn("Couldn't set default run options (non-fatal):", error.message));

  console.log("Starting build…");
  const build = await apiFetch(`/acts/${actorId}/builds?version=0.1&waitForFinish=1`, { method: "POST" });
  const buildData = build.data;
  console.log("Build status:", buildData.status, "id:", buildData.id);
  if (buildData.status !== "SUCCEEDED") {
    const log = await fetch(`https://api.apify.com/v2/actor-builds/${buildData.id}/log`, { headers: { authorization: `Bearer ${TOKEN}` } }).then(r => r.text());
    console.error("BUILD LOG (tail):\n" + log.slice(-4000));
    process.exit(1);
  }
  console.log(`\nDeployed OK. Actor ID: ${actorId}\nUse this as ACTOR = "${actorId}" (or "${ACTOR_NAME}" by name).`);
}

main().catch(error => { console.error(error); process.exit(1); });
