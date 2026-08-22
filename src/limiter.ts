import { DurableObject } from "cloudflare:workers";

type WindowState = { n: number; reset: number };

export class FormLimiter extends DurableObject<Env> {
  async allow(limit = 8, windowMs = 60 * 60 * 1000): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
    const now = Date.now();
    const state = (await this.ctx.storage.get<WindowState>("w")) ?? { n: 0, reset: now + windowMs };

    if (now > state.reset) {
      await this.ctx.storage.put("w", { n: 1, reset: now + windowMs });
      return { ok: true };
    }

    if (state.n >= limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((state.reset - now) / 1000)) };
    }

    await this.ctx.storage.put("w", { n: state.n + 1, reset: state.reset });
    return { ok: true };
  }
}
