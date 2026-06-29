import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * Full-stack admin flow: a seeded admin logs in and opens the AI Ops dashboard,
 * which renders the live provider-health panel from the gateway snapshot. Skips
 * cleanly when the backend isn't reachable (client-only smoke runs).
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const ADMIN = { email: 'admin@asta.dev', password: 'admin12345' };

async function backendUp(): Promise<boolean> {
  try {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${API}/health`, { timeout: 3000 });
    const ok = res.ok();
    await ctx.dispose();
    return ok;
  } catch {
    return false;
  }
}

test.describe('admin AI Ops', () => {
  test.beforeAll(async () => {
    test.skip(!(await backendUp()), 'backend API not reachable — skipping admin flow');
  });

  test('admin sees the live AI provider-health panel', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/(app|onboarding|admin)(\/|$)/, { timeout: 20_000 });

    await page.goto('/admin/ai-ops', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText('Provider health · circuit breaker'),
    ).toBeVisible({ timeout: 20_000 });
    // The gateway snapshot drives a LIVE/MOCK state pill — either is a valid render.
    await expect(page.getByText(/LIVE AI|MOCK MODE/).first()).toBeVisible();
  });
});
