// Direct D1 access from a Node build script — Cloudflare's D1 REST API, not a scrape of the
// site's tRPC endpoints (the brief is explicit that scraping tRPC is the wrong approach). This
// is the same database the deployed Worker's `directory.*` procedures read, reached the same
// way `wrangler d1 execute` reaches it, just called directly so the build doesn't shell out.

export interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export function d1ConfigFromEnv(): D1Config {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "concierge-build needs CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_API_TOKEN in the environment " +
        "(the same values wrangler.jsonc's d1_databases entry and `wrangler whoami` already resolve for this project).",
    );
  }
  return { accountId, databaseId, apiToken };
}

export async function d1Query<T = Record<string, unknown>>(config: D1Config, sql: string, params: unknown[] = []): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const body = (await response.json()) as { success: boolean; errors?: Array<{ message: string }>; result?: Array<{ results: T[] }> };
  if (!response.ok || !body.success) {
    throw new Error(`D1 query failed: ${body.errors?.map(e => e.message).join("; ") ?? response.statusText}`);
  }
  return body.result?.[0]?.results ?? [];
}
