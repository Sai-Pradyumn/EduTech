import { test, expect } from '@playwright/test';

/**
 * Public-page smoke tests — assert only static, render-time content so they
 * pass with just the client running (no backend / auth required).
 */
test.describe('public pages smoke', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Asta/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page shows the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('register page shows the sign-up form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('pricing page renders', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/every plan runs on the full agent OS/i)).toBeVisible();
  });

  test('unknown route redirects home (catch-all)', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveTitle(/Asta/i);
  });
});
