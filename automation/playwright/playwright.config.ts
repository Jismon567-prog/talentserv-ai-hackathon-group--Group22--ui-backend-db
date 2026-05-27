import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests for the OpenMRS automation skeleton pattern emitted by the agent.
 * Uses example.com by default so CI runs without a live OpenMRS instance.
 * Set BASE_URL to your OpenMRS Reference Application for real integration.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "https://example.com",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
