import { SignJWT, jwtVerify } from "jose";
import type { Env } from "./index";

const COOKIE_NAME = "app_session_id";
const STATE_COOKIE = "__Host-oauth_state";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const EXCHANGE_PATH = "/webdev.v1.WebDevAuthPublicService/ExchangeToken";
const USER_INFO_PATH = "/webdev.v1.WebDevAuthPublicService/GetUserInfo";

export type WorkerUser = { id: number; openId: string; name: string | null; email: string | null; loginMethod: string | null; role: "user" | "admin" };

function getCookie(request: Request, name: string) {
  const part = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return part?.slice(name.length + 1);
}

function decodeState(state: string): { redirectUri: string; nonce?: string } {
  try {
    const parsed = JSON.parse(atob(state));
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
    // Invalid state is rejected by the nonce comparison.
  }
  return { redirectUri: "" };
}

function secret(env: Env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

async function upsertUser(env: Env, profile: { openId: string; name?: string | null; email?: string | null; loginMethod?: string | null }) {
  const role = profile.openId === env.OWNER_OPEN_ID ? "admin" : "user";
  await env.DB.prepare("INSERT INTO qh_users (open_id, name, email, login_method, role, last_signed_in) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(open_id) DO UPDATE SET name=excluded.name, email=excluded.email, login_method=excluded.login_method, role=CASE WHEN excluded.role='admin' THEN 'admin' ELSE qh_users.role END, last_signed_in=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP")
    .bind(profile.openId, profile.name ?? null, profile.email ?? null, profile.loginMethod ?? null, role)
    .run();
  return env.DB.prepare("SELECT id, open_id AS openId, name, email, login_method AS loginMethod, role FROM qh_users WHERE open_id = ? LIMIT 1").bind(profile.openId).first<WorkerUser>();
}

export async function getWorkerUser(request: Request, env: Env): Promise<WorkerUser | null> {
  const token = getCookie(request, COOKIE_NAME) ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secret(env), { algorithms: ["HS256"] });
    const openId = typeof payload.openId === "string" ? payload.openId : "";
    if (!openId) return null;
    return env.DB.prepare("SELECT id, open_id AS openId, name, email, login_method AS loginMethod, role FROM qh_users WHERE open_id = ? LIMIT 1").bind(openId).first<WorkerUser>();
  } catch {
    return null;
  }
}

export async function handleOAuthCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return Response.json({ error: "code and state are required" }, { status: 400 });
  const decoded = decodeState(state);
  if (!decoded.nonce || decoded.nonce !== getCookie(request, STATE_COOKIE)) return Response.json({ error: "invalid oauth state" }, { status: 403 });
  const exchange = await fetch(new URL(EXCHANGE_PATH, env.OAUTH_SERVER_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: env.APP_ID, grantType: "authorization_code", code, redirectUri: decoded.redirectUri }),
  });
  if (!exchange.ok) return Response.json({ error: "OAuth token exchange failed" }, { status: 502 });
  const token = await exchange.json<{ accessToken: string }>();
  const userInfoResponse = await fetch(new URL(USER_INFO_PATH, env.OAUTH_SERVER_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: token.accessToken }),
  });
  if (!userInfoResponse.ok) return Response.json({ error: "OAuth user lookup failed" }, { status: 502 });
  const profile = await userInfoResponse.json<{ openId?: string; name?: string; email?: string; platform?: string; loginMethod?: string }>();
  if (!profile.openId) return Response.json({ error: "OAuth user identity is missing" }, { status: 400 });
  await upsertUser(env, { openId: profile.openId, name: profile.name, email: profile.email, loginMethod: profile.loginMethod ?? profile.platform });
  const session = await new SignJWT({ openId: profile.openId, appId: env.APP_ID, name: profile.name ?? "" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS)
    .sign(secret(env));
  const headers = new Headers({ location: "/" });
  headers.append("Set-Cookie", `${STATE_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=None`);
  headers.append("Set-Cookie", `${COOKIE_NAME}=${session}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; Secure; HttpOnly; SameSite=None`);
  return new Response(null, { status: 302, headers });
}
