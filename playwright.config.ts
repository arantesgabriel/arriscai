import { defineConfig } from "@playwright/test";
const port = process.env.ARRISCAI_E2E_PORT ?? "3000";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace:
      process.env.ARRISCAI_LIVE_E2E === "1" ||
      process.env.PW_REUSE_SERVER === "1"
        ? "off"
        : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run ${process.env.ARRISCAI_E2E_PRODUCTION === "1" ? "start" : "dev"} -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        "test-publishable-key",
    },
  },
});
