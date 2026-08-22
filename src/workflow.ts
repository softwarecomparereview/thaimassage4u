import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

export type OfferPayload = { offerId: string };

export class SaleOfferWorkflow extends WorkflowEntrypoint<Env, OfferPayload> {
  async run(event: WorkflowEvent<OfferPayload>, step: WorkflowStep) {
    const offerId = event.payload.offerId;

    await step.do("archive-offer-to-r2", async () => {
      const row = await this.env.DB.prepare("SELECT * FROM sale_offers WHERE id = ?").bind(offerId).first();
      if (!row) return { skipped: true };
      await this.env.MEDIA.put(`offers/${offerId}.json`, JSON.stringify(row), {
        httpMetadata: { contentType: "application/json" },
      });
      return { archived: true };
    });

    await step.do("mark-offer-queued", async () => {
      await this.env.DB.prepare("UPDATE sale_offers SET status = ? WHERE id = ? AND status = ?")
        .bind("queued", offerId, "new")
        .run();
      return { updated: true };
    });
  }
}
