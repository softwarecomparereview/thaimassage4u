import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { buildSsrPrefetch } from "./ssrCaller";
import type { HeadMeta } from "../../client/src/ssr/prefetch";

const siteName = process.env.SITE_NAME || "Quiet Hour";
const canonicalOrigin = (process.env.CANONICAL_ORIGIN || "https://thaimassageforu.com").replace(/\/$/, "");
const defaultHead: HeadMeta = { title: "Quiet Hour — Find your place in the city", description: "A considered guide to wellness places, rituals, and city intelligence.", canonicalPath: "/" };
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const cleanText = (value: string, length: number) => { const text = value.replace(/\s+/g, " ").trim(); return Array.from(text).slice(0, length).join(""); };
function headTags(head: HeadMeta) {
  const title = escapeHtml(cleanText(head.title || siteName, 70));
  const description = escapeHtml(cleanText(head.description, 200));
  const canonical = head.canonicalPath ? `${canonicalOrigin}${head.canonicalPath}` : "";
  const image = head.ogImage?.startsWith("/") ? `${canonicalOrigin}${head.ogImage}` : head.ogImage;
  const tags = [`<title>${title}</title>`, `<meta name="description" content="${description}" />`, `<meta property="og:type" content="${head.ogType || "website"}" />`, `<meta property="og:title" content="${title}" />`, `<meta property="og:description" content="${description}" />`, `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`, `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`, `<meta name="twitter:title" content="${title}" />`, `<meta name="twitter:description" content="${description}" />`];
  if (canonical) tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`, `<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  for (const alternate of head.alternates ?? []) {
    const href = `${canonicalOrigin}${alternate.path}`;
    tags.push(`<link rel="alternate" hreflang="${escapeHtml(alternate.locale)}" href="${escapeHtml(href)}" />`);
  }
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  if (head.noindex || head.notFound) tags.push(`<meta name="robots" content="noindex, follow" />`);
  if (head.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(head.jsonLd).replace(/</g, "\\u003c")}</script>`);
  return tags.join("\n");
}
function composeHtml(template: string, appHtml: string, head: HeadMeta, state: unknown) {
  const stateJson = JSON.stringify(state).replace(/</g, "\\u003c");
  return template.replace("</head>", () => `${headTags(head)}</head>`).replace("</body>", () => `<script>window.__RQ_STATE__=${stateJson}</script></body>`).replace("<!--app-html-->", () => appHtml);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({ ...viteConfig, configFile: false, server: { middlewareMode: true, hmr: { server }, allowedHosts: true }, appType: "custom" });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      const templatePath = path.resolve(import.meta.dirname, "../..", "client", "index.html");
      let template = await fs.promises.readFile(templatePath, "utf-8");
      template = template.replace(`src="/src/entry-client.tsx"`, `src="/src/entry-client.tsx?v=${nanoid()}"`);
      template = await vite.transformIndexHtml(req.originalUrl, template);
      template = template.replace("</head>", `<link rel="stylesheet" href="/src/index.css?direct" data-ssr-css></head>`);
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      const { html, dehydratedState, head } = await render(req.originalUrl, await buildSsrPrefetch(req, res));
      res.status(head.notFound ? 404 : 200).set("Cache-Control", "no-cache").type("html").end(composeHtml(template, html, head, dehydratedState));
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const serverEntry = path.resolve(import.meta.dirname, "server-ssr", "entry-server.js");
  app.use((req, res, next) => {
    if (req.path === "/index.html") return res.redirect(301, "/");
    if (req.path !== "/" && /\/+$/ .test(req.path)) return res.redirect(301, req.path.replace(/\/+$/ , "") + req.originalUrl.slice(req.path.length));
    next();
  });
  app.use(express.static(distPath, { index: false, redirect: false }));
  app.use("*", async (req, res) => {
    const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
    try {
      const { render } = await import(serverEntry);
      const { html, dehydratedState, head } = await render(req.originalUrl, await buildSsrPrefetch(req, res));
      res.status(head.notFound ? 404 : 200).set("Cache-Control", "no-cache").type("html").end(composeHtml(template, html, head, dehydratedState));
    } catch (error) {
      console.error("[SSR] render failed, serving shell:", error);
      res.status(200).set("Cache-Control", "no-cache").type("html").end(composeHtml(template, "", defaultHead, {}));
    }
  });
}
