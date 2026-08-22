import base, { FormLimiter, SaleOfferWorkflow } from "./index";
import { videoReviewApp } from "./video-review";
import type { LeadMessage } from "./lib/messages";

export { FormLimiter, SaleOfferWorkflow };

const review = videoReviewApp();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const isReviewHost = url.hostname.toLowerCase() === "videos.thaimassageforu.com";
    // Keep the existing admin login/session implementation authoritative on the review host.
    if (isReviewHost && !url.pathname.startsWith("/admin")) {
      return review.fetch(request, env, ctx);
    }
    return base.fetch(request, env, ctx);
  },
  queue: base.queue,
  scheduled: base.scheduled,
} satisfies ExportedHandler<Env, LeadMessage>;
