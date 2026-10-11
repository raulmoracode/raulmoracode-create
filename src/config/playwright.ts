import type { Framework } from "../utils/validation.js";

/**
 * The dev server port each framework's `pnpm dev` listens on. Playwright's
 * `webServer` waits for this URL before running the tests.
 */
export function playwrightPort(frameworkId: Framework): number {
  return frameworkId === "next" ? 3000 : 5173;
}

export function playwrightConfig(frameworkId: Framework): string {
  const port = playwrightPort(frameworkId);
  return [
    'import { defineConfig, devices } from "@playwright/test";',
    "",
    `const port = ${port};`,
    "",
    "export default defineConfig({",
    '  testDir: "./e2e",',
    '  testMatch: "**/*.e2e.ts",',
    "  fullyParallel: true,",
    "  forbidOnly: !!process.env.CI,",
    "  retries: process.env.CI ? 2 : 0,",
    "  workers: process.env.CI ? 1 : undefined,",
    '  reporter: "html",',
    "  use: {",
    `    baseURL: \`http://localhost:\${port}\`,`,
    '    trace: "on-first-retry",',
    "  },",
    "  projects: [",
    "    {",
    '      name: "chromium",',
    '      use: { ...devices["Desktop Chrome"] },',
    "    },",
    "  ],",
    "  webServer: {",
    '    command: "pnpm dev",',
    `    url: \`http://localhost:\${port}\`,`,
    "    reuseExistingServer: !process.env.CI,",
    "  },",
    "});",
    "",
  ].join("\n");
}

export function playwrightSmokeSpec(): string {
  return [
    'import { expect, test } from "@playwright/test";',
    "",
    'test("home page renders", async ({ page }) => {',
    '  await page.goto("/");',
    '  await expect(page.getByText("hello")).toBeVisible();',
    "});",
    "",
  ].join("\n");
}
