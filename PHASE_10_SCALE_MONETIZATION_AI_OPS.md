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

## Priority 3 — PWA / Mobile *(planned)*
Install, offline cache, sync queue, web-push foundation.

## Priority 4 — Enterprise *(planned)*
Org members/roles/security, sessions, branding, data export.

## Priority 5 — Platform / Growth *(planned)*
Developer API keys, webhooks, integrations, i18n/a11y, tests.

---

### Known limitations (Priority 1)
- Entitlements resolve from the user's own subscription; org-scoped plan inheritance is
  modeled (schema fields present) but not yet enforced.
- Hard-blocking of over-limit AI calls is opt-in via `consume(enforce:true)` / the gate;
  the central AI meter records without blocking so demos never dead-end.
- Live Stripe/Razorpay SDK calls are placeholders.

### Next phase recommendation
Proceed to Priority 2 (observability) so the metering data created here becomes a real AI
Ops + cost dashboard.
