import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forwardLead, refererPath, sendLeadToPml, signedLeadRequest } from "./pml-lead";

afterEach(() => vi.unstubAllGlobals());

describe("Pilot My Life lead forwarding", () => {
  it("signs the lead the way PML verifies it (pml-timestamped)", async () => {
    const now = Date.parse("2026-10-04T12:00:00Z");
    const lead = { name: "Ann", email: "ann@example.com", message: "Looking for a Thai massage", page: "/au/sydney/quiet-hour", consent: true };
    const req = await signedLeadRequest(lead, "s3cret", undefined, now);
    const body = await req.text();
    const ts = req.headers.get("x-pml-timestamp");
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://pilotmylife.com/hooks/thaimassageforu/lead-form");
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(ts).toBe(String(now / 1000));
    expect(req.headers.get("x-pml-signature")).toBe(`sha256=${createHmac("sha256", "s3cret").update(`${ts}.${body}`).digest("hex")}`);
    expect(JSON.parse(body)).toEqual(lead);
  });

  it("sends nothing without the secret, and a failing PML never throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await forwardLead({}, { email: "a@b.co", consent: false });
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(forwardLead({ PML_LEAD_WEBHOOK_SECRET: "x" }, { email: "a@b.co", consent: false })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Non-2xx is logged, not thrown.
    fetchMock.mockImplementationOnce(async () => new Response("no", { status: 401 }) as never);
    await expect(forwardLead({ PML_LEAD_WEBHOOK_SECRET: "x", PML_LEAD_WEBHOOK_URL: "https://pml.test/hook" }, { email: "a@b.co", consent: true })).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it("hands the send to waitUntil and skips leads with no email", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 202 })));
    const waitUntil = vi.fn();
    sendLeadToPml({ PML_LEAD_WEBHOOK_SECRET: "x" }, { waitUntil }, { email: "", phone: "+61400000000", consent: true });
    expect(waitUntil).not.toHaveBeenCalled();
    sendLeadToPml({}, { waitUntil }, { email: "a@b.co", consent: true });
    expect(waitUntil).not.toHaveBeenCalled();
    sendLeadToPml({ PML_LEAD_WEBHOOK_SECRET: "x" }, { waitUntil }, { email: "a@b.co", consent: true });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
  });

  it("takes only the path from the Referer", () => {
    expect(refererPath(new Request("https://thaimassageforu.com/api/trpc", { headers: { referer: "https://thaimassageforu.com/au/sydney/x?utm=1" } }))).toBe("/au/sydney/x");
    expect(refererPath(new Request("https://thaimassageforu.com/api/trpc"))).toBeUndefined();
  });
});
