# Asta — Improvements Backlog

A standing, categorized checklist of improvement opportunities across the app.
Grounded in a full screen-by-screen sweep (see **Recently shipped** at the
bottom for what's already done so it isn't re-done).

**Legend** — priority `P1` (high) · `P2` (medium) · `P3` (nice-to-have) ·
effort `S` (hours) · `M` (a day) · `L` (multi-day).

---

## 1. Testing & CI
- [x] **Client unit-test harness** — jest-preset-angular stood up (jsdom, no browser); `npm test` runs server + client. First specs green (ledger pure fn, daily-plan service via HttpClientTesting). _Remaining:_ `P2·M` broaden coverage to more services + a few signal-heavy components.
- [ ] `P1·M` **Expand e2e** — extend the new Playwright smoke suite (`e2e/`) to authenticated flows via the seeded demo user (login → dashboard → take a quiz → see ledger event), gated behind an env flag so the no-backend smoke run stays green.
- [ ] `P1·S` **Wire e2e into CI** — add a GitHub Actions job that boots Mongo+Redis, seeds, starts the app, and runs `npm run test:e2e`.
- [ ] `P2·M` **Server test coverage** — broaden beyond the existing ~12 unit tests; add tests for the newly-wired ledger events (certificate/flow/viva/daily-plan) and the daily-plan carry-over/reorder logic.
- [ ] `P3·S` **Coverage reporting** — emit coverage in CI and add a badge.

## 2. Accessibility
- [x] Icon-only buttons have aria-labels (swept: voice-room, project-studio, etc.).
- [x] All form `<input>`s are labelled (verified: 0 unlabelled inputs).
- [x] **Focus management** — focus moves into `#main-content` on route change; the Modal already traps + restores focus.
- [x] **ARIA live regions (toasts)** — the toast container is `aria-live="polite"`. _Remaining:_ `P2·S` add a live region for streaming AI output.
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
- [x] **Strict templates** — already enabled in `tsconfig.json` (`strictTemplates: true`).

## 5. Security & dependencies
- [x] **Dependency audit (triaged)** — all 49 advisories sit in the **dev/build toolchain** (webpack-dev-server, sockjs, uuid-via-webpack, @angular-devkit/build-angular), not the production runtime. `npm audit fix` (non-breaking) fixes **none** of them; every fix needs `--force` = a major Angular devkit upgrade. _Deferred as a dedicated upgrade:_ `P2·L` bump @angular-devkit/build-angular to clear the dev-tooling advisories.
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
- [x] **Keyboard-shortcuts help overlay** (`?`) — modal listing app + palette shortcuts.
- [x] **Command-palette quick actions** — New learning flow, Toggle theme, Sign out (action callbacks).
- [ ] `P2·S` **Undo for destructive actions** — deleting a flow/space/source/application is immediate; add an undo toast or confirm.
- [ ] `P2·M` **Bulk actions** — multi-select on applications, mistakes, notifications (mark/clear/export).
- [ ] `P3·M` **Notifications page** — the bell is capped at 30; add a full `/app/notifications` history with filters by `type`.
- [ ] `P3·M` **Today reflection journal** — optional mood + one-line note per day, surfaced in the week strip.

## 9. Observability
- [x] **Global client `ErrorHandler`** — swallows benign noise, prompts reload on stale chunk loads, logs + shows one throttled toast (no longer silent). _Remaining:_ `P2·S` add a transport to POST client errors to a server feed/Sentry.
- [ ] `P3·S` **Web-vitals** — emit LCP/CLS/INP via the product-analytics `track()` channel.

## 10. PWA / offline
- [ ] `P3·M` **Expand offline coverage** — the offline cache + sync queue exist; extend the cached GET allowlist and add offline-friendly empty states on more screens.

## 11. Docs & DevEx
- [ ] `P2·S` **Pre-commit hooks** — husky + lint-staged. _Deferred:_ the server lint script bakes in `--fix` (mutates files) and flat-config resolution from the monorepo root is fiddly; do it once client lint exists so one lint-staged config covers both.
- [ ] `P3·S` **API docs** — generate/serve OpenAPI (Swagger) from the Nest controllers.
- [ ] `P3·S` **ADRs** — short architecture-decision records for the big calls (Agent OS pipeline, provider abstraction, entitlements).

---

## Recently shipped (this sweep)
Branch `feat/daily-plan-deepening`, additive/low-risk, each commit build-verified:

### Feature-depth sweep (latest)
Deepening existing features with genuinely useful capabilities (not data-surfacing):

- **Applications** — hiring-pipeline funnel (Saved → Applied → Interview → Offer) with interview/offer conversion rates; search by company/role; sort (recent / best match / company A–Z).
- **Flow Studio** — portfolio summary (active count · avg progress · completed); status filter (active/completed/draft/archived) alongside difficulty; sort (recently updated / progress / title).
- **Mistake OS** — search concepts; sort by severity / most-seen / recency (the spaced-review "due" queue keeps its priority order).
- **Dashboard** — surfaces today's daily-plan progress (ring + done/total + next concrete item) linking to the Today surface.
- **Quiz Studio** — in-attempt question navigator (jump to any question; filled = answered) for long quizzes; result "Incorrect only" review filter (preserving original question numbers).
- **Roadmap** — projected finish date computed from real pace (weeks completed ÷ days elapsed), with weeks/days-left and sensible fallbacks.
- **Community** — thread-list search + sort (recent / top-voted / most replies).
- **Knowledge Hub** — "Scope: all ready" / "Clear" controls to scope grounded chat across many docs at once (was one-by-one).
- **Interview OS** — **Skip question** during an active session (server `:id/skip` route + client) — advances without scoring; the report already renders skipped items.
- **Simulation Labs** — status filter (any / in-progress / finished) to resume unfinished rounds or review completed ones.

### Deeper-capability work (cross-feature)
Beyond per-screen affordances — tightening loops and adding operator depth:

- **Learning loop** — Dashboard now surfaces a **spaced-review nudge** (concepts due for recall) that deep-links to the Mistakes "due" queue; Mistake OS honors `?filter=` deep-links.
- **Resume where you left off** — Flow cards have a **"Resume next step"** button; flow-detail honors `?node=next` (or a node id) and focuses the first incomplete node. (Simulations/interviews already resume on open.)
- **Admin** — export the (filtered) **student roster as CSV**.
- **Founder** — **derived KPIs** founders track: ARPU, paid-conversion rate, 14-day signup total, subs/org — all computed from existing aggregates.

- **Daily Plan** — per-item notes, carry-over of unfinished items, focus timer, drag-to-reorder, "finish by ~HH:MM", and a one-per-day `daily_plan_completed` proof event.
- **Proof Ledger** — wired 3 orphaned event kinds (`certificate_earned`, `flow_generated`, `voice_viva_passed`); fixed a `practice_solved` crash + added a defensive kind lookup; added a 13-week activity heatmap; seeded the new events.
- **Surfaced received-but-unrendered data** — interview strengths, resume generated-date, simulation rubric scores, study-space voice links + source URLs, outcome-council reasoning, portfolio highlights + timeline, course lesson content + narration script, cohort leaderboard readiness/active-days, founder plan-mix, notification type glyphs.
- **Correctness/UX** — error-vs-empty states on certificates & marketplace, mentor-sessions deep-link + nav/palette entry, streak harmonized.
- **A11y** — aria-labels on icon-only buttons; route-change focus management; toast live region.
- **UX** — keyboard-shortcuts overlay (`?`), command-palette quick actions (new flow / theme / sign out).
- **Observability** — global client `ErrorHandler` (chunk-reload prompt + throttled toast).
- **Security** — dependency audit triaged (all 49 are dev-tooling, need a major devkit upgrade).
- **Testing** — first Playwright public-page smoke suite + scripts (`e2e/`); Jest client unit-test harness + first specs.
