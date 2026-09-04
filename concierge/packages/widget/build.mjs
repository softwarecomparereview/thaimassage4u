// Bundles packages/widget/src/main.ts -> dist/concierge.js as a single IIFE, no external deps
// (esbuild inlines @concierge/core since it's workspace TS, not a real npm package). Budget:
// <=40 KB gzipped per the brief.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/concierge.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  legalComments: "none",
});

const bytes = readFileSync("dist/concierge.js");
const gzipped = gzipSync(bytes).length;
console.log(`[concierge-widget] ${bytes.length} bytes raw, ${(gzipped / 1024).toFixed(1)} KB gzipped`);
if (gzipped > 40 * 1024) {
  console.error(`[concierge-widget] OVER BUDGET: ${(gzipped / 1024).toFixed(1)} KB > 40 KB gzip target`);
  process.exitCode = 1;
}
