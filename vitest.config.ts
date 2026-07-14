import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Unit tests (tests/unit/**): pure logic + React Testing Library, jsdom environment.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
