import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@concierge/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
    },
  },
});
