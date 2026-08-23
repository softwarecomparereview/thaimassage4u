# Quiet Hour Cloudflare Worker Migration Assessment

## Current application boundary

Quiet Hour currently uses an Express/Node entry point for OAuth, tRPC, Stripe webhooks, database access, object-storage proxying, and SSR. Its data model is MySQL/TiDB-oriented through Drizzle, while the Worker service currently serving `thaimassageforu.com` is a separate Wrangler-deployed application with legacy Worker bindings and assets.

## Target architecture

The migrated service will use a Worker entry point with static assets, request-time public rendering, a Worker-native API layer, encrypted Worker secrets, and bindings for persistent data. The existing MySQL/TiDB data will be retained through a Cloudflare Hyperdrive binding and `mysql2`/Drizzle rather than duplicated or silently reseeded. The Worker will use request/response APIs in place of an Express listener, Web Crypto for signed session and webhook verification helpers, Worker secrets for OAuth and Stripe credentials, and Worker Assets for the built React application.

## Migration workstreams

| Concern | Worker target |
|---|---|
| Public application | Vite client assets plus a Worker fetch handler with server-side public route rendering. |
| Data | Existing MySQL/TiDB accessed through Hyperdrive with the supported `mysql2` driver and Drizzle schema. |
| CMS API | Fetch-compatible tRPC procedures behind `/api/trpc`, protected by Worker-native signed session validation. |
| OAuth | Worker callback handler preserving the existing provider contract and secure cookie attributes. |
| Payments | Stripe Checkout creator plus raw-body signature verification at `/api/stripe/webhook`. |
| Media | Cloudflare R2 or a managed S3-compatible origin accessed only from Worker bindings; no local project assets. |
| Delivery | Existing `thaimassageforu` Worker name, custom-domain bindings, and Git-connected `main` production builds. |

## Compatibility findings

Cloudflare supports full-stack applications with static assets, SSR, and request-time Worker logic. Modern compatibility dates enable the current Node compatibility layer, but the application still needs a Worker-native request model rather than an Express listener. The Worker Git integration requires a Wrangler configuration whose `name` matches the existing `thaimassageforu` Worker, then runs the configured build and deployment commands on the chosen production branch.

Cloudflare Hyperdrive supports MySQL/TiDB-style access from Workers using the `mysql2` driver and Drizzle, but the current migration will use the already bound D1 database for the Worker-native public and CMS model while preserving legacy D1 tables. The current Worker foundation compiles with existing Worker bindings, Worker Assets, a Durable Object rate limiter, a workflow export, and new public directory/inquiry endpoints.

## Source references

- https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/
- https://developers.cloudflare.com/hyperdrive/
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
