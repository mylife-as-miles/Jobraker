import { expect, test } from "playwright/test";

test.describe("authenticated mobile tours", () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Set E2E_EMAIL and E2E_PASSWORD to run authenticated journeys.",
  );

  test("profile tour remains inside the mobile viewport", async ({ page }) => {
    test.skip(
      !test.info().project.name.startsWith("mobile"),
      "This journey specifically verifies the mobile layout.",
    );
    await page.goto("/signIn");
    await page.getByPlaceholder("name@example.com").fill(process.env.E2E_EMAIL!);
    await page.getByPlaceholder("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 });

    await page.goto("/dashboard/profile?tour=1");
    const tooltip = page.locator(".react-joyride__tooltip");
    await expect(tooltip).toBeVisible({ timeout: 15_000 });

    for (let step = 0; step < 12 && (await tooltip.isVisible()); step += 1) {
      const box = await tooltip.boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(viewport).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);

      const advance = tooltip.getByRole("button", { name: /next|finish/i });
      await advance.click();
    }

    await expect(tooltip).toBeHidden();
  });
});
