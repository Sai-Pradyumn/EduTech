import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * Full-stack flow: a seeded student logs in through the real UI and reaches the
 * authenticated app. This needs the backend running + seeded (`npm run dev` +
 * `npm run seed`). When the API isn't reachable — e.g. the client-only smoke job —
 * the whole file skips cleanly instead of failing, so it never produces a false red.
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const STUDENT = { email: 'student@asta.dev', password: 'student12345' };

test.describe('full-stack auth flow', () => {
  test.beforeAll(async () => {
    let reachable = false;
    try {
      const ctx = await pwRequest.newContext();
      const res = await ctx.get(`${API}/health`, { timeout: 3000 });
      reachable = res.ok();
      await ctx.dispose();
    } catch {
      reachable = false;
    }
    test.skip(!reachable, 'backend API not reachable — skipping full-stack flow');
  });

  test('a seeded student can log in and reach the app', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(STUDENT.email);
    await page.locator('input[type="password"]').fill(STUDENT.password);
    await page.locator('button[type="submit"]').first().click();

    // After auth the student is routed into the product (onboarded → /app,
    // otherwise → /onboarding); either way we must leave /login.
    await expect(page).toHaveURL(/\/(app|onboarding)(\/|$)/, { timeout: 20_000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
