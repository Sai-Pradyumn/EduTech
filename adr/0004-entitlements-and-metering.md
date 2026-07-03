# ADR 0004 — Entitlements & metering (plan-based access + usage limits)

**Status:** Accepted

## Context

Asta is also a SaaS: features and AI usage must vary by plan, orgs must be billable,
and AI cost must be bounded so a single user (or a runaway loop) can't burn the
budget. We needed one authority for "can this user do this, right now?" rather than
plan checks sprinkled through controllers, and it had to keep working with payments
in mock mode (no real processor required to develop or demo).

## Decision

A dedicated entitlements authority (`server/src/modules/entitlements/entitlements.service.ts`)
answers plan-based access, and metering is enforced at the AI boundary.

- **Entitlements, not ad-hoc plan checks.** Feature access derives from the active
  plan/org in one place; the client mirrors it (`core/services/entitlement.service.ts`)
  to gate UI, but the server is the source of truth.
- **Metering at the gateway.** A per-user AI rate limit (`ai/guards/ai-rate-limit.service.ts`,
  `AI_USER_RATE_PER_MIN`) plus a global per-IP limiter bound AI spend independently of
  feature flags; usage is logged (`ai/schemas/ai-usage-log.schema.ts`) for cost/ops.
- **Billing is pluggable and mockable.** `modules/billing` abstracts the processor
  (Razorpay/Stripe) with an instant mock checkout by default, so entitlements are
  fully exercisable without a live payment provider.

## Consequences

- Access rules live in one auditable place; adding a gated feature is a plan/entitlement
  change, not scattered `if (plan === …)` checks.
- AI cost has a hard ceiling per user and globally, decoupled from what features exist.
- Dev/CI/demo run end-to-end without a real payment processor.
- Cost: entitlement state must stay in sync across server truth and client mirror, and
  plan changes have to invalidate cached entitlements promptly.
