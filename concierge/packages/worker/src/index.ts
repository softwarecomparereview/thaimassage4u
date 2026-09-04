// §8 worker routes, mounted into the site's existing Worker (see worker/index.ts's
// `app.route()` call for thaimassageforu). Static shard/manifest/taxonomy/flow serving needs
// no route here — they ship under client/public/concierge/ and the existing asset-serving
// fallback (isAssetPath in worker/ssr.tsx) already matches any .json/.js path. This package is
// only the two POST endpoints that need server logic: events, and (P1, stubbed) parse.

export interface ConciergeEnv {
  DB: D1Database;
}

interface EventPayload {
  site: string;
  sid: string;
  ev: string;
  data?: Record<string, unknown>;
  ts?: number;
}

/** §9: logs every widget event for the funnel/demand-report views. Never blocks the widget — a
 * failure here is swallowed by the caller (packages/widget's fireEvent uses keepalive + .catch). */
export async function handleConciergeEvent(request: Request, env: ConciergeEnv): Promise<Response> {
  let payload: EventPayload;
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
    // Table not migrated yet, or a transient D1 error — the widget never learns either way.
    console.error("[concierge] event log failed", error);
  }
  return Response.json({ ok: true });
}

/**
 * §8 /api/concierge/parse — the ONLY runtime LLM surface in this system, and it is not wired
 * up yet. This is P1 scope (the brief's own phase definition: "P1 — Hybrid + events"); P0 is
 * explicitly no-LLM. Returning a confident "no slots" response here means the widget's hybrid
 * trigger (packages/core's stepAsync) falls back to the deterministic parser's own result
 * every time, per its own "never blocks" contract — this endpoint existing but doing nothing
 * yet is safe, not broken.
 */
export async function handleConciergeParse(): Promise<Response> {
  return Response.json({ slots: {}, confidence: 0, cached: false });
}
