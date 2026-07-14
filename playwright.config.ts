import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // these are smoke tests against a shared Convex dev deployment
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    permissions: ["camera", "microphone"],
    // Fake media devices so getUserMedia() succeeds headlessly, per research.md's WebRTC
    // section — camera access requires HTTPS or localhost, and localhost is used here.
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
