# Instructions for coding and autonomous agents

This repository is the ThaiMassageForU site (`thaimassageforu.com`): a React client, a Node server for local development, and the `thaimassageforu` Cloudflare Worker (`worker/`, `wrangler.jsonc`). Verify with `pnpm test` and `pnpm check` before every push; `pnpm run worker:check` builds the Worker and dry-runs its deploy.

## The rule that overrides everything else: agent work runs in Pilot My Life, not here

Every scheduled, recurring or autonomous job for this venture belongs in **Pilot My Life**
(`softwarecomparereview/pilotmylife`, the portfolio's shared operating platform at
pilotmylife.com): audits, checks, monitors, sweeps, scrapes, enrichment, digests, pings,
alerts. There it gets a run record, a trace, a buddy check, a cost line and a place on the
control room. This repository holds the site: request-time code, build-time scripts that read
Pilot My Life's published datasets, and scripts a person runs by hand.

Never add here, under any name:

- a Cloudflare Cron Trigger (`crons` in `wrangler.*`) or another `scheduled()` handler
- a GitHub Actions workflow, and never one on a `schedule:`
- a Worker, Durable Object alarm, Queue consumer or route that polls, audits, monitors,
  rewrites or publishes on its own timer or judgement
- a "watchdog", "freshness guard", "autopilot" or "agent" that runs without a person starting it

The jobs this repository already runs on its own are frozen in `worker/agent-work.test.ts` exactly as
they were on 2026-11-08 (three crons and the one `scheduled()` handler in `worker/index.ts`: listing enrichment every 15 minutes, supplies offers daily; the Queue and Email handlers answer events and are not frozen jobs). That test fails on anything new. Do not extend the
lists: build the job as a Pilot My Life workflow that publishes a dataset or calls an endpoint
here. When a frozen job moves to Pilot My Life, delete it here and from the list.

Why: on 2026-11-08 the account had 24 Workers running their own crons, each
with its own rules, none visible on one control room, and several running daily for weeks
while producing nothing (OverpayingForAI's freshness Worker found nothing for its last two
months). OverpayingForAI's repository carries the same rule (its `CLAUDE.md`).
