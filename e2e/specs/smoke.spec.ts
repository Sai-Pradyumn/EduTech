import { test, expect, type Page } from '@playwright/test';

function gotoApp(page: Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' });
}

/**
 * Public-page smoke tests — assert only static, render-time content so they
 * pass with just the client running (no backend / auth required).
 */
test.describe('public pages smoke', () => {
  test('landing page renders', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(page).toHaveTitle(/Asta/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page shows the sign-in form', async ({ page }) => {
    await gotoApp(page, '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('register page shows the sign-up form', async ({ page }) => {
    await gotoApp(page, '/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('pricing page renders', async ({ page }) => {
    await gotoApp(page, '/pricing');
    await expect(page.getByText(/every plan runs on the full agent OS/i)).toBeVisible();
  });

  test('unknown route redirects home (catch-all)', async ({ page }) => {
    await gotoApp(page, '/this-route-does-not-exist');
    await expect(page).toHaveTitle(/Asta/i);
  });
});
