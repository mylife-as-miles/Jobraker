import { expect, test } from "playwright/test";

test("sign-in renders without horizontal overflow", async ({ page }) => {
  await page.goto("/signIn");

  await expect(page.getByPlaceholder("name@example.com")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const contentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(contentWidth).toBeLessThanOrEqual(viewportWidth + 1);
});

test("Composio callback fails safely without correlation data", async ({ page }) => {
  await page.goto("/auth/callback/composio/github");
  await expect(page.getByText(/missing its verification details/i)).toBeVisible();
});
