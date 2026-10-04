# Cloudflare Workers Builds — Quiet Hour

## Repository connection

In the existing **`thaimassageforu`** Worker, select **Automate your CI**, then connect the GitHub repository **`softwarecomparereview/thaimassage4u`**. Select **`main`** as the production branch. The committed `wrangler.jsonc` deliberately keeps the Worker name as `thaimassageforu`, retaining the existing custom domains:

- `thaimassageforu.com`
- `www.thaimassageforu.com`
- `videos.thaimassageforu.com`

## Build settings

Use Node.js 22 and pnpm 10. Configure the build command as follows:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm run worker:ci
```

Configure the deploy command as follows:

```bash
pnpm run worker:deploy
```

## Required build-time variables

The React application needs these public build variables in the Cloudflare dashboard’s build settings. Copy the values from the existing Quiet Hour application configuration; do not commit them to Git.

| Variable | Purpose |
|---|---|
| `VITE_APP_ID` | Manus OAuth client identifier compiled into the client. |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuth portal URL used by the browser login flow. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for checkout-related browser states. |
| `VITE_ANALYTICS_ENDPOINT` | Analytics script origin. |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website identifier. |

## Worker secrets

The Worker already has the encrypted `JWT_SECRET`, `OAUTH_SERVER_URL`, `APP_ID`, `OWNER_OPEN_ID`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` bindings set through Wrangler. They must remain encrypted Worker secrets and must not be placed in Git or Cloudflare build variables.

### Pilot My Life lead forwarding (optional)

Every accepted lead is also sent, signed, to Pilot My Life's lead intake so it can be qualified there. The site's own handling (D1 `qh_inquiries`, the CMS inbox, the claim flow) is unchanged; the copy is sent after the response through `ctx.waitUntil`, with an 8 s timeout, and failures are only logged (`[pml-lead]` in Workers Logs). It never blocks or fails the visitor's request. Code: `worker/pml-lead.ts`, test `worker/pml-lead.test.ts`.

| Name | Kind | Purpose |
|---|---|---|
| `PML_LEAD_WEBHOOK_SECRET` | Worker secret | HMAC key shared with Pilot My Life's `thaimassageforu` lead-form webhook. Unset means nothing is forwarded. Set with `wrangler secret put PML_LEAD_WEBHOOK_SECRET` on the `thaimassageforu` Worker. |
| `PML_LEAD_WEBHOOK_URL` | Optional variable | Overrides the default `https://pilotmylife.com/hooks/thaimassageforu/lead-form`. |

What is forwarded:

- **Directory inquiry** (`POST /api/directory/inquiry` and tRPC `directory.submitInquiry`, both via `createInquiry` in `worker/directory.ts`): name, email, phone, message, page (Referer path), `consent: true` (the visitor asked to hear back).
- **Completed listing claim** (`POST /api/claim/verify`): listing name, the verified email (or, for an SMS claim, the listing's on-file email), phone for SMS claims, `consent: false`. An SMS claim on a listing with no email on file is not forwarded, because PML requires an email.

Wire format: JSON body `{name?, email, phone?, message?, page?, consent}`, headers `x-pml-timestamp` (unix seconds) and `x-pml-signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<body>")>`. Rollback: delete the secret (`wrangler secret delete PML_LEAD_WEBHOOK_SECRET`); forwarding stops at once with no deploy.

## Cutover guard

Keep the initial production deployment in review until the Worker health endpoint, the public directory API, OAuth callback, and Stripe test webhook have been confirmed. The Worker has the existing domain bindings, so the first successful Workers Builds production deploy will change the real domain.
