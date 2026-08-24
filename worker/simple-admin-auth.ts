import { SignJWT } from "jose";
import type { Env } from "./index";

/**
 * Stopgap admin login that doesn't depend on Manus's own OAuth portal
 * (`worker/auth.ts`'s `handleOAuthCallback`). That flow requires a working
 * `VITE_OAUTH_PORTAL_URL`/`VITE_APP_ID` app registration on Manus's platform
 * plus a reachable `OAUTH_SERVER_URL` — none of which are available outside
 * Manus's own hosting, so it's unusable here. This mints the exact same
 * session cookie/JWT `worker/auth.ts`'s `getWorkerUser()` already reads, via
 * a single shared password instead of a third-party login round-trip.
 */

const COOKIE_NAME = "app_session_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const LOCAL_ADMIN_OPEN_ID = "local-admin";

function secret(env: Env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function handleAdminLogin(request: Request, env: Env) {
  if (!env.ADMIN_PASSWORD || !env.JWT_SECRET) {
    return Response.json({ error: "Admin login is not configured on this Worker." }, { status: 503 });
  }
  const body = await request.json<{ password?: string }>().catch(() => ({}) as { password?: string });
  if (!body.password || !timingSafeEqual(body.password, env.ADMIN_PASSWORD)) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  await env.DB.prepare(
    `INSERT INTO qh_users (open_id, name, login_method, role, last_signed_in)
     VALUES (?, 'Site owner', 'password', 'admin', CURRENT_TIMESTAMP)
     ON CONFLICT(open_id) DO UPDATE SET role = 'admin', last_signed_in = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(LOCAL_ADMIN_OPEN_ID)
    .run();

  const session = await new SignJWT({ openId: LOCAL_ADMIN_OPEN_ID, appId: env.APP_ID ?? "local", name: "Site owner" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS)
    .sign(secret(env));

  const headers = new Headers({ "content-type": "application/json" });
  headers.append("Set-Cookie", `${COOKIE_NAME}=${session}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; Secure; HttpOnly; SameSite=Lax`);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}
