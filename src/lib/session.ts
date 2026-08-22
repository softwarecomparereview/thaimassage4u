import { envSecret } from "./secrets";

const COOKIE = "tmfu_admin";
const TTL_SECONDS = 60 * 60 * 24 * 7;

export function adminPassword(env: Env): string {
  return envSecret(env, "ADMIN_PASSWORD") || envSecret(env, "ADMIN_SCRAPE_KEY");
}

function bytesToB64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionCookie(secret: string, secure = true): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${exp}.${crypto.randomUUID()}`;
  const key = await hmacKey(secret);
  const sig = bytesToB64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const value = `${payload}.${sig}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Max-Age=${TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function hasValidSession(request: Request, secret: string): Promise<boolean> {
  if (!secret) return false;
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(/(?:^|;\s*)tmfu_admin=([^;]+)/);
  if (!match?.[1]) return false;
  const parts = match[1].split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (!exp || !nonce || !sig) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const key = await hmacKey(secret);
  const payload = `${exp}.${nonce}`;
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const given = b64urlToBytes(sig);
  if (expected.byteLength !== given.byteLength) return false;
  return crypto.subtle.timingSafeEqual(expected, given);
}

export async function passwordsMatch(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) {
    const dummy = encoder.encode(expected);
    crypto.subtle.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.subtle.timingSafeEqual(a, b);
}
