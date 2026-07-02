import { test, expect, request as pwRequest, type Page } from '@playwright/test';

/**
 * Screen audit: a logged-in student walks every core screen; each must render
 * real content into #main-content and throw ZERO uncaught exceptions. This is
 * the wholesale "every screen works" net — a broken component, a bad template
 * binding or a crashing service turns the walk red with the route name.
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const STUDENT = { email: 'student@asta.dev', password: 'student12345' };

/** Static (param-free) student routes considered core product surface. */
const ROUTES = [
  '/app/dashboard',
  '/app/today',
  '/app/tutor',
  '/app/mentor-room',
  '/app/roadmap',
  '/app/roadmap/generate',
  '/app/flows',
  '/app/visuals',
  '/app/spaces',
  '/app/simulations',
  '/app/knowledge',
  '/app/resources',
  '/app/quizzes',
  '/app/projects',
  '/app/course-builder',
  '/app/cohorts',
  '/app/live-sessions',
  '/app/peer-rooms',
  '/app/community',
  '/app/voice-room',
  '/app/workflows',
  '/app/career-coach',
  '/app/content-studio',
  '/app/progress',
  '/app/skill-twin',
  '/app/mistakes',
  '/app/mentor-council',
  '/app/interview',
  '/app/career-readiness',
  '/app/portfolio',
  '/app/resume',
  '/app/applications',
  '/app/skill-passport',
  '/app/replay',
  '/app/ledger',
  '/app/notifications',
  '/app/profile',
];

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

/**
 * Patient login: the audit project runs right after the parallel suite, which
 * may have burned the API's per-IP rate window — so a 429'd login attempt gets
 * retried after the window resets instead of failing the whole audit.
 */
async function loginAsStudent(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(STUDENT.email);
    await page.locator('input[type="password"]').fill(STUDENT.password);
    await page.locator('button[type="submit"]').first().click();
    const landed = await page
      .waitForURL(/\/(app|onboarding)(\/|$)/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (landed) return;
    // Likely rate-limited — wait out the 60s window and try again.
    await page.waitForTimeout(25_000);
  }
  await expect(page).toHaveURL(/\/(app|onboarding)(\/|$)/, { timeout: 5_000 });
}

test.describe('student screen audit', () => {
  test.beforeAll(async () => {
    test.skip(!(await backendUp()), 'backend API not reachable — skipping audit');
  });

  test('every core screen renders without uncaught exceptions', async ({ page }) => {
    // Generous budgets: on a cold dev server each lazy route compiles its chunk
    // on first visit (can exceed 15s for chart-heavy screens). Prod is instant.
    test.setTimeout(420_000);

    const crashes: string[] = [];
    page.on('pageerror', (err) => {
      crashes.push(`${page.url()} → ${err.message}`);
    });

    await loginAsStudent(page);

    for (const route of ROUTES) {
      await test.step(route, async () => {
        // Pace the walk: every goto is a full app boot (session restore + data
        // fetches), and an unthrottled sprint trips the API's per-IP rate limit.
        await page.waitForTimeout(1200);
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        const main = page.locator('#main-content');
        await expect(main, `${route} must render content`).toBeVisible({
          timeout: 30_000,
        });
        // "Renders" means real DOM, not a blank shell.
        await expect
          .poll(async () => (await main.innerText()).trim().length, {
            timeout: 15_000,
            message: `${route} rendered an empty main region`,
          })
          .toBeGreaterThan(0);
      });
    }

    expect(crashes, `uncaught exceptions:\n${crashes.join('\n')}`).toEqual([]);
  });
});
