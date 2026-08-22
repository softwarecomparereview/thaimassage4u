export function envSecret(env: Env, name: string): string {
  if (!(name in env)) return "";
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" ? value : "";
}

export function adminAuthorized(env: Env, headerKey: string | undefined): boolean {
  const expected = envSecret(env, "ADMIN_SCRAPE_KEY");
  const key = headerKey ?? "";
  if (!expected || !key) return false;
  const a = new TextEncoder().encode(key);
  const b = new TextEncoder().encode(expected);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}
