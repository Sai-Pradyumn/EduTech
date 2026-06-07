# Asta — Improvements Backlog

A standing, categorized checklist of improvement opportunities across the app.
Grounded in a full screen-by-screen sweep (see **Recently shipped** at the
bottom for what's already done so it isn't re-done).

**Legend** — priority `P1` (high) · `P2` (medium) · `P3` (nice-to-have) ·
effort `S` (hours) · `M` (a day) · `L` (multi-day).

---

## 1. Testing & CI
- [ ] `P1·L` **Client unit tests** — the Angular client has *no* test setup. Add Jest/Karma + a handful of tests for core services (auth, daily-plan, ledger) and a couple of signal-heavy components.
- [ ] `P1·M` **Expand e2e** — extend the new Playwright smoke suite (`e2e/`) to authenticated flows via the seeded demo user (login → dashboard → take a quiz → see ledger event), gated behind an env flag so the no-backend smoke run stays green.
- [ ] `P1·S` **Wire e2e into CI** — add a GitHub Actions job that boots Mongo+Redis, seeds, starts the app, and runs `npm run test:e2e`.
- [ ] `P2·M` **Server test coverage** — broaden beyond the existing ~12 unit tests; add tests for the newly-wired ledger events (certificate/flow/viva/daily-plan) and the daily-plan carry-over/reorder logic.
- [ ] `P3·S` **Coverage reporting** — emit coverage in CI and add a badge.

## 2. Accessibility
- [x] Icon-only buttons have aria-labels (swept: voice-room, project-studio, etc.).
- [x] All form `<input>`s are labelled (verified: 0 unlabelled inputs).
- [ ] `P1·M` **Focus management** — move focus to the main heading on route change; trap focus inside modals/command palette and restore it on close.
- [ ] `P2·S` **ARIA live regions** — announce toasts and streaming AI output (`aria-live="polite"`) for screen-reader users.
- [ ] `P2·M` **Contrast audit** — verify OKLCH token pairs meet WCAG AA in both light and dark themes (muted text on paper is the likely offender).
- [ ] `P2·S` **Keyboard reachability** — ensure drag-to-reorder (Today) and hover-only affordances have keyboard equivalents.
- [ ] `P3·S` **`prefers-reduced-motion`** — audit the heatmap/aurora/constellation for full reduced-motion coverage.

## 3. Performance
- [ ] `P2·M` **Bundle audit** — confirm heavy deps (mermaid, katex, html2canvas, jsPDF, d3/venn) are all lazy/`@defer`-loaded and not pulled into the initial chunk.
- [ ] `P2·M` **Virtualize long lists** — ledger timeline, audit logs, admin students, community threads can grow unbounded; add CDK virtual scroll (note: CDK is not yet a dependency).
- [ ] `P3·S` **`@defer` below-the-fold** — defer the ledger heatmap, dashboard learning-river, and other non-critical blocks.
- [ ] `P3·S` **Image/asset optimization** — audit any raster assets; prefer SVG (mostly already SVG).

## 4. Type safety & lint
- [ ] `P1·L` **Client ESLint** — set up `angular-eslint` (currently none). Expect a large first-pass cleanup; do it as a dedicated effort, not a tail-end add-on.
- [ ] `P2·M` **Reduce `any`** — ~58 occurrences (concentrated in `visual-block-renderer`, `speech-recognition`, `asta-os-*`). Type the justified ones with proper DOM/lib types; remove the rest.
- [ ] `P3·S` **Strict templates** — enable `strictTemplates` in `tsconfig` if not already, and fix fallout.

## 5. Security & dependencies
- [ ] `P1·S` **Dependency audit** — `npm install` reports ~49 advisories (5 low / 15 moderate / 28 high / 1 critical). Triage and `npm audit fix` the safe ones; document the rest.
- [ ] `P2·M` **CSP / security headers** — verify Content-Security-Policy, HSTS, and frame-ancestors are set (helmet is present server-side; confirm the policy is tight, not default).
- [ ] `P2·S` **Rate-limit coverage** — confirm auth endpoints + AI endpoints have per-IP and per-user limits (per-user AI limit exists; verify auth brute-force protection).
- [ ] `P3·S` **Secrets hygiene** — confirm no secrets in client env; document required server env in one place.

## 6. Internationalization
- [ ] `P2·L` **i18n coverage** — the `| t` translate pipe is wired but used in only ~5 files (topbar/sidebar/profile); the rest of the UI is hardcoded English. Extract strings to the locale catalog screen-by-screen.
- [ ] `P3·M` **Locale formatting** — route dates/numbers/currency through `Intl`/Angular pipes with the active locale (the Hinglish locale is currently a stub).

## 7. Data consistency
- [x] Streak harmonized (topbar now uses the canonical daily-plan streak).
- [ ] `P2·S` **Audit other dual-source metrics** — health/readiness appear in multiple places (dashboard, cohort, reports, skill-twin); confirm they derive from one source.
- [ ] `P3·S` **Timezone correctness** — daily-plan "today" uses UTC slice; verify behaviour for non-UTC users (streak/day boundaries).

## 8. UX & features
- [ ] `P2·M` **Keyboard-shortcuts help overlay** (`?`) — discoverable list of shortcuts; complements the existing ⌘K palette.
- [ ] `P2·M` **Command-palette quick actions** — beyond navigation: "Generate today's plan", "Start a mock interview", "New flow".
- [ ] `P2·S` **Undo for destructive actions** — deleting a flow/space/source/application is immediate; add an undo toast or confirm.
- [ ] `P2·M` **Bulk actions** — multi-select on applications, mistakes, notifications (mark/clear/export).
- [ ] `P3·M` **Notifications page** — the bell is capped at 30; add a full `/app/notifications` history with filters by `type`.
- [ ] `P3·M` **Today reflection journal** — optional mood + one-line note per day, surfaced in the week strip.

## 9. Observability
- [ ] `P2·M` **Client error tracking** — wire a global `ErrorHandler` that reports to the existing server error feed (or Sentry) instead of only `console`.
- [ ] `P3·S` **Web-vitals** — emit LCP/CLS/INP via the product-analytics `track()` channel.

## 10. PWA / offline
- [ ] `P3·M` **Expand offline coverage** — the offline cache + sync queue exist; extend the cached GET allowlist and add offline-friendly empty states on more screens.

## 11. Docs & DevEx
- [ ] `P2·S` **Pre-commit hooks** — husky + lint-staged to run server lint (and client lint once it exists) before commit.
- [ ] `P3·S` **API docs** — generate/serve OpenAPI (Swagger) from the Nest controllers.
- [ ] `P3·S` **ADRs** — short architecture-decision records for the big calls (Agent OS pipeline, provider abstraction, entitlements).

---

## Recently shipped (this sweep)
Branch `feat/daily-plan-deepening`, additive/low-risk, each commit build-verified:

- **Daily Plan** — per-item notes, carry-over of unfinished items, focus timer, drag-to-reorder, "finish by ~HH:MM", and a one-per-day `daily_plan_completed` proof event.
- **Proof Ledger** — wired 3 orphaned event kinds (`certificate_earned`, `flow_generated`, `voice_viva_passed`); fixed a `practice_solved` crash + added a defensive kind lookup; added a 13-week activity heatmap; seeded the new events.
- **Surfaced received-but-unrendered data** — interview strengths, resume generated-date, simulation rubric scores, study-space voice links + source URLs, outcome-council reasoning, portfolio highlights + timeline, course lesson content + narration script, cohort leaderboard readiness/active-days, founder plan-mix, notification type glyphs.
- **Correctness/UX** — error-vs-empty states on certificates & marketplace, mentor-sessions deep-link + nav/palette entry, streak harmonized.
- **A11y** — aria-labels on icon-only buttons.
- **Testing** — first Playwright public-page smoke suite + scripts (`e2e/`).
