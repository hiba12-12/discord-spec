import { defineConfig } from "vitest/config";

// Convex function tests (tests/convex/**): run against convex-test's simulated backend,
// edge-runtime environment as recommended by convex-test's docs.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["tests/convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
