import { describe, expect, it } from "vitest";
import { NOT_ADMIN_ERR_MSG } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function contextFor(role?: "admin" | "user"): TrpcContext {
  return {
    user: role ? {
      id: 17,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("CMS access control", () => {
  it("blocks unauthenticated callers from the CMS summary", async () => {
    const caller = appRouter.createCaller(contextFor());
    await expect(caller.cms.summary()).rejects.toMatchObject({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  });

  it("blocks non-admin callers from creating message templates", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.cms.saveTemplate({ channel: "email", title: "Welcome", purpose: "Introduction", body: "Hello", status: "approved" })).rejects.toMatchObject({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  });
});
