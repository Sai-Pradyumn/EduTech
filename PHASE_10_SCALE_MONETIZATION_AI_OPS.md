# Phase 10 — Scale, Monetization, AI Ops & Enterprise Reliability

**Vision.** Move Asta from "impressive AI education product" to a real SaaS platform:
metered, monetizable, observable, secure, mobile-friendly, enterprise-ready. No new
learning features, no redesign — production-grade infrastructure under the existing Noir
Cockpit product. Mock providers stay the default; nothing here requires paid API keys.

Work ships **priority by priority**, one commit per priority with a complete end-to-end
flow (schema → service → API → client → nav → seed → green build).

---

## Priority 1 — Entitlements, Plans, AI Metering & Feature Flags ✅

The monetization & access-control spine. Every paid/limited capability is now a metered
`FeatureKey` gated by plan, and the AI layer meters itself on every call.

### Modules added
- **`entitlements`** (`@Global`) — `EntitlementUsage` schema + `EntitlementsService`
  (`resolvePlan`, `check`, `consume`, `summary`) + controller. Reads the `Subscription`
  model directly so `AiModule` can depend on it without a circular dependency.
- **`feature-flags`** (`@Global`) — catalog of 15 flags + `FeatureFlag` override schema +
  `FeatureFlagsService` (`publicMap`, `isEnabled`, `list`, `set`) + controller.
- **`billing` upgraded** — 5-plan catalog with full limit maps, `PaymentProvider`
  abstraction (Mock default; Stripe/Razorpay placeholders), change-plan / cancel / invoices
  / admin overview.

### Plans (`server/.../billing/plans.ts`)
`free · pro · team · institution · enterprise`, each with a complete `LimitMap` over 20
`FeatureKey`s (AI messages/tokens, RAG docs, flow/visual/voice/sim/quiz/project generations,
org seats/cohorts, certificates, API keys, export, advanced analytics, marketplace publish,
white-label). `-1` = unlimited, `0` = blocked.

### AI metering (M2 groundwork)
`ai_usage_logs` enriched with `org`, `feature`, `model`, `strategy`, `status`,
`fallbackUsed`, `errorCode`, `validationPassed`. `AiService.record()` now:
- writes the enriched log,
- consumes `ai.messages` + `ai.tokens` entitlement counters,
- maps the tagged `feature` → its specific counter (`flow→flow.generations`,
  `visual→visual.generations`, `quiz→quiz.generations`, `project→project.reviews`,
  `simulation→simulation.sessions`) — a single source of truth.

Generation entry points (flow, visual, quiz, project) tag `meta.feature`, so they consume
the right meter automatically.

### Routes added
| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/entitlements/me` | Full entitlement summary |
| POST | `/entitlements/check` | Non-mutating limit check |
| POST | `/entitlements/consume` | Enforced consume |
| GET | `/billing/usage` | Usage + cost-by-feature breakdown |
| GET | `/billing/invoices` | Invoice history |
| POST | `/billing/checkout(/mock)` | Mock/provider checkout |
| POST | `/billing/change-plan` | Switch plan |
| POST | `/billing/cancel` | Cancel at period end |
| GET | `/billing/admin/overview` | MRR, plan distribution (admin) |
| GET | `/billing/admin/accounts` | Account roster (admin) |
| GET | `/feature-flags` | Public flag map |
| GET | `/admin/feature-flags` | Resolved flags (admin) |
| PATCH | `/admin/feature-flags/:key` | Flip a flag (admin) |

### Client
- `EntitlementService` (signal-cached `summary` + `can()` + `check/consume`),
  `FeatureFlagService` (signal `flags` + `isOn()`), extended `BillingService`.
- **`<asta-entitlement-gate feature="…">`** shared component — projects content when
  allowed, else a compact on-brand upgrade panel (never a hero).
- **Billing page rebuilt** — current plan + status + cancel, AI usage gauge, **plan-limits
  meters**, **AI cost-by-feature**, 5-plan grid (individual/org badges, Enterprise =
  "Contact sales"), invoices.
- **Admin** — Billing Overview (MRR, plan distribution, accounts) + Feature Flags control
  room (runtime toggles, kill-switch labels). New admin nav group "Platform".
- Shell loads entitlements + flags once on boot so gates/flags resolve app-wide.

### Feature flags (15)
`ENABLE_FLOW_STUDIO, ENABLE_VISUAL_STUDIO, ENABLE_VOICE, ENABLE_STUDY_SPACES,
ENABLE_SKILL_PASSPORT, ENABLE_PORTFOLIO, ENABLE_MARKETPLACE, ENABLE_PAYMENT_PROVIDER,
ENABLE_WEB_PUSH, ENABLE_OFFLINE_MODE, ENABLE_DEVELOPER_API, ENABLE_INTEGRATIONS,
ENABLE_AI_PARALLEL_STRATEGY, ENABLE_IMAGE_GENERATION, ENABLE_FINE_TUNING`.

### Provider abstractions
`PaymentProvider` interface → `MockPaymentProvider` (default, no keys),
`StripePaymentProvider` / `RazorpayPaymentProvider` placeholders. Live providers activate
only behind `ENABLE_PAYMENT_PROVIDER` + keys.

### Seed
Student → Pro, Mentor → Free, Admin → Enterprise subscriptions; a paid Pro invoice; 28 days
of AI usage logs across 6 features (with occasional fallback/validation-fail rows);
entitlement meters for the student; flag overrides (image-gen off, web-push on).

### Security / privacy notes
- API keys / payment refs are mock; no real secrets stored.
- Entitlement metering never throws into the product path (fails open, logs a warning).
- No raw prompts are persisted by the metering layer.

### Build status
`build:server` ✅ · `build:client` ✅ (529 kB initial) · `seed` ✅ · runtime boot ✅
(all new routes mapped, DI resolved) · Phase-10 files lint-clean.

---

## Priority 2 — Production Operations ✅

Observability over the metering data created in Priority 1: AI cost/health dashboards, an
Ops command center, audit trail, request/error correlation and a product-analytics funnel
engine.

### Modules added
- **`ops`** (`@Global`) — `ErrorLog` + `JobRun` schemas, `OpsService` (health/metrics, a
  queue-agnostic job ledger with retry, persisted error feed), `/ops/*` controller.
- **`audit`** (`@Global`) — `AuditLog` schema + `AuditService.record()` (never throws) +
  `/admin/audit-logs` (admin) and `/org/audit-logs` (org-scoped). Feature-flag changes now
  emit audit entries.
- **`ai-ops`** — `AiBudgetPolicy` schema + `AiOpsService` (cost by day/feature, top
  spenders, fallback/error rates, latency, live provider health via the gateway snapshot) +
  `/admin/ai-ops/*` + budget CRUD.
- **`product-analytics`** (`@Global`) — `ProductEvent` schema + `ProductAnalyticsService`
  (18-event whitelist, prop sanitization, activation/monetization/outcome funnels, DAU/WAU,
  retention) + `/analytics/track` + `/admin/product-analytics/*`.

### Error IDs & structured logging (M7)
- `request-id` middleware → stable `requestId` + `X-Request-Id` on every request.
- `AllExceptionsFilter` rewritten: attaches `errorId` + `requestId` to every error envelope,
  persists 5xx to the Ops error feed and logs them structurally — **never leaks stacks**.

### Routes added
`/ops/health|metrics|jobs|jobs/failed|jobs/:id/retry|errors|realtime|storage`,
`/admin/ai-ops/overview|costs|usage|providers|budget/:ownerType/:ownerId`,
`/admin/product-analytics/overview|funnels|retention`, `/analytics/track`,
`/admin/audit-logs`, `/org/audit-logs`.

### Client
- `OpsService` (consolidated admin reads) + `ProductAnalyticsService` (fire-and-forget
  `track()`). Billing emits `billing_upgrade_clicked`/`subscription_started`; shell emits
  `user_returned`.
- Admin pages: **AI Ops** (cost/latency/error tiles, cost-by-feature, provider health, top
  spenders), **Ops Command Center** (health/uptime/memory, deps, job ledger with retry,
  error feed with IDs), **Product Analytics** (DAU/WAU, funnels, event volume), **Audit
  Logs**. All under the admin "Platform" nav group; lazy-loaded.

### Seed
28 days of product events (full funnel), a job ledger with a failed→retryable job, a sample
error-log row, an audit entry.

### Build status
`build:server` ✅ · `build:client` ✅ · `seed` ✅ · runtime boot ✅ (all `/ops`, `/ai-ops`,
`/product-analytics`, `/audit-logs` routes mapped, DI resolved) · Phase-10 files lint-clean.

## Priority 3 — PWA, Mobile & Offline Learning ✅

Built on the existing PWA shell (manifest + service worker + icons already shipped in B14).
Adds real offline learning data, a sync queue and a web-push foundation.

### Client services (M4)
- `NetworkStatusService` — reactive `online` signal from browser events.
- `LocalCacheService` — dependency-free promise-based IndexedDB wrapper (stores:
  `resources`, `drafts`, `syncQueue`); degrades gracefully when IDB is unavailable.
- `OfflineService` — save/list/remove offline resources (roadmaps/flows/notes/flashcards/
  spaces) + local drafts (quiz/project/notes); reactive counts.
- `SyncQueueService` — persists mutations made offline and **replays them oldest-first on
  reconnect** (auto-flush effect; never queues AI generation/payments).
- `WebPushService` — permission + PushManager subscribe behind `ENABLE_WEB_PUSH`; no-ops
  cleanly when unsupported/unconfigured.

### Service worker (enhanced → `asta-v2`)
- Stale-while-revalidate cache for a **safe allowlist** of read-only GET APIs (roadmap,
  flows, spaces, quizzes, projects, skill-passport) so recently-viewed data reads offline.
- `push` + `notificationclick` handlers render and route web-push notifications.

### Server (M4/M5)
- `push` module (`@Global`): `PushSubscription` schema + `PushService`
  (`vapidPublicKey`, `subscribe`, `unsubscribe`, `notify` — safe no-op until VAPID
  configured) + `/push/vapid-public-key|subscribe`.

### UI
- **`/app/offline`** page — connection state, what works offline, saved resources, local
  drafts, sync queue (with "Sync now"), web-push opt-in.
- Shell **offline / pending-sync banner** (links to the offline page).
- Reusable **`<asta-offline-toggle>`** — "Make available offline"; wired into the roadmap
  detail header as the worked example.
- "Offline & Sync" added to the Account nav group.

### Build status
`build:server` ✅ · `build:client` ✅ · runtime boot ✅ (push routes mapped) · new files
lint-clean. No paid keys required; web push is foundation-only until VAPID is set.

## Priority 4 — Enterprise: Sessions, Branding & Data Governance ✅

Org members/roles already existed in the tenancy module; this priority adds the missing
enterprise controls.

### Modules added
- **`sessions`** (`@Global`, M6) — `Session` schema + service (record on login, list, revoke,
  revoke-all). Auth controller records a session (device parsed from UA, IP) on login/
  register; `/auth/sessions` (GET), `/auth/sessions/:id` (DELETE), `/auth/logout-all`.
- **`org-branding`** (M15) — `OrgBranding` schema + service + `/org/branding` (GET/PATCH,
  OrgManage) + `Public` `/org/:orgId/branding/public`. Updates are audited; subtle/token-based.
- **`data-governance`** (M14) — `DataJob` schema + service; `/data/export/me`,
  `/data/export/jobs`, `/data/delete-request`, `/org/data/export`,
  `/admin/data-governance/retention`. Requests are audited; retention policy exposed.

### Client
- `EnterpriseService`. Pages: **Security & devices** (`/app/security`), **Your data**
  (`/app/data`), **Org branding** (`/app/org/branding`, live certificate preview). Nav:
  Security + Your Data under Account; Branding under Workspace.

### Seed
Two student sessions; Sreenidhi College branding.

### Build status
`build:server` ✅ · `build:client` ✅ · `seed` ✅ · runtime boot ✅ · Phase-10 files lint-clean.

## Priority 5 — Developer Platform, Integrations & Tests ✅

### Modules added
- **`developer`** (M11) — `ApiKey` (SHA-256 hash only; plaintext shown once),
  `WebhookEndpoint` + `WebhookDelivery` schemas. `DeveloperService` (create/list/revoke
  keys; create/list/update/delete webhooks; **HMAC-signed test delivery** + delivery log).
  `/developer/*`, OrgManage; key + revoke actions audited.
- **`integrations`** (M12) — `IntegrationConnection` + `IntegrationSyncLog` schemas, a
  6-provider catalog (GitHub manual, Google Calendar OAuth placeholder, real `.ics`
  calendar export, Slack/Discord mock, LMS import). Connect/disconnect/sync are local-safe;
  `/integrations/calendar.ics` streams a real ICS file (bypasses the JSON envelope).

### Tests & CI (M10)
- Jest unit tests: `plans.spec.ts` (6) + `feature-flags.catalog.spec.ts` (4) — **10 passing**,
  no DB required. Root `npm test` added; CI runs install → lint → build → **test**.

### i18n / a11y (M9)
- Reuses the existing `I18nService` (locale + `t()` + timezone, persisted). New Phase-10
  components use semantic headings, `aria-pressed`/`role="switch"` toggles, `aria-current`
  nav and reduced-motion-safe skeletons.

### Client
- `DeveloperService` + **Developer** page (`/app/developer`). `IntegrationService` +
  **Integrations** page (`/app/integrations`). Nav entries under Account.

### Seed
Org API-key stub (hash only) + webhook endpoint; a connected GitHub integration.

### Build status
`build:server` ✅ · `build:client` ✅ · `seed` ✅ · `npm test` ✅ (10/10) · runtime boot ✅.

---

## Cross-cutting summary

**New server modules:** entitlements, feature-flags, ops, audit, ai-ops, product-analytics,
push, sessions, org-branding, data-governance, developer, integrations (+ billing/AI upgrades).

**Provider abstractions:** PaymentProvider (mock default + Stripe/Razorpay placeholders),
PushService (no-op until VAPID), integration connectors (mock/manual/export/oauth).

**Security & privacy:** API keys SHA-256-hashed (plaintext once); webhooks HMAC-signed;
errors carry IDs and never leak stacks; audit trail on sensitive actions; product analytics
whitelisted + sanitized; metering never blocks the product path.

---

## Phase 10.1 — Live integrations (post-launch hardening) ✅

The Phase-10 placeholders are now real, all activating behind env keys/flags with graceful
mock fallback so local dev + CI stay green without any keys.

- **Google OAuth login** — `google-auth-library` verifies the GIS credential server-side
  (`POST /auth/google`, `GET /auth/google/config`); `findOrCreateGoogle` links/provisions
  the account. Client `<asta-google-signin>` self-configures and renders only when
  `GOOGLE_CLIENT_ID` is set. Password login rejects OAuth-only accounts cleanly.
- **Web Push (VAPID)** — `web-push` wired into `PushService`; `notify()` sends real
  notifications (prunes 404/410 subs) and is fired on every in-app notification. SW already
  renders `push`/`notificationclick`. Keys via `VAPID_PUBLIC_KEY/PRIVATE_KEY` (no-op when unset).
- **Payments = Razorpay** (chosen over Stripe — flat ~2% for INR, **no fixed per-txn fee**;
  Stripe India adds a fixed fee + onboarding friction). `RazorpayPaymentProvider` creates an
  Order; client opens the Razorpay Checkout widget; server **HMAC-verifies** the signature
  (`POST /billing/verify`) and the **webhook** (`POST /billing/webhook/razorpay`, raw-body
  HMAC, idempotent). Stripe remains a same-shape placeholder selectable via `PAYMENT_PROVIDER`.
- **Entitlement org-inheritance** — `resolvePlan` now takes the higher tier of the user's own
  plan and any active **org-scoped subscription** they inherit via membership (seeded:
  Sreenidhi College on Institution).
- **AI budget enforcement at the gateway** — `enforceAiBudget` runs pre-flight on every
  `AiService` generate path (compose/generateText/stream/structured); over the monthly AI
  budget → a friendly 403 instead of a silent overage.
- **BullMQ worker** — `QueueModule.register()` wires a real BullMQ queue + `JobsProcessor`
  **only when `ENABLE_BULLMQ=true`** (Redis reachable); otherwise jobs run inline and are
  still recorded in the Ops ledger. Data-export requests enqueue through it.

Config: all new vars added to Joi validation + `.env.example`. New deps: `razorpay`,
`web-push`, `google-auth-library`. Tests: 12 passing (added plan-tier/inheritance specs).

### Known limitations / remaining
- **Playwright e2e smoke suite — NOT yet implemented** (the one deferred follow-up).
- Stripe is a placeholder (Razorpay is the implemented provider); real keys are required to
  exercise live payments/OAuth/push (mock/no-op without them).
