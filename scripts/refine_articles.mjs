import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const apiUrl = "https://overpayingforai.com/api/content-quality";
const sourceDir = "/home/ubuntu/quiet-hour-wellness-redesign/content/articles";
const outputDir = "/home/ubuntu/quiet-hour-wellness-redesign/content/articles-refined";
const reportPath = "/home/ubuntu/quiet-hour-wellness-redesign/content/content-quality-report.json";
const apiKey = process.env.CONTENT_QUALITY_API_KEY;

if (!apiKey) throw new Error("CONTENT_QUALITY_API_KEY is required.");

function splitFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Article is missing expected frontmatter.");
  const fields = Object.fromEntries(match[1].split("\n").map(line => {
    const index = line.indexOf(":");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  return { fields, body: match[2].trim() };
}

function toFrontmatter(fields) {
  return ["---", `title: ${fields.title}`, `slug: ${fields.slug}`, `topic: ${fields.topic}`, `meta_description: ${fields.meta_description}`, "status: draft", "quality_reviewed: true", "---", ""].join("\n");
}

function applySafeChanges(body, changes) {
  let refined = body;
  const accepted = [];
  for (const change of Array.isArray(changes) ? changes : []) {
    if (change?.kind !== "replace" || typeof change.before !== "string" || typeof change.after !== "string") continue;
    if (!change.before || !refined.includes(change.before)) continue;
    if (/https?:\/\//i.test(change.after) || /\$\d/.test(change.after)) continue;
    refined = refined.split(change.before).join(change.after);
    accepted.push({ id: change.id ?? "replace", reason: change.reason ?? "Language refinement" });
  }
  return { refined, accepted };
}

const files = (await readdir(sourceDir)).filter(file => file.endsWith(".md")).sort();
if (files.length !== 20) throw new Error(`Expected 20 article files; found ${files.length}.`);
await mkdir(outputDir, { recursive: true });
const report = [];

for (const file of files) {
  const original = await readFile(path.join(sourceDir, file), "utf8");
  const { fields, body } = splitFrontmatter(original);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      title: fields.title,
      body,
      pageType: "editorial",
      lastReviewedAt: new Date().toISOString().slice(0, 10),
      metaDescription: fields.meta_description,
      slug: fields.slug,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`${fields.slug}: API returned ${response.status}`);
  const payload = await response.json();
  if (!payload.ok || !payload.output?.body) throw new Error(`${fields.slug}: API response was incomplete.`);
  const { refined: refinedBody, accepted } = applySafeChanges(body, payload.changes);
  const refined = `${toFrontmatter(fields)}${refinedBody.trim()}\n`;
  await writeFile(path.join(outputDir, file), refined, "utf8");
  report.push({
    slug: fields.slug,
    titleBefore: fields.title,
    titleAfter: fields.title,
    before: payload.before ?? null,
    after: payload.after ?? null,
    changes: Array.isArray(payload.changes) ? payload.changes.length : 0,
    acceptedChanges: accepted,
    rewriter: payload.rewriter ?? null,
    modelInvoked: Boolean(payload.modelInvoked),
  });
  console.log(`Refined ${fields.slug}`);
}

await writeFile(reportPath, `${JSON.stringify({ engine: "desk-quality-v2", processedAt: new Date().toISOString(), articles: report }, null, 2)}\n`, "utf8");
console.log(`Refined ${report.length} articles.`);
