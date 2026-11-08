import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Agent work runs in Pilot My Life, not in this repository (AGENTS.md). Every scheduled,
 * recurring or autonomous job for this venture belongs in softwarecomparereview/pilotmylife,
 * where it gets a run record, a trace, a buddy check and a place on the control room.
 *
 * The jobs this repository already runs on its own are frozen below as they were on
 * 2026-11-08, until each moves to Pilot My Life. This test fails on anything new: another
 * Cron Trigger, another scheduled() handler, another GitHub Actions workflow, or any
 * workflow on a schedule. To move a job out, delete it here and from the list. Never add
 * to these lists: build the job in Pilot My Life instead.
 */
const FROZEN_CRONS: readonly string[] = ["15 */6 * * *", "20 6 * * *", "*/15 * * * *"];
const FROZEN_SCHEDULED_HANDLERS: readonly string[] = ["worker/index.ts"];
const FROZEN_WORKFLOWS: readonly string[] = [];

const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".git", "dist", ".wrangler", "coverage"]);
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (SKIP.has(e.name) ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const files = walk(ROOT);
const rel = (f: string) => relative(ROOT, f).split("\\").join("/");

describe("agent work runs in Pilot My Life, not here", () => {
  it("adds no Cron Trigger beyond the frozen list", () => {
    const crons = files
      .filter((f) => /(^|\/)wrangler\.(toml|jsonc?)$/.test(rel(f)))
      .flatMap((f) => {
        const text = readFileSync(f, "utf8").replace(/^\s*(#|\/\/).*$/gm, "");
        const block = /crons\s*[=:]\s*\[([^\]]*)\]/.exec(text)?.[1] ?? "";
        return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
      });
    expect(crons.filter((c) => !FROZEN_CRONS.includes(c)), "new Cron Triggers: build the job in Pilot My Life (AGENTS.md)").toEqual([]);
  });

  it("adds no scheduled() handler beyond the frozen list", () => {
    const handlers = files
      .filter((f) => /\.(ts|js|mjs)$/.test(f) && !/\.test\.|\.spec\./.test(f))
      .filter((f) => /^\s*(async\s+)?scheduled\s*\(/m.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(handlers.filter((h) => !FROZEN_SCHEDULED_HANDLERS.includes(h)), "new scheduled() handlers: build the job in Pilot My Life (AGENTS.md)").toEqual([]);
  });

  it("adds no GitHub Actions workflow, and none runs on a schedule", () => {
    const workflows = files.filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(rel(f)));
    expect(workflows.map(rel).filter((w) => !FROZEN_WORKFLOWS.includes(w)), "new GitHub Actions workflows: build the job in Pilot My Life (AGENTS.md)").toEqual([]);
    expect(workflows.filter((w) => /^\s*schedule\s*:/m.test(readFileSync(w, "utf8"))).map(rel), "scheduled workflows are not allowed").toEqual([]);
  });
});
