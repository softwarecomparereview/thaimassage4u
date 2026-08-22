import { Hono } from "hono";
import { adminPassword, hasValidSession } from "./lib/session";
import { mediaGet, mediaPut } from "./lib/storage";
import { escapeAttr, escapeHtml } from "./lib/escape";

type AppEnv = { Bindings: Env };

type ReviewRow = {
  id: string;
  title: string;
  prompt: string | null;
  provider: string | null;
  source_url: string | null;
  r2_key: string;
  content_type: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "RELEASED";
  adult_confirmed: number;
  consent_confirmed: number;
  legal_confirmed: number;
  platform_confirmed: number;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  released_at: string | null;
};

type NoteRow = { id: number; video_id: string; time_seconds: number; note: string; created_at: string };

function page(title: string, body: string): Response {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} · Private Video Review</title><style>
  :root{color-scheme:dark;--bg:#080b0f;--panel:#111720;--line:#263342;--text:#e7eef6;--dim:#8da0b4;--ok:#72d39b;--bad:#ff7f7f;--warn:#efbe62}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}.top{position:sticky;top:0;z-index:5;background:#0d131a;border-bottom:1px solid var(--line);padding:12px 18px;display:flex;justify-content:space-between;align-items:center;gap:16px}.top a{color:#90c8ff}.wrap{width:min(1180px,calc(100% - 28px));margin:22px auto 60px}.grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,.8fr);gap:18px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}.video{width:100%;max-height:68vh;background:#000;border-radius:10px}.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:4px 9px;font-size:11px}.PENDING_REVIEW{color:var(--warn)}.APPROVED,.RELEASED{color:var(--ok)}.REJECTED{color:var(--bad)}label{display:block;margin:10px 0 4px;color:var(--dim)}input,textarea,button{font:inherit}input[type=text],input[type=number],textarea{width:100%;background:#0c1219;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px}.checks{display:grid;gap:8px;margin:12px 0}.row{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid var(--line);background:#182332;color:var(--text);padding:9px 12px;border-radius:8px;cursor:pointer}.btn.ok{background:#153325;border-color:#2d6a4c}.btn.bad{background:#3b1d1d;border-color:#6e3232}.note{border-top:1px solid var(--line);padding:10px 0}.muted{color:var(--dim)}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid var(--line);padding:10px 8px}a{color:#90c8ff;text-decoration:none}@media(max-width:820px){.grid{grid-template-columns:1fr}}
  </style></head><body><div class="top"><div><strong>Private Video Review</strong><div class="muted">noindex · nofollow · admin gated</div></div><div><a href="/">Inbox</a> · <a href="/admin">Main admin</a></div></div><div class="wrap">${body}</div></body></html>`,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"private, no-store, max-age=0","x-robots-tag":"noindex, nofollow, noarchive"}});
}

async function requireSession(c: any, next: any) {
  const secret = adminPassword(c.env);
  if (!(await hasValidSession(c.req.raw, secret))) return c.redirect("/admin/login", 302);
  return next();
}

async function ingestAuthorized(c: any): Promise<boolean> {
  const configured = String((c.env as any).VIDEO_INGEST_SECRET ?? "").trim();
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (configured && bearer && bearer === configured) return true;
  const secret = adminPassword(c.env);
  return hasValidSession(c.req.raw, secret);
}

function hostIsVideo(c: any) {
  return new URL(c.req.url).hostname.toLowerCase() === "videos.thaimassageforu.com";
}

export function videoReviewApp() {
  const review = new Hono<AppEnv>();

  review.use("*", async (c, next) => {
    if (!hostIsVideo(c)) return c.notFound();
    const path = new URL(c.req.url).pathname;
    if (path === "/admin/login" || path === "/admin/logout" || path === "/api/ingest") return next();
    return requireSession(c, next);
  });

  review.get("/", async (c) => {
    const { results } = await c.env.DB.prepare(`SELECT id,title,provider,status,created_at,reviewed_at,released_at FROM video_reviews ORDER BY created_at DESC LIMIT 100`).all<any>();
    return page("Inbox", `<div class="panel"><h1>Generated video inbox</h1><p class="muted">Every generated video stays private until you explicitly approve it. Released is a separate state after approval.</p><table><thead><tr><th>Video</th><th>Provider</th><th>Status</th><th>Created</th></tr></thead><tbody>${results.map((r:any)=>`<tr><td><a href="/review/${escapeAttr(r.id)}">${escapeHtml(r.title)}</a></td><td>${escapeHtml(r.provider??"")}</td><td><span class="pill ${escapeAttr(r.status)}">${escapeHtml(r.status)}</span></td><td>${escapeHtml(r.created_at)}</td></tr>`).join("") || `<tr><td colspan="4">No generated videos yet.</td></tr>`}</tbody></table></div>`);
  });

  review.get("/review/:id", async (c) => {
    const id = c.req.param("id");
    const video = await c.env.DB.prepare(`SELECT * FROM video_reviews WHERE id=?1`).bind(id).first<ReviewRow>();
    if (!video) return page("Not found", `<div class="panel"><h1>Video not found</h1></div>`);
    const notes = (await c.env.DB.prepare(`SELECT * FROM video_review_notes WHERE video_id=?1 ORDER BY time_seconds,id`).bind(id).all<NoteRow>()).results;
    const checksOk = video.adult_confirmed && video.consent_confirmed && video.legal_confirmed && video.platform_confirmed;
    return page(video.title, `<div class="grid"><section class="panel"><h1>${escapeHtml(video.title)}</h1><p><span class="pill ${escapeAttr(video.status)}">${escapeHtml(video.status)}</span> ${video.provider?`<span class="muted">· ${escapeHtml(video.provider)}</span>`:""}</p><video id="player" class="video" controls playsinline preload="metadata" src="/media/${escapeAttr(video.id)}"></video>${video.prompt?`<details style="margin-top:12px"><summary>Generation prompt</summary><pre style="white-space:pre-wrap">${escapeHtml(video.prompt)}</pre></details>`:""}<h2>Timestamp critique</h2><form method="post" action="/review/${escapeAttr(id)}/note"><input id="time" type="number" step="0.01" min="0" name="time_seconds" value="0"><label>Note</label><textarea name="note" rows="3" required placeholder="Hands warp here, face drifts, camera jump, excellent contact, etc."></textarea><div class="row" style="margin-top:8px"><button class="btn" type="button" onclick="document.getElementById('time').value=document.getElementById('player').currentTime.toFixed(2)">Use current time</button><button class="btn" type="submit">Add note</button></div></form><div>${notes.map(n=>`<div class="note"><strong>${Number(n.time_seconds).toFixed(2)}s</strong> — ${escapeHtml(n.note)}</div>`).join("")||`<p class="muted">No timestamp notes yet.</p>`}</div></section><aside class="panel"><h2>Release guardrails</h2><form method="post" action="/review/${escapeAttr(id)}/decision"><div class="checks"><label><input type="checkbox" name="adult_confirmed" value="1" ${video.adult_confirmed?"checked":""}> All depicted people are clearly adults</label><label><input type="checkbox" name="consent_confirmed" value="1" ${video.consent_confirmed?"checked":""}> Consent / likeness permission confirmed</label><label><input type="checkbox" name="legal_confirmed" value="1" ${video.legal_confirmed?"checked":""}> Lawful for intended jurisdictions</label><label><input type="checkbox" name="platform_confirmed" value="1" ${video.platform_confirmed?"checked":""}> Intended platform/provider rules checked</label></div><label>Reviewer note</label><textarea name="reviewer_note" rows="4">${escapeHtml(video.reviewer_note??"")}</textarea><div class="row" style="margin-top:10px"><button class="btn ok" name="decision" value="approve">Approve</button><button class="btn bad" name="decision" value="reject">Reject</button>${video.status==="APPROVED"&&checksOk?`<button class="btn" name="decision" value="release">Release</button>`:""}</div></form><p class="muted">Release only appears after approval with all four guardrails checked.</p>${video.source_url?`<p class="muted">Source: ${escapeHtml(video.source_url)}</p>`:""}</aside></div>`);
  });

  review.get("/media/:id", async (c) => {
    const video = await c.env.DB.prepare(`SELECT r2_key,content_type FROM video_reviews WHERE id=?1`).bind(c.req.param("id")).first<{r2_key:string;content_type:string}>();
    if (!video) return c.text("Not found",404);
    const object = await mediaGet(c.env, video.r2_key);
    if (!object) return c.text("Missing media",404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-type", video.content_type || headers.get("content-type") || "video/mp4");
    headers.set("cache-control","private, no-store");
    headers.set("x-robots-tag","noindex, nofollow, noarchive");
    if (object.httpEtag) headers.set("etag",object.httpEtag);
    return new Response(object.body,{headers});
  });

  review.post("/review/:id/note", async (c) => {
    const form = await c.req.formData();
    const note = String(form.get("note")??"").trim().slice(0,3000);
    const time = Math.max(0,Number(form.get("time_seconds")??0)||0);
    if (note) await c.env.DB.prepare(`INSERT INTO video_review_notes(video_id,time_seconds,note) VALUES(?1,?2,?3)`).bind(c.req.param("id"),time,note).run();
    return c.redirect(`/review/${encodeURIComponent(c.req.param("id"))}`,303);
  });

  review.post("/review/:id/decision", async (c) => {
    const id = c.req.param("id");
    const form = await c.req.formData();
    const adult = form.get("adult_confirmed")?1:0, consent=form.get("consent_confirmed")?1:0, legal=form.get("legal_confirmed")?1:0, platform=form.get("platform_confirmed")?1:0;
    const reviewerNote = String(form.get("reviewer_note")??"").trim().slice(0,5000);
    const decision = String(form.get("decision")??"");
    const current = await c.env.DB.prepare(`SELECT status FROM video_reviews WHERE id=?1`).bind(id).first<{status:string}>();
    if (!current) return c.text("Not found",404);
    if (decision === "approve") {
      if (!(adult&&consent&&legal&&platform)) return c.text("All four release guardrails must be confirmed before approval.",400);
      await c.env.DB.prepare(`UPDATE video_reviews SET status='APPROVED',adult_confirmed=?2,consent_confirmed=?3,legal_confirmed=?4,platform_confirmed=?5,reviewer_note=?6,reviewed_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(id,adult,consent,legal,platform,reviewerNote).run();
    } else if (decision === "reject") {
      await c.env.DB.prepare(`UPDATE video_reviews SET status='REJECTED',adult_confirmed=?2,consent_confirmed=?3,legal_confirmed=?4,platform_confirmed=?5,reviewer_note=?6,reviewed_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(id,adult,consent,legal,platform,reviewerNote).run();
    } else if (decision === "release") {
      if (current.status !== "APPROVED" || !(adult&&consent&&legal&&platform)) return c.text("Only fully approved videos can be released.",400);
      await c.env.DB.prepare(`UPDATE video_reviews SET status='RELEASED',reviewer_note=?2,released_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(id,reviewerNote).run();
    }
    return c.redirect(`/review/${encodeURIComponent(id)}`,303);
  });

  review.post("/api/ingest", async (c) => {
    if (!(await ingestAuthorized(c))) return c.json({error:"Unauthorized"},401);
    let body:any; try{body=await c.req.json()}catch{return c.json({error:"invalid JSON"},400)}
    const sourceUrl = String(body?.source_url??"").trim();
    if (!/^https?:\/\//i.test(sourceUrl)) return c.json({error:"source_url must be http(s)"},400);
    const upstream = await fetch(sourceUrl);
    if (!upstream.ok || !upstream.body) return c.json({error:`source fetch failed: ${upstream.status}`},502);
    const contentType = upstream.headers.get("content-type")?.split(";")[0] || "video/mp4";
    if (!contentType.startsWith("video/")) return c.json({error:`source is not video (${contentType})`},415);
    const id = crypto.randomUUID();
    const ext = contentType.includes("webm")?"webm":contentType.includes("quicktime")?"mov":"mp4";
    const key = `video-review/${new Date().toISOString().slice(0,10)}/${id}.${ext}`;
    await mediaPut(c.env,key,upstream.body,{httpMetadata:{contentType}});
    const title = String(body?.title??`Generated video ${id.slice(0,8)}`).slice(0,200);
    const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0,20000) : null;
    const provider = typeof body?.provider === "string" ? body.provider.slice(0,80) : null;
    await c.env.DB.prepare(`INSERT INTO video_reviews(id,title,prompt,provider,source_url,r2_key,content_type) VALUES(?1,?2,?3,?4,?5,?6,?7)`).bind(id,title,prompt,provider,sourceUrl,key,contentType).run();
    return c.json({ok:true,id,status:"PENDING_REVIEW",review_url:`https://videos.thaimassageforu.com/review/${id}`},201);
  });

  return review;
}
