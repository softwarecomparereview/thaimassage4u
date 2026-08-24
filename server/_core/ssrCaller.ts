import type { Request, Response } from "express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import type { SsrPrefetch } from "../../client/src/ssr/prefetch";

export async function buildSsrPrefetch(req: Request, res: Response): Promise<SsrPrefetch> {
  const context = await createContext({ req, res } as never);
  const caller = appRouter.createCaller(context);
  return {
    home: () => caller.directory.home(),
    listingBySlug: slug => caller.directory.listingBySlug({ slug }),
    articleBySlug: slug => caller.directory.articleBySlug({ slug }),
    cityBySlug: slug => caller.directory.cityBySlug({ slug }),
    countryBySlug: code => caller.directory.countryBySlug({ code }),
  };
}
