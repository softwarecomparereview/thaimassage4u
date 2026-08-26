import { HydrationBoundary, QueryClient, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { hydrateRoot } from "react-dom/client";
import superjson from "superjson";
import { Router } from "wouter";
import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) startLogin();
};
queryClient.getQueryCache().subscribe(event => { if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.query.state.error); });
queryClient.getMutationCache().subscribe(event => { if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.mutation.state.error); });
const trpcClient = trpc.createClient({
  links: [httpBatchLink({
    url: "/api/trpc", transformer: superjson,
    headers() {
      try { const raw = sessionStorage.getItem("manus-cookie"); const prefix = `${COOKIE_NAME}=`; const pair = raw?.split(";").find(value => value.trim().startsWith(prefix)); const token = pair?.trim().slice(prefix.length); return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; }
    },
    fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); },
  })],
});
/**
 * Analytics used to be a static tag in index.html written as
 * `src="%VITE_ANALYTICS_ENDPOINT%/umami"`. Those placeholders are only
 * substituted when the matching env vars exist at build time; they never did,
 * so every production page shipped the literal `%VITE_ANALYTICS_ENDPOINT%`,
 * fired one 404 per view, and recorded nothing. Attaching it here means an
 * unconfigured build simply has no analytics instead of a broken request.
 */
function attachAnalytics() {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
  if (!endpoint || !websiteId) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${endpoint.replace(/\/$/, "")}/umami`;
  script.dataset.websiteId = websiteId;
  document.head.appendChild(script);
}
attachAnalytics();

const rawState = (window as typeof window & { __RQ_STATE__?: unknown }).__RQ_STATE__;
const state = rawState ? superjson.deserialize(rawState as Parameters<typeof superjson.deserialize>[0]) as DehydratedState : undefined;
hydrateRoot(document.getElementById("root")!, <trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><HydrationBoundary state={state}><Router><App /></Router></HydrationBoundary></QueryClientProvider></trpc.Provider>);
