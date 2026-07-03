import { test, expect, request as pwRequest, type Page } from '@playwright/test';

/**
 * Full-stack smoke of the student journeys that were reported flaky: the roadmap
 * generator, the voice room, and an end-to-end course generation. These guard the
 * exact screens against runtime regressions (e.g. from framework upgrades). Course
 * generation runs deterministically when the API is in mock mode (as in CI). Skips
 * cleanly when the backend isn't reachable.
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const STUDENT = { email: 'student@asta.dev', password: 'student12345' };

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

async function loginAsStudent(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(STUDENT.email);
  await page.locator('input[type="password"]').fill(STUDENT.password);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).toHaveURL(/\/(app|onboarding)(\/|$)/, { timeout: 20_000 });
}

test.describe('student critical journeys', () => {
  test.beforeAll(async () => {
    test.skip(!(await backendUp()), 'backend API not reachable — skipping journeys');
  });

  test('roadmap generator renders with the action wired', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/app/roadmap/generate', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /generate your roadmap/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: /generate roadmap/i }),
    ).toBeVisible();
  });

  test('voice room lobby renders', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/app/voice-room', { waitUntil: 'domcontentloaded' });
    // The page title also appears in the topbar; scope to the main content region.
    await expect(
      page.locator('#main-content').getByRole('heading', { name: /voice room/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/start a voice session/i)).toBeVisible();
  });

  test('course builder generates a course end-to-end', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/app/course-builder', { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('#main-content').getByRole('heading', { name: /course builder/i }),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder(/teach the mern stack/i).fill(
      'Intro to TypeScript for beginners',
    );
    await page.getByRole('button', { name: /^generate/i }).first().click();

    // On success the app routes to the freshly drafted course's detail page.
    await expect(page).toHaveURL(/\/app\/course-builder\/[^/]+$/, {
      timeout: 45_000,
    });
  });

  test('quiz studio: generate → take → submit, and the ledger renders proof', async ({ page }) => {
    await loginAsStudent(page);

    // The Proof-of-Learning ledger is an authenticated surface — it must render
    // (with events or an honest empty state) once we're signed in.
    await page.goto('/app/ledger', { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('#main-content').getByRole('heading', { name: /proof-of-learning/i }),
    ).toBeVisible({ timeout: 20_000 });

    // Generate a quiz (deterministic in mock mode), take it and submit it.
    await page.goto('/app/quizzes', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder(/recursion, sql joins/i).fill('Arrays and recursion');
    await page.getByRole('button', { name: /generate quiz/i }).click();

    // The freshly generated quiz surfaces a Take button (or the app may drop us
    // straight into the attempt with a Submit button — handle both).
    const submit = page.getByRole('button', { name: /submit quiz/i });
    const take = page.getByRole('button', { name: /^(take|retake)/i }).first();
    await expect(take.or(submit)).toBeVisible({ timeout: 45_000 });
    if (await take.isVisible().catch(() => false)) await take.click();
    await expect(submit).toBeVisible({ timeout: 20_000 });

    // Answer every question (first option for MCQ, a stub for free-text) so the
    // Submit button unlocks, then submit and assert a real score renders.
    const questions = page.locator('.q-flow .motion-card-reveal');
    const count = await questions.count();
    for (let i = 0; i < count; i++) {
      const card = questions.nth(i);
      const opt = card.locator('label.opt').first();
      if (await opt.count()) await opt.click();
      else await card.locator('textarea').first().fill('My answer.');
    }
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(
      page.locator('#main-content').getByRole('heading', { name: /correct/i }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('resources: seeded catalog renders and saving builds the library', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/app/resources', { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('#main-content').getByRole('heading', { name: /resources/i }),
    ).toBeVisible({ timeout: 20_000 });

    // The shipped catalog auto-seeds on boot, so real entries must render.
    await expect(page.getByText('Browse the catalog')).toBeVisible();
    const firstSave = page.getByRole('button', { name: /^save$/i }).first();
    await expect(firstSave).toBeVisible({ timeout: 20_000 });

    // Save → the personal library section appears with the item.
    await firstSave.click();
    await expect(page.getByText('My library')).toBeVisible({ timeout: 10_000 });
  });
});
