import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import type { Env } from "./index";
import { handleOwnerLink, ownerLinkToken, validateOffer } from "./offers";

const JWT_SECRET = "test-secret";

/** Just enough of D1 for handleOwnerLink: one qh_listings row, its legacy email, and qh_users. */
function fakeEnv(listing: { ownerId: number | null; contactEmail: string | null; legacyEmail: string | null }) {
  const users = new Map<string, number>([["otp:email:someone-else@example.com", 7]]);
  const state = { ownerId: listing.ownerId };
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) { args = values; return statement; },
        async first() {
          if (sql.includes("FROM qh_listings WHERE slug")) return args[0] === "lotus-thai" ? { id: 1, slug: "lotus-thai", name: "Lotus Thai", ownerId: state.ownerId, contactEmail: listing.contactEmail } : null;
          if (sql.includes("FROM listings WHERE slug")) return { email: listing.legacyEmail };
          if (sql.includes("FROM qh_users WHERE open_id")) return users.has(String(args[0])) ? { id: users.get(String(args[0])) } : null;
          return null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO qh_users") && !users.has(String(args[0]))) users.set(String(args[0]), 42);
          if (sql.startsWith("UPDATE qh_listings SET owner_id") && state.ownerId === null) { state.ownerId = Number(args[0]); return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        },
      };
      return statement;
    },
  };
  return { env: { DB: db, JWT_SECRET, SITE_URL: "https://example.test" } as unknown as Env, state };
}

const post = (token: string) => new Request("https://example.test/api/owner/link", { method: "POST", body: JSON.stringify({ token }) });

describe("one-click owner link", () => {
  it("claims an unclaimed listing for the on-file address and signs the owner in", async () => {
    const { env, state } = fakeEnv({ ownerId: null, contactEmail: null, legacyEmail: "Hello@LotusThai.com.au" });
    const response = await handleOwnerLink(post(await ownerLinkToken(env, "lotus-thai", "hello@lotusthai.com.au")), env);
    expect(response.status).toBe(200);
    expect(state.ownerId).toBe(42);
    expect(response.headers.get("set-cookie")).toMatch(/^app_session_id=/);
  });

  it("signs the existing owner back in when they already claimed with that address", async () => {
    const { env } = fakeEnv({ ownerId: 7, contactEmail: "someone-else@example.com", legacyEmail: null });
    const response = await handleOwnerLink(post(await ownerLinkToken(env, "lotus-thai", "someone-else@example.com")), env);
    expect(response.status).toBe(200);
  });

  it("refuses a listing someone else already owns", async () => {
    const { env, state } = fakeEnv({ ownerId: 7, contactEmail: "hello@lotusthai.com.au", legacyEmail: null });
    const response = await handleOwnerLink(post(await ownerLinkToken(env, "lotus-thai", "hello@lotusthai.com.au")), env);
    expect(response.status).toBe(409);
    expect(state.ownerId).toBe(7);
  });

  it("refuses a link whose address is no longer on file", async () => {
    const { env, state } = fakeEnv({ ownerId: null, contactEmail: "new@lotusthai.com.au", legacyEmail: "new@lotusthai.com.au" });
    const response = await handleOwnerLink(post(await ownerLinkToken(env, "lotus-thai", "old@lotusthai.com.au")), env);
    expect(response.status).toBe(403);
    expect(state.ownerId).toBeNull();
  });

  it("does not accept a session cookie or a tampered token as a link", async () => {
    const { env } = fakeEnv({ ownerId: null, contactEmail: "hello@lotusthai.com.au", legacyEmail: null });
    const session = await new SignJWT({ openId: "otp:email:hello@lotusthai.com.au", slug: "lotus-thai", email: "hello@lotusthai.com.au" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(new TextEncoder().encode(JWT_SECRET));
    expect((await handleOwnerLink(post(session), env)).status).toBe(400);
    const token = await ownerLinkToken(env, "lotus-thai", "hello@lotusthai.com.au");
    expect((await handleOwnerLink(post(`${token.slice(0, -2)}xx`), env)).status).toBe(400);
  });
});

describe("validateOffer", () => {
  it("accepts a full offer and normalises the code", () => {
    const result = validateOffer({ title: " 15% off your first visit ", details: "Any 60-min massage", code: "spring-15", startsOn: "2026-11-01", endsOn: "2026-12-31" });
    expect(result).toEqual({ ok: true, offer: { title: "15% off your first visit", details: "Any 60-min massage", terms: null, code: "SPRING-15", startsOn: "2026-11-01", endsOn: "2026-12-31", active: true } });
  });

  it("rejects a missing headline, bad codes and backwards dates", () => {
    expect(validateOffer({ title: "" }).ok).toBe(false);
    expect(validateOffer({ title: "x", code: "no spaces!" }).ok).toBe(false);
    expect(validateOffer({ title: "x", startsOn: "2026-12-01", endsOn: "2026-11-01" }).ok).toBe(false);
    expect(validateOffer({ title: "x", endsOn: "next week" }).ok).toBe(false);
  });

  it("only pauses when active is explicitly false", () => {
    const paused = validateOffer({ title: "x", active: false });
    expect(paused.ok && paused.offer.active).toBe(false);
  });
});
