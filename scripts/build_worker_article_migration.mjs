import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const inputDir = path.join(projectRoot, "content", "articles-refined");
const outputPath = path.join(projectRoot, "worker", "migrations", "0002_quiet_hour_article_drafts.sql");

const quote = value => `'${String(value ?? "").replaceAll("'", "''")}'`;
const records = fs.readdirSync(inputDir)
  .filter(file => file.endsWith(".md"))
  .sort()
  .map(file => fs.readFileSync(path.join(inputDir, file), "utf8"));

const statements = records.map(markdown => {
  const [, rawFrontmatter = "", body = ""] = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  const fields = Object.fromEntries(rawFrontmatter.split("\n").map(line => {
    const pivot = line.indexOf(":");
    return pivot === -1 ? [line.trim(), ""] : [line.slice(0, pivot).trim(), line.slice(pivot + 1).trim()];
  }));
  const title = fields.title || "Untitled article";
  const slug = fields.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const topic = fields.topic || "Wellness";
  const excerpt = fields.meta_description || body.replace(/^#.*\n+/, "").trim().slice(0, 360);
  return `INSERT OR IGNORE INTO qh_articles (title, slug, excerpt, body, topic, status) VALUES (${quote(title)}, ${quote(slug)}, ${quote(excerpt)}, ${quote(body)}, ${quote(topic)}, 'review');`;
});

fs.writeFileSync(outputPath, `-- Generated from content/articles-refined. Records remain review-ready for CMS approval.\n${statements.join("\n")}\n`);
console.log(`Wrote ${records.length} article records to ${outputPath}`);
