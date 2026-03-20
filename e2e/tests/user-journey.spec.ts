import { test, expect } from "@playwright/test";

test.describe("SkyCheck user journey", () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "testpassword123";

  test("full flow: register → search → favorite → history → logout → login", async ({ page }) => {
    await page.goto("/");

    // Register
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="register-button"]');
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();

    // Search for a city
    await page.fill("#search-input", "Denver");
    await page.click("#search-button");
    await expect(page.locator(".current-weather")).toBeVisible({ timeout: 10000 });

    // Air quality card should be visible (if AQI API is reachable)
    const aqCard = page.locator(".air-quality-card");
    const aqVisible = await aqCard.isVisible().catch(() => false);
    if (aqVisible) {
      await expect(aqCard.locator(".aqi-badge")).toBeVisible();
    }

    // Save to favorites
    await page.click("#fav-toggle");
    await expect(page.locator(".favorite-chip")).toBeVisible();

    // Toggle units
    await page.click("#unit-toggle");

    // Toggle theme
    await page.click("#theme-toggle");
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("dark");

    // Logout — should go to guest mode with auth card and search bar visible
    await page.click('[data-testid="logout-button"]');
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator(".search-bar")).toBeVisible();

    // Login again directly from the auth card
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();

    // Favorites should persist
    await expect(page.locator(".favorite-chip")).toBeVisible();
  });

  test("guest mode: search weather without logging in", async ({ page }) => {
    await page.goto("/");

    // Guest mode: search bar and auth card visible, auth-only UI hidden
    await expect(page.locator(".search-bar")).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator(".auth-benefits")).toBeVisible();
    await expect(page.locator('[data-testid="logout-button"]')).not.toBeVisible();
    await expect(page.locator("#history-button")).not.toBeVisible();
    await expect(page.locator("#favorites-container")).not.toBeVisible();

    // Search for a city
    await page.fill("#search-input", "Denver");
    await page.click("#search-button");
    await expect(page.locator(".current-weather")).toBeVisible({ timeout: 10000 });

    // No star button for guests
    await expect(page.locator("#fav-toggle")).not.toBeVisible();

    // Login link appears after search (auth card is hidden)
    await expect(page.locator("#login-link")).toBeVisible();
  });
});
