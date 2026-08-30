import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // The engine, the parser, the geometry and the notification logic are all
    // pure functions; no DOM needed, and node keeps the suite fast enough to
    // stay in the edit loop.
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
