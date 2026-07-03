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
- [x] **Wire e2e into CI** — `ci.yml` now has an `e2e` job: installs Playwright Chromium, runs the smoke suite (auto-starts the client; no backend needed), uploads traces on failure. _Remaining:_ once the authenticated-flow specs exist (item above), extend the job with Mongo+Redis services + seed.
- [ ] `P2·M` **Server test coverage** — broaden beyond the existing ~12 unit tests; add tests for the newly-wired ledger events (certificate/flow/viva/daily-plan) and the daily-plan carry-over/reorder logic.
- [ ] `P3·S` **Coverage reporting** — emit coverage in CI and add a badge.

## 2. Accessibility
- [x] Icon-only buttons have aria-labels (swept: voice-room, project-studio, etc.).
- [x] All form `<input>`s are labelled (verified: 0 unlabelled inputs).
- [x] **Focus management** — focus moves into `#main-content` on route change; the Modal already traps + restores focus.
- [x] **ARIA live regions** — toast container is `aria-live="polite"`; the agent workspace now has a polite SR live region announcing AI response start/ready/failed.
- [ ] `P2·M` **Contrast audit** — verify OKLCH token pairs meet WCAG AA in both light and dark themes (muted text on paper is the likely offender).
- [x] **Keyboard reachability** — worked down all ~62 template-a11y findings: genuine interactive divs/rows/CTAs got role+tabindex+keyup.enter (+aria-expanded); form `<label>`s got for/id association (or a `<small>` swap where misused for styling). Mouse-only backdrops/listbox-options that already have a keyboard path (ESC, projected buttons, roving aria-activedescendant) carry justified inline disables — and the mobile drawer, which had no ESC handler, got one. The three rules are now **enforced as lint errors** so this can't regress.
- [ ] `P3·S` **`prefers-reduced-motion`** — audit the heatmap/aurora/constellation for full reduced-motion coverage.

## 3. Performance
- [x] **Bundle audit** — verified from the build stats: mermaid, katex, html2canvas and jsPDF all land in lazy chunks (initial total 577 kB raw / 156 kB transfer). jsPDF was statically imported by 3 feature chunks — `downloadPdf()` now dynamic-imports it, so the 411 kB chunk loads only on the export click.
- [ ] `P2·M` **Virtualize long lists** — ledger timeline, audit logs, admin students, community threads can grow unbounded; add CDK virtual scroll (note: CDK is not yet a dependency).
- [x] **`@defer` below-the-fold** — first `@defer` usage in the app: the dashboard learning-river (lower-section ~300px SVG) and the intelligence-cockpit skill-radar now render `on viewport`, code-splitting into lazy chunks. Each `@placeholder` reserves the exact footprint (300px / 240px) so there's no layout shift. (The ledger heatmap turned out to sit above its timeline, not below the fold, and is cheap inline divs — not worth deferring.)
- [ ] `P3·S` **Image/asset optimization** — audit any raster assets; prefer SVG (mostly already SVG).

## 4. Type safety & lint
- [x] **Client ESLint** — `angular-eslint` v18 flat config (mirrors the server's ESLint 9 + typescript-eslint 8); `npm run lint` is green (**0 problems**). Fixed the 10 real issues it surfaced (dead imports, ternary-as-statement, template `!=`, missing `aria-selected`), then closed the ~62 a11y + selector findings it had flagged and promoted those rules from `warn` to `error` (keyboard-a11y ×3, component/directive selector prefix).
- [x] **Reduce `any`** — the genuine TS `any` holes were all one root cause: the Web Speech API (lib.dom omits it). Added `core/types/web-speech.ts` (typed surface + `getSpeechRecognitionCtor()` helper) and reworked both consumers (speech-recognition service, composer mic) to use it. Client is now **any-free**; `no-explicit-any` flipped from `off` → `error` to keep it that way. (The remaining `$any(...)` matches are the Angular template helper, not the TS type — idiomatic for the discriminated-union visual-block renderer.)
- [x] **Strict templates** — already enabled in `tsconfig.json` (`strictTemplates: true`).

## 5. Security & dependencies
- [x] **Dependency audit (triaged + partially fixed)** — re-triaged the prod (`--omit=dev`) tree: it was 11 advisories. Fixed the two that don't need a major bump — removed the **unused `uuid`** dep from the server (it uses `crypto.randomUUID`), and added a root `overrides` pinning **DOMPurify** to `^3.4.0` so jspdf stops pulling its vulnerable optional `2.5.9` (we only use jsPDF's text API, never `doc.html()`, so DOMPurify is off our runtime path). Prod advisories now **9**, all needing deliberate majors:
  - [x] **Angular 18 → 20** — done: client is on Angular 20.3 (+ Jest 30); the `@angular/core` XSS/XSRF advisories are cleared. Gotchas for the next major (21+) are recorded in the project memory.
  - [x] **jspdf 2 → 4** — upgraded to 4.2.1 (prod advisories 9 → 8; the rest are the Angular major). The `pdf.ts` text API (splitTextToSize/text/addPage/save) is unchanged in v4 and the strict build is green. _Needs manual verification:_ download one resume/interview/readiness PDF and eyeball the layout.
  - _(Most remaining dev-tree advisories are still build-toolchain: webpack-dev-server/sockjs via @angular-devkit — same Angular-major upgrade clears them.)_
- [x] **Security headers** — the server middleware sets nosniff, `X-Frame-Options: DENY` (frame-ancestors equivalent), Referrer-Policy, COOP, Permissions-Policy, and now **HSTS** (180d, includeSubDomains). CSP is intentionally *not* on the API: it serves JSON under `/api`, not the SPA's HTML — and the static host now sets it: `vercel.json` ships CSP (script-src 'self' — the two inline boot scripts moved to `public/boot.js`), HSTS, nosniff, frame-deny, COOP, Permissions-Policy + immutable caching for hashed assets.
- [x] **Rate-limit coverage** — AI endpoints have a per-user limit (`AiRateLimitService`); a global per-IP limiter (300/min) covers everything; and the **credential/OTP endpoints** (login, register, verify-otp, resend-otp, google) now have a dedicated **20/min per-IP** brute-force budget. _Residual `P3`:_ swap the in-memory limiter for Redis-backed when scaling horizontally (single-instance today).
- [ ] `P3·S` **Secrets hygiene** — confirm no secrets in client env; document required server env in one place.

## 6. Internationalization
- [ ] `P2·L` **i18n coverage** — the `| t` translate pipe is wired but used in only ~5 files (topbar/sidebar/profile); the rest of the UI is hardcoded English. Extract strings to the locale catalog screen-by-screen.
- [ ] `P3·M` **Locale formatting** — route dates/numbers/currency through `Intl`/Angular pipes with the active locale (the Hinglish locale is currently a stub).

## 7. Data consistency
- [x] Streak harmonized (topbar now uses the canonical daily-plan streak).
- [x] **Audit other dual-source metrics** — verified 2026-07: health/readiness derive from ONE source everywhere (LearningIntelligenceService.overview) — skill-twin (`readiness = overview.readinessScore`, `health: overview.healthScore`), reports (`li.healthScore`), cohort leaderboards (`intelligence.overview`), dashboard/cockpit (same endpoint). The cockpit now also exposes the exact blend ("why?" drill-downs).
- [ ] `P3·S` **Timezone correctness** — daily-plan "today" uses UTC slice; verify behaviour for non-UTC users (streak/day boundaries).

## 8. Feature depth vs industry (2026-07 audit → `FEATURE_INDUSTRY_AUDIT.md`)
- [x] **Chat commands execute real changes** — "mark week 2 complete / refocus week 3 on X / restore version 2" in any chat really updates the roadmap (ChatCommandRegistry + orchestrator hook; precision-first matchers; questions never write).
- [x] **Roadmap versions (git-style)** — every generation/edit/restore is a restorable snapshot; History panel + chat restore; progress survives restores.
- [x] **Roadmap → learning deep-links** — week cards route into Tutor (learn/quiz on that topic) and per-week rework.
- [x] **Tutor past chats + large view** — session history UI (was persisted but invisible), topic deep-link prefill, working `open_route`; large-screen mode in classic tutor and Asta OS (Esc exits).
- [x] **Course Learn Mode** — full lesson bodies generated on first open (cached; honest outline offline), reader with prev/next + complete + auto-advance, progress %, continue-where-you-left-off, module-quiz CTAs, per-lesson rewrite.
- [x] ~~Doc-grounded chat picker~~ — **already existed** (KH grounded chat scopes to selected docs via documentIds; corrected in the audit).
- [x] ~~Spaced repetition~~ — **already existed** (SM-2-lite on mistakes + due queue + review UI); remaining enrichment: real re-test instead of self-report (P2, phase 2).
- [x] **Classic-tutor message actions** — copy/regenerate/edit-and-resend/stop parity with the OS canvas, plus history search.
- [x] **Extend chat commands** — daily-plan items, memory remember/forget, course archive/continue, "start my review"; every chat write returns an Undo chip (inverse command through the same audited path).
- [x] **Memory manager** — profile section lists everything Asta knows (confirmed + observed) with two-click delete; remember/forget-by-chat names exactly what changed.
- [x] **Time-based engagement** — daily inactivity + due-review nudges, Monday week-in-review digest (in-app always; email when SMTP configured), session-soon reminders (@nestjs/schedule crons, createUnique-deduped).
- [x] **Version diff view** — "What changed?" per roadmap version (week-level added/removed/changed + field changes) before restoring; plus weekly-plan ICS export.
- [x] **Round 2 (2026-07) — everything else in `FEATURE_INDUSTRY_AUDIT.md` closed**: OS cross-session search + pinned sessions + tutor export, flows complete-from-chat + "did you mean" suggester + repair-weakest, practice hidden grading cases, quiz per-question timing, interview company-archetype ladder, time-aware Today, KH audio overview, community moderation queue, opt-in peer leaderboard, resource submissions + upvotes, cockpit "why" drill-downs, resume-course strip, weekly session series.

## 9. UX & features
- [x] **Keyboard-shortcuts help overlay** (`?`) — modal listing app + palette shortcuts.
- [x] **Command-palette quick actions** — New learning flow, Toggle theme, Sign out (action callbacks).
- [x] **Confirm for destructive actions** — space delete, space-source remove, knowledge-doc delete, application remove and both bulk deletes (applications, Mistake OS) now use the armed two-click confirm pattern (label flips to "Confirm delete?", auto-disarms after 4–5s). Flows have no delete UI (archive only).
- [x] **Bulk actions** — Applications (set-status / delete) and Mistake OS (resolve / reopen / delete) support multi-select.
- [x] **Notifications page** — full `/app/notifications` history (server `?limit=`, type-filter chips, unread-only, mark-all-read, bell "See all" link).
- [x] **Today reflection journal** — optional mood (1–5) + one-line note per day (server schema + `/daily-plan/reflection`), surfaced as mood emoji in the week strip.

## 10. Observability
- [x] **Global client `ErrorHandler`** — swallows benign noise, prompts reload on stale chunk loads, logs + shows one throttled toast — and now POSTs uncaught errors to the server feed (`POST /ops/client-errors`: public, 10/min per-IP, strict payload caps; deduped + max 5/session client-side, raw `fetch` + `keepalive`). Visible in `/admin/ops`.
- [x] **Web-vitals** — dependency-free `WebVitalsService` (PerformanceObserver, outside the Angular zone) reports LCP/CLS/INP once per page load via the product-analytics `track()` channel (new whitelisted `web_vital` event).

## 11. PWA / offline
- [ ] `P3·M` **Expand offline coverage** — the offline cache + sync queue exist; extend the cached GET allowlist and add offline-friendly empty states on more screens.

## 12. Docs & DevEx
- [x] **Pre-commit hooks** — husky + lint-staged at the monorepo root: staged `server/src/**/*.ts` and `client/src/**/*.{ts,html}` are eslint-`--fix`ed against their own flat configs before every commit (the old deferral reason — no client lint — is long gone).
- [x] **API docs** — Swagger UI served at `/api/docs`, generated from the Nest controllers (non-production by default; `ENABLE_API_DOCS=true` to expose in prod).
- [ ] `P3·S` **ADRs** — short architecture-decision records for the big calls (Agent OS pipeline, provider abstraction, entitlements).

---

## Recently shipped (production-readiness sweep, 2026-06-11, branch `feat/full-revamp`)
All build-verified (server build, lint 0 errors, 19 unit tests green, client prod build warning-free):

- **jspdf 2 → 4.2.1** + dynamic import (411 kB chunk now loads on export click only); prod advisories 9 → 8.
- **Static-host security headers** — `vercel.json` CSP/HSTS/nosniff/frame-deny/COOP/Permissions-Policy + asset caching; inline boot scripts moved to `public/boot.js` so `script-src 'self'` holds.
- **Real 404 page** (`features/not-found/`) replaces the silent `**` → landing redirect.
- **Client error transport** — `POST /ops/client-errors` (public, 10/min per-IP, capped payloads) + GlobalErrorHandler beacon (deduped, max 5/session).
- **Core Web Vitals** — `WebVitalsService` emits LCP/CLS/INP via `track('web_vital')`.
- **Swagger** at `/api/docs` (non-prod by default).
- **e2e in CI** — Playwright Chromium smoke job in `ci.yml`, traces on failure.
- **Two-step delete confirms** — spaces, space sources, knowledge docs, applications (row + bulk), Mistake OS bulk.

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
- **Product analytics** — **stickiness (DAU/WAU)** KPI card + searchable event-volume list.
- **Reports** — sort the student-outcomes table (lowest-health/at-risk first, readiness, quizzes, projects, active days, name).
- **Audit logs** — export the (filtered) audit trail as CSV (compliance-friendly: ISO time, action, actor, target, metadata).
- **Billing** — export invoice history as CSV (for expense reports / accounting).
- **Admin content browsers** — CSV export for the roadmap, assessment + document inventories (respect the active search/filter).
- **Cohorts** — export a cohort's leaderboard as CSV (managers).
- **Notifications (new feature)** — full `/app/notifications` history page (server `?limit=` param up to 200, type-filter chips, unread-only toggle, mark-all-read, deep-link follow) + bell "See all" link.
- **Today reflection journal (new feature)** — end-of-day mood (1–5) + one-line note (schema `mood`/`reflection` + `/daily-plan/reflection`), surfaced as mood emoji in the activity week strip.
- **Bulk actions** — Applications (set-status / delete) and Mistake OS (resolve / reopen / delete) multi-select via forkJoin.
- **A11y** — polite screen-reader live regions announce AI response start / ready / failed across all three streaming surfaces: agent workspace, Knowledge Hub grounded chat, and the AI Tutor.
- **Proof Ledger** — export the (filtered) proof-of-learning timeline as CSV.
- **Client ESLint (infra)** — angular-eslint v18 flat config; `npm run lint` green; fixed 10 real issues.
- **Keyboard a11y + asta- selector pass** — closed all ~62 a11y/selector findings (role/tabindex/keyup handlers, label association, shell-drawer ESC, ai-* → asta-ai-* renames); the rules are now enforced as lint errors.
- **Web Speech typing** — added `core/types/web-speech.ts` (typed SpeechRecognition surface + ctor helper); reworked the speech service + composer mic off `any`. Client is any-free; `no-explicit-any` now enforced as error.
- **`@defer` below-the-fold** — dashboard learning-river + cockpit skill-radar render `on viewport` with footprint-reserving placeholders (first `@defer` usage; no layout shift).
- **Dep security** — removed the unused `uuid` server dep; `overrides`-pinned DOMPurify to a patched 3.4.x so jspdf drops its vulnerable optional copy (prod advisories 11 → 9; rest are Angular/jspdf majors, flagged).
- **Security hardening** — added HSTS to the headers middleware; gave the credential/OTP auth endpoints a tight 20/min per-IP brute-force limit (vs the global 300/min). Both verified at runtime.

- **Daily Plan** — per-item notes, carry-over of unfinished items, focus timer, drag-to-reorder, "finish by ~HH:MM", and a one-per-day `daily_plan_completed` proof event.
- **Proof Ledger** — wired 3 orphaned event kinds (`certificate_earned`, `flow_generated`, `voice_viva_passed`); fixed a `practice_solved` crash + added a defensive kind lookup; added a 13-week activity heatmap; seeded the new events.
- **Surfaced received-but-unrendered data** — interview strengths, resume generated-date, simulation rubric scores, study-space voice links + source URLs, outcome-council reasoning, portfolio highlights + timeline, course lesson content + narration script, cohort leaderboard readiness/active-days, founder plan-mix, notification type glyphs.
- **Correctness/UX** — error-vs-empty states on certificates & marketplace, mentor-sessions deep-link + nav/palette entry, streak harmonized.
- **A11y** — aria-labels on icon-only buttons; route-change focus management; toast live region.
- **UX** — keyboard-shortcuts overlay (`?`), command-palette quick actions (new flow / theme / sign out).
- **Observability** — global client `ErrorHandler` (chunk-reload prompt + throttled toast).
- **Security** — dependency audit triaged (all 49 are dev-tooling, need a major devkit upgrade).
- **Testing** — first Playwright public-page smoke suite + scripts (`e2e/`); Jest client unit-test harness + first specs.
