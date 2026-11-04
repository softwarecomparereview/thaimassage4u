import { describe, expect, it, vi } from "vitest";
import { buildCopyEmail, buildShopEmail, pickEmail, queueEnquiryEmails, sendEnquiryEmails, type Enquiry } from "./enquiry-email";
import { createInquiry } from "./directory";
import type { Env } from "./index";

const SITE = "https://thaimassageforu.com";
const HELLO = "hello@thaimassageforu.com";

function enquiry(overrides: Partial<Enquiry> = {}): Enquiry {
  return {
    inquiryId: 12,
    name: "Ann Lee",
    email: "ann@example.com",
    phone: "0400 000 000",
    message: "Do you have a 60 minute slot on Saturday?",
    listing: { name: "Siam Touch", slug: "siam-touch", claimed: false, shopEmail: "shop@siamtouch.com.au" },
    ...overrides,
  };
}

type Sent = { to: string; replyTo?: string; subject: string; html: string; text: string; from: string };

function fakeEnv(send: (msg: Sent) => unknown = () => ({ permanent_bounces: [] })) {
  const sent: Sent[] = [];
  const env = {
    SITE_URL: SITE,
    CONTACT_EMAIL: HELLO,
    EMAIL: { send: vi.fn(async (msg: Sent) => { sent.push(msg); return send(msg); }) },
  } as unknown as Env;
  return { env, sent };
}

describe("pickEmail", () => {
  it("returns a clean lowercase address", () => {
    expect(pickEmail("Info@SiamTouch.com.au")).toBe("info@siamtouch.com.au");
  });
  it("takes the first usable address from a messy field", () => {
    expect(pickEmail("n/a; mailto:book@spa.com, other@spa.com")).toBe("book@spa.com");
  });
  it("rejects empty values, junk and asset file names scraped as emails", () => {
    for (const bad of [null, undefined, "", "   ", "not an email", "logo@2x.png", "a@b", "<script>@x.com", "a@b.com>"]) expect(pickEmail(bad)).toBeNull();
  });
});

describe("enquiry email content", () => {
  it("escapes everything the visitor typed", () => {
    const evil = enquiry({ name: `<img src=x onerror=alert(1)>`, message: `<script>alert("hi")</script>\nline two`, phone: `"><b>` });
    const { html, text } = buildShopEmail(evil, { SITE_URL: SITE, CONTACT_EMAIL: HELLO });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain(`"><b>`);
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain("line two"); // line breaks survive in the plain-text part
  });

  it("tells the shop to just reply, and only offers claiming on unclaimed listings", () => {
    const unclaimed = buildShopEmail(enquiry(), { SITE_URL: SITE, CONTACT_EMAIL: HELLO });
    expect(unclaimed.subject).toBe("New enquiry for Siam Touch — Thai Massage For U");
    expect(unclaimed.html).toContain("Just reply to this email");
    expect(unclaimed.html).toContain(`${SITE}/listing/siam-touch`);
    expect(unclaimed.html).toContain("claim your listing");
    const claimed = buildShopEmail(enquiry({ listing: { name: "Siam Touch", slug: "siam-touch", claimed: true, shopEmail: "shop@siamtouch.com.au" } }), { SITE_URL: SITE, CONTACT_EMAIL: HELLO });
    expect(claimed.html).not.toContain("claim your listing");
  });

  it("puts what happened to the shop's email in the copy's subject and body", () => {
    expect(buildCopyEmail(enquiry(), "sent", { SITE_URL: SITE }).subject).toBe("[Copy] Sent to shop — enquiry for Siam Touch");
    const missing = buildCopyEmail(enquiry({ listing: { name: "Siam Touch", slug: "siam-touch", claimed: false, shopEmail: null } }), "no-email", { SITE_URL: SITE });
    expect(missing.subject).toContain("NO SHOP EMAIL ON FILE");
    expect(missing.text).toContain("has NOT seen this");
  });
});

describe("sendEnquiryEmails", () => {
  it("emails the shop from hello@ with the customer as Reply-To, then sends us a copy", async () => {
    const { env, sent } = fakeEnv();
    await expect(sendEnquiryEmails(env, enquiry())).resolves.toBe("sent");
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ to: "shop@siamtouch.com.au", replyTo: "ann@example.com", from: "Thai Massage For U <hello@thaimassageforu.com>" });
    expect(sent[0].text).toContain("Do you have a 60 minute slot on Saturday?");
    expect(sent[1]).toMatchObject({ to: HELLO, replyTo: "ann@example.com" });
    expect(sent[1].subject).toContain("Sent to shop");
  });

  it("with no shop address, only we get it, and the copy says the shop did not", async () => {
    const { env, sent } = fakeEnv();
    const noEmail = enquiry({ listing: { name: "Siam Touch", slug: "siam-touch", claimed: false, shopEmail: null } });
    await expect(sendEnquiryEmails(env, noEmail)).resolves.toBe("no-email");
    expect(sent.map(m => m.to)).toEqual([HELLO]);
    expect(sent[0].subject).toContain("NO SHOP EMAIL ON FILE");
  });

  it("with no listing at all, only we get it", async () => {
    const { env, sent } = fakeEnv();
    await sendEnquiryEmails(env, enquiry({ listing: null }));
    expect(sent.map(m => m.to)).toEqual([HELLO]);
    expect(sent[0].text).toContain("not tied to a listing");
  });

  it("reports a bounce to us", async () => {
    const { env, sent } = fakeEnv(msg => ({ permanent_bounces: msg.to === "shop@siamtouch.com.au" ? [msg.to] : [] }));
    await expect(sendEnquiryEmails(env, enquiry())).resolves.toBe("bounced");
    expect(sent[1].subject).toContain("SHOP EMAIL BOUNCED");
  });

  it("reports a failed send to us instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { env, sent } = fakeEnv(msg => { if (msg.to !== HELLO) throw new Error("E_DAILY_QUOTA_EXCEEDED"); return { permanent_bounces: [] }; });
    await expect(sendEnquiryEmails(env, enquiry())).resolves.toBe("failed");
    expect(sent[1].subject).toContain("SHOP EMAIL FAILED");
    warn.mockRestore();
  });

  it("does not throw when our own copy fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { env } = fakeEnv(msg => { if (msg.to === HELLO) throw new Error("boom"); return { permanent_bounces: [] }; });
    await expect(sendEnquiryEmails(env, enquiry())).resolves.toBe("sent");
    warn.mockRestore();
  });

  it("sends one message, not two, when the shop address is our own", async () => {
    const { env, sent } = fakeEnv();
    await sendEnquiryEmails(env, enquiry({ listing: { name: "Siam Touch", slug: "siam-touch", claimed: false, shopEmail: HELLO } }));
    expect(sent).toHaveLength(1);
  });

  it("never lets extra text after the visitor's address into the Reply-To header", async () => {
    const { env, sent } = fakeEnv();
    await sendEnquiryEmails(env, enquiry({ email: "ann@example.com\r\nBcc: victim@x.com" }));
    expect(sent.map(m => m.replyTo)).toEqual(["ann@example.com", "ann@example.com"]);
  });

  it("leaves Reply-To off when the visitor's address is not a real email", async () => {
    const { env, sent } = fakeEnv();
    await sendEnquiryEmails(env, enquiry({ email: "not-an-email" }));
    expect(sent).toHaveLength(2);
    expect(sent.every(m => m.replyTo === undefined)).toBe(true);
  });
});

describe("queueEnquiryEmails", () => {
  it("hands the send to waitUntil, so it runs after the response", async () => {
    const { env, sent } = fakeEnv();
    const waitUntil = vi.fn();
    queueEnquiryEmails(env, { waitUntil }, enquiry());
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(sent).toHaveLength(2);
  });
});

describe("createInquiry", () => {
  type ListingRow = { name: string; slug: string; email: string | null; claimed: number | null; ownerId: number | null; ownerEmail: string | null };

  function dbEnv(row: ListingRow | null) {
    const { env, sent } = fakeEnv();
    const queries: string[] = [];
    (env as unknown as { DB: unknown }).DB = {
      prepare: (sql: string) => ({
        bind: (..._args: unknown[]) => ({
          run: async () => { queries.push(sql); return { meta: { last_row_id: 99 } }; },
          first: async () => { queries.push(sql); return row; },
        }),
      }),
      batch: async () => [],
    };
    return { env, sent, queries };
  }

  const input = { listingId: 5, name: "Ann Lee", email: "ann@example.com", message: "Do you have a slot on Saturday?", consentEmail: false, consentSms: false };

  it("emails the listing's imported address and says so", async () => {
    const { env, sent } = dbEnv({ name: "Siam Touch", slug: "siam-touch", email: "Shop@SiamTouch.com.au", claimed: 0, ownerId: null, ownerEmail: "old@x.com" });
    const waitUntil = vi.fn();
    const result = await createInquiry(env, input, { ctx: { waitUntil } });
    expect(result).toEqual({ inquiryId: 99, sentToShop: true });
    await Promise.all(waitUntil.mock.calls.map(c => c[0]));
    expect(sent[0].to).toBe("shop@siamtouch.com.au");
  });

  it("prefers the owner's address once a listing is claimed", async () => {
    const { env, sent } = dbEnv({ name: "Siam Touch", slug: "siam-touch", email: "imported@x.com", claimed: 1, ownerId: 3, ownerEmail: "owner@siamtouch.com.au" });
    const waitUntil = vi.fn();
    await createInquiry(env, input, { ctx: { waitUntil } });
    await Promise.all(waitUntil.mock.calls.map(c => c[0]));
    expect(sent[0].to).toBe("owner@siamtouch.com.au");
  });

  it("falls back to the imported address when a claimed owner has none", async () => {
    const { env, sent } = dbEnv({ name: "Siam Touch", slug: "siam-touch", email: "imported@x.com", claimed: 1, ownerId: 3, ownerEmail: null });
    const waitUntil = vi.fn();
    await createInquiry(env, input, { ctx: { waitUntil } });
    await Promise.all(waitUntil.mock.calls.map(c => c[0]));
    expect(sent[0].to).toBe("imported@x.com");
  });

  it("still saves the enquiry and tells us when the listing has no email", async () => {
    const { env, sent } = dbEnv({ name: "Siam Touch", slug: "siam-touch", email: null, claimed: 0, ownerId: null, ownerEmail: null });
    const waitUntil = vi.fn();
    const result = await createInquiry(env, input, { ctx: { waitUntil } });
    expect(result).toEqual({ inquiryId: 99, sentToShop: false });
    await Promise.all(waitUntil.mock.calls.map(c => c[0]));
    expect(sent.map(m => m.to)).toEqual([HELLO]);
  });

  it("still saves the enquiry when the listing lookup breaks", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { env } = dbEnv(null);
    const realPrepare = (env as unknown as { DB: { prepare: (sql: string) => unknown } }).DB.prepare;
    (env as unknown as { DB: { prepare: (sql: string) => unknown } }).DB.prepare = (sql: string) => {
      if (sql.includes("FROM listings")) throw new Error("D1 down");
      return realPrepare(sql);
    };
    await expect(createInquiry(env, input, { ctx: { waitUntil: vi.fn() } })).resolves.toEqual({ inquiryId: 99, sentToShop: false });
    warn.mockRestore();
  });
});
