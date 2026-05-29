import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://example.com";

/**
 * Mirrors the UI skeleton outcome from lib/automation-templates.ts:
 * navigate to the app base URL and confirm the page responds.
 * Uses APIRequestContext so CI/local runs do not require a headed browser.
 */
test("TC-SMOKE-001 — UI navigation skeleton", async ({ request }) => {
  const res = await request.get(`${BASE_URL}/`, { maxRedirects: 5 });
  expect(res.status()).toBeLessThan(500);
  const body = await res.text();
  expect(body.length).toBeGreaterThan(0);
});

/**
 * Mirrors the REST skeleton pattern: authenticated GET with tolerant status codes
 * (200 when OpenMRS is up; 401/403 when auth is required).
 */
test("TC-SMOKE-002 — REST API skeleton", async ({ request }) => {
  const auth =
    "Basic " + Buffer.from("clerk.alpha:Test1234").toString("base64");
  const res = await request.get(`${BASE_URL}/`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  expect([200, 301, 302, 401, 403, 404]).toContain(res.status());
});
