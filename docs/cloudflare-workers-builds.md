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

## Cutover guard

Keep the initial production deployment in review until the Worker health endpoint, the public directory API, OAuth callback, and Stripe test webhook have been confirmed. The Worker has the existing domain bindings, so the first successful Workers Builds production deploy will change the real domain.
