import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:5173", browserName: "chromium", channel: "msedge", reducedMotion: "reduce" },
  webServer: {
    command: process.env.E2E_PRODUCTION ? "npm exec -- vite preview --outDir .verification-dist --host 127.0.0.1 --port 5173 --strictPort" : "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
