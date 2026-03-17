import { expect, test } from "@playwright/test";

const paths = [
  "/",
  "/attack",
  "/bots",
  "/rate-limiting",
  "/sensitive-info",
  "/sensitive-info/submitted",
  "/signup",
  "/signup/submitted",
];

for (const pathname of paths) {
  test(`"${pathname}" screenshot matches`, async ({ page }) => {
    const response = await page.goto(pathname);
    await expect(response?.status()).toEqual(200);
    await expect(page).toHaveScreenshot({
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      threshold: 0.2,
    });
  });
}
