import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = "/home/ubuntu/draft_wellness_articles.json";
const targetDir = "/home/ubuntu/quiet-hour-wellness-redesign/content/articles";
const manifestPath = "/home/ubuntu/quiet-hour-wellness-redesign/content/article-collection.md";

const source = JSON.parse(await readFile(sourcePath, "utf8"));
await mkdir(targetDir, { recursive: true });

const indexLines = [
  "# Quiet Hour Article Collection",
  "",
  "Twenty original CMS-ready draft articles. Each article has general-wellness framing and a medical caution where appropriate; editorial review remains required before publication.",
  "",
  "| # | Title | Topic | Slug |",
  "| --- | --- | --- | --- |",
];

for (const [index, item] of source.results.entries()) {
  if (item.error) throw new Error(`Article task failed: ${item.input}: ${item.error}`);
  const [, slug, topic] = item.input.split(" | ");
  const response = await fetch(item.output.article_file);
  if (!response.ok) throw new Error(`Could not download ${slug}: ${response.status}`);
  const article = await response.text();
  await writeFile(path.join(targetDir, `${slug}.md`), article, "utf8");
  indexLines.push(`| ${String(index + 1).padStart(2, "0")} | ${item.output.title.replaceAll("|", "\\|")} | ${topic} | ${slug} |`);
}

await writeFile(manifestPath, `${indexLines.join("\n")}\n`, "utf8");
console.log(`Imported ${source.results.length} articles to ${targetDir}`);
