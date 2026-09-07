import { expect, test } from "playwright/test";

test("cookie preference can be saved without obscuring the page", async ({ page }) => {
  await page.goto("/signIn");

  const banner = page.getByRole("complementary", { name: "Cookie preferences" });
  await expect(banner).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept all" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Essential only" })).toBeVisible();

  await page.getByRole("button", { name: "Essential only" }).click();
  await expect(banner).toBeHidden();

  await page.reload();
  await expect(banner).toBeHidden();
});
