import { describe, expect, it } from "vitest";

const CONTENT_QUALITY_URL = "https://overpayingforai.com/api/content-quality";

describe("content-quality API credential", () => {
  it("authenticates against the documented health endpoint", async () => {
    const apiKey = process.env.CONTENT_QUALITY_API_KEY;
    expect(apiKey, "CONTENT_QUALITY_API_KEY must be set").toBeTruthy();

    const response = await fetch(CONTENT_QUALITY_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as { ok?: boolean; engine?: string; methods?: string[] };
    expect(payload).toMatchObject({ ok: true, engine: "desk-quality-v2" });
    expect(payload.methods).toContain("POST");
  }, 20_000);
});
