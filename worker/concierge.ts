// Mirrors concierge/packages/worker/src/index.ts — kept as a small local copy rather than a
// cross-directory import so the Worker bundle doesn't depend on a path outside worker/. See
// that file (and the concierge/ build brief, §8-9) for the full design notes; this is the
// production wiring of the same two handlers.
//
// Static shard/manifest/taxonomy/flow files need no route here: they ship under
// client/public/concierge/ and the existing asset-serving fallback (isAssetPath in
// worker/ssr.tsx) already matches any .json/.js path.

import type { Env } from "./index";

interface ConciergeEventPayload {
  site: string;
  sid: string;
  ev: string;
  data?: Record<string, unknown>;
  ts?: number;
}

/** §9: logs every widget event for the funnel/demand-report views (worker/migrations/0016). Never
 * blocks the widget — a failure here is swallowed here, and the widget's own fetch is fire-and-forget. */
export async function handleConciergeEvent(request: Request, env: Env): Promise<Response> {
  let payload: ConciergeEventPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!payload.site || !payload.sid || !payload.ev) return Response.json({ ok: false }, { status: 400 });
  try {
    await env.DB.prepare("INSERT INTO concierge_events (site, sid, ev, data) VALUES (?, ?, ?, ?)")
      .bind(payload.site, payload.sid, payload.ev, JSON.stringify(payload.data ?? {}))
      .run();
  } catch (error) {
    console.error("[concierge] event log failed", error);
  }
  return Response.json({ ok: true });
}

/**
 * §8 /api/concierge/parse — the only runtime LLM surface in this system, and it is NOT wired up
 * yet (P1 scope; P0 is explicitly no-LLM per the build brief's own phase definition). Returning
 * a confident empty response here means the widget's hybrid trigger falls back to its own
 * deterministic parse every time — safe by design, not broken.
 */
export async function handleConciergeParse(): Promise<Response> {
  return Response.json({ slots: {}, confidence: 0, cached: false });
}
