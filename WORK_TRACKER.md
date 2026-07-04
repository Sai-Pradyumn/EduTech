# Asta — Work Tracker (living doc)

**Purpose:** durable memory of what's done and what's left, so nothing is lost across
context compactions. Source of truth for remaining work: `APP_FULL_AUDIT.md` (fresh,
structured, 743 lines). Older `ASTA_APP_FAILURE_AUDIT.md` is superseded for planning but
keeps its resolution logs.

**Standing constraints (do not violate):**
- Commits **without** `Co-Authored-By` trailer. Commit via `git commit -F <scratchpad file>`.
- **Never** stage `client/angular.json`, `client/public/boot.js`, `client/public/sw.js` (user's local edits).
- One gate at the **end** of a batch, not per file. Lean output.
- Never chain `npm test` && `npm run lint` on server (lint `--fix` mutates spec files mid-run).
- AI features: full item schema + deterministic fallback (AiService.generateStructuredOutput contract).
- `docs/` is gitignored → ADRs to `adr/`, coverage badge to `.github/`.

---

## ✅ DONE (this session + prior, verified in git log)

### The 7-phase "Maximum-State Enrichment" plan (linear-watching-sunrise.md) — ALL SHIPPED
| Phase | Commit | What |
|---|---|---|
| 1 Course Learn Mode | `0f4ae72` | lesson bodies on demand, per-lesson progress, continue chip |
| 2 Review loop closure | `016bcc9` | spaced review with evidence (test-me), due→daily-plan |
| 3 Memory manager | `b5ef1dd` | see/delete/command what Asta knows |
| 4 Tutor message control | `718b401` | copy, regenerate, edit-resend, stop, history search |
| 5 Chat commands + Undo | `e12c80f` | daily-plan/courses obey chat; every write gets Undo |
| 6 Engagement | `fa2b950` | time-based nudges + weekly digest (in-app + email) |
| 7 Voice/reminders/replan | `860bb1d` | interview voice, session reminders + ICS, adaptive re-plan |

### Audit crash-class + central builds (recent)
| Commit | Closes (audit IDs) |
|---|---|
| `cca7942` fix(auth/nav) | CORE-BUG-003 (dashboard course route), sidebar gating, cert copy |
| `fb4d393` fix(chat) | stream-error REST fallback, OS tab/history race, session naming |
| `af8a295` feat(sync) invalidation bus | ROAD-BUG-002, DASH-BUG-001 (dashboard refresh) |
| `d568f9d`/`d4fd3db`/`28029db`/`084837f` | chat write tools (roadmap/course/flow/mistakes) + safe multi-write |
| `bd55738` feat(mentors) | MENTOR-BUG-001 (org leak), MENTOR-BUG-002 (dup/self) |
| `910652c` feat(mentors) client | MENTOR-MF-001 (mentor load error states) |

> Re-verify these against current code before re-doing; the audit predates some commits.

---

## ⬜ REMAINING — grouped by execution bucket

### ✅ Medium features bucket — DONE (commits fd9ab88, 130e005, 14097a7)
| Order | Audit ID(s) | Item | Commit |
|---|---|---|---|
| 1 | MARKET-BUG-001 | Marketplace "Use template" → real cloned asset via each type's pipeline | `fd9ab88` |
| 2 | CREATOR-GAP-001, CREATOR-MF-001 | Creator Studio type-specific content + error states | `130e005` |
| 3 | INST-GAP-001 | Institution real persisted assignments + honest sampled-vs-total | `14097a7` |

### ▶ NEXT candidates (pick one when continuing)
- **Quick wins bucket** (fast visible wins, hours each) — see list below.
- **Error/empty-state sweep** — build the shared GET-error helper (CORE-MF-001) then apply.
- **Larger** — SOCKET-BUG-001, AGENT-BUG-001/002, offline sync queue, billing (deferred: needs provider).

### ✅ Quick wins bucket — COMPLETE (rounds 1 + 2)
- ✅ KNOW-BUG-001 — `AskDto.documentIds` now `@IsMongoId({ each: true })` → malformed id 400s (was 500).
- ✅ VOICE-BUG-001 — failed voice turn rolls back the optimistic user turn + restores the input text.
- ✅ PORT-BUG-001 — public portfolio: 404 = "not published"; network/5xx = retryable "couldn't load".
- ✅ CERT-BUG-002 — public verify: a transport/server failure is a retryable "couldn't verify", not "forged".
- ✅ CERT-BUG-001 — new `Permission.CertificateRevoke` (org-admin+, NOT instructors); revoke route gated on
  it + malformed-id guard in revoke() → 404 not 500. +3 specs.
- ✅ BILL-ENH-001 — already done (CTA "Upgrade · test mode" + test-mode copy).
- ✅ ROAD-BUG-001 — `computeProgress` is task-aware: each week an equal share, filled by the fraction of
  its tasks checked (or full when the week is marked complete / has no tasks). +6 specs.
- ✅ DEV-BUG-002 / SEC-BUG-001 / PASSPORT-BUG-001 — `Types.ObjectId.isValid` guards on session revoke,
  evidence remove, and developer api-key/webhook ids → 400 not 500.
- ✅ PROFILE-ENH-001 — profile update syncs `User.name` server-side (`UsersService.setName`) + client
  refreshes the global auth store (`loadCurrentUser`) so header/sidebar identity isn't stale.
- ✅ Nav-vs-guard — shared `ROUTE_PERMISSIONS` map gates sidebar + command palette; added Community
  (org.view), Cohorts + Live Sessions (cohort.view); Institution/Developer already gated. ADMIN-BUG-001:
  admin nav already sound (shown only to role==='admin' = platform admin, who holds ALL_PERMISSIONS).

**QUICK WINS BUCKET COMPLETE.** Gate: server **242/242** (40 suites), server+client lint 0, client build clean.

### Error/empty-state sweep (the big "Missing fixes" bucket, mostly S each)
Standardize load-error/empty/retry across screens that swallow GET failures. IDs:
CORE-MF-001 (shared helper first), DASH-MF-001, TODAY-MF-001, HIST-MF-001, TUTOR-MF-001,
AGENT-MF-001, RES-MF-001, QUIZ-MF-001, PROJ-MF-001, VOICE-MF-002, VISUAL-MF-002,
WORKFLOW-MF-001, KNOW-MF-001, MISTAKE-MF-001/002, CAREER-MF-001, INTERVIEW-MF-001,
APP-MF-001, RESUME-MF-001, PORT-MF-001, CREATOR-MF-001, BILL-MF-001, INTEG-MF-001,
DATA-MF-001, PRIV-MF-001, SECURITY-MF-001, NOTIF-MF-001, ORG-MF-001,
ADMIN-MF-001..008. → Build **one shared GET-error-state helper** (CORE-MF-001) then apply.

### ✅ Larger bucket — DONE (commits 9a76789, 5c5cbcb, b0b6b5f, 18c9701, 91b0a48, 1920bcc)
- ✅ SOCKET-BUG-001 — `9a76789` client FIFO queue + runId routing on the shared socket.
- ✅ AGENT-BUG-001 — `5c5cbcb` per-persona chat state; streams write their own persona, no cross-corruption.
- ✅ CORE-BUG-001 — `b0b6b5f` bootstrap only logs out on 401; a 403 keeps the (valid) session.
- ✅ CORE-BUG-002 / OFFLINE-MF-001 — `18c9701` sync queue replays via HttpClient (refresh-and-retry applies).
- ✅ VISUAL-BUG-001 — `91b0a48` sanitizeMarkup() scrubs SVG/HTML/mermaid before trust; URL sanitizer for img src.
- ✅ PRIV-BUG-001 — `1920bcc` destructive privacy actions emit invalidation; portfolio/passport/applications reload.

### ✅ Larger bucket — FULLY COMPLETE (round 2, commits 2e4d8e3 → 0b734c2)
- ✅ AGENT-BUG-002 — `2e4d8e3` server truncateAfter + POST /ai/sessions/:id/truncate; tutor persists branch. +4 specs.
- ✅ PEER-BUG-001 — `2e4d8e3` (bundled) peer-room 5s polling while open (pauses when hidden/busy).
- ✅ VISUAL-MF-002 — `fe2e8a9` status() error handler → honest default. BILL-ENH-001 — CTA "Upgrade · test mode".
- ✅ VISUAL-MF-001 / VOICE-MF-001 / PRACTICE-ENH-001 — already surfaced (local-render note / "demo · browser speech" / "simulated" badge).
- ✅ AI-ENH-001 — satisfied by design: app degrades to deterministic offline output with visible notices; admin `/ai/providers` snapshot.
- ✅ OUTCOME-GAP-001 + REPLAY-GAP-001 — `1988705` DomainBus stale-prompt (cost-aware, no auto-LLM).
- ✅ CERT-GAP-001 + PROOF-GAP-001 — `585c1da` reports permission preflight + certificate issuer note.
- ✅ WORKFLOW-GAP-001 — `0b734c2` run-history UI (list + load/error/empty + replay detail).
- ✅ REPORT-GAP-001 — already real: UI surfaces only real aggregation (student outcomes / weak topics / AI usage) + real CSV; the "future" PDF/placement bits are NOT shown (nothing misleading).
- ✅ PUSH-GAP-001 — already real: push.notify() sends live Web Push (VAPID-gated, prunes 404/410 dead subs); notifications fan out to it on create. Audit was stale.

### ✅ BILLING — COMPLETE, both providers (commit cbdcce4)
- Razorpay + Stripe were already fully implemented (providers, webhooks, verify, client
  widget/redirect, honest test-mode UI). Hardening added: `STRIPE_WEBHOOK_SECRET` now in the
  Joi env schema; provider selection extracted to `createPaymentProvider()` (mock is the safe
  default/fallback — a live provider is picked only when `ENABLE_PAYMENT_PROVIDER=true` AND that
  provider's keys are present; missing key → mock, never a crash); money-path test coverage added
  (was zero): factory decision table, both providers' HMAC verify (client + webhook,
  valid/forged/malformed/no-secret), service (activate-on-paid, verify gating, idempotent webhook,
  change-to-free, cancel, admin MRR). +29 specs.
- **Go live = ops only:** `ENABLE_PAYMENT_PROVIDER=true`, `PAYMENT_PROVIDER=razorpay|stripe`, paste
  that provider's keys (see `.env.example`). No code change.

### Everything from the app audit is now either shipped or honest-gated. No open Larger items.

---

## 📓 Progress log (append per commit)
- _(start)_ Tracker created. Beginning Medium bucket item #1: MARKET-BUG-001 (Marketplace real clone).
- ✅ **MARKET-BUG-001 DONE** — `TemplateClonerService` clones a template into a REAL asset via
  each type's own generation pipeline (flow/roadmap/quiz/project/visual/course), deep-links to it;
  live-session types (simulation/interview/study_space) seed the create screen with the goal.
  Client shows "Cloning…" + created-vs-seeded toast. +ObjectId guards on get/use. +6 specs.
  Gate: server 198/198 (34 suites), `nest build` clean. Next: CREATOR-GAP-001.
- ✅ **CREATOR-GAP-001 + CREATOR-MF-001 DONE** — Creator Studio now captures the type-specific
  content the clone pipeline consumes (quiz topic, visual concept + visual-type, course audience,
  level) instead of only a goal string; per-type hint explains what a learner gets. Load failures
  for "mine"/moderation queue now show an inline error + Retry and preserve the last list (was
  swallowed). Client-only (server DTO already accepts content+level). Gate: `ng build` dev clean
  (105s). Next: INST-GAP-001.
- ✅ **INST-GAP-001 DONE** — `InstitutionAssignment` schema (kind/title/note/dueAt, org-scoped);
  `assign()` persists + announces + returns id; `listAssignments()` (overdue-flagged); analytics
  now report true enrolment vs sampled count (per-cohort sampling, not a global cutoff); cohort
  drilldown shows "N of M" + the assignment list; assign form gains type/due-date/note. +ObjectId
  guard. +4 specs.
- ✅ **MEDIUM BUCKET COMPLETE.** Final gate: server **202/202** (35 suites), server lint 0 errors
  (7 pre-existing warnings), client `ng build` dev clean, client lint 0. Commits fd9ab88, 130e005, 14097a7.
- ✅ **LARGER BUCKET round 1 (6 items).** SOCKET-BUG-001, AGENT-BUG-001, CORE-BUG-001, CORE-BUG-002,
  VISUAL-BUG-001, PRIV-BUG-001. Commits 9a76789, 5c5cbcb, b0b6b5f, 18c9701, 91b0a48, 1920bcc.
- ✅ **LARGER BUCKET round 2 — CLOSED OUT (no pendings).** AGENT-BUG-002 (branch truncation, +4 specs),
  PEER-BUG-001 (poll), VISUAL-MF-002 + BILL-ENH-001 (honesty), OUTCOME-GAP-001 + REPLAY-GAP-001
  (stale prompts), CERT-GAP-001 + PROOF-GAP-001 (permissions), WORKFLOW-GAP-001 (run history).
  REPORT-GAP-001 + PUSH-GAP-001 + VISUAL-MF-001/VOICE-MF-001/PRACTICE-ENH-001/AI-ENH-001 verified
  already-real/pre-built (audit stale). Commits 2e4d8e3, fe2e8a9, 1988705, 585c1da, 0b734c2.
  Final gate: **server 206/206** (35 suites), server lint 0 err, client build clean, client lint 0.
  **The entire Larger bucket is complete; only provider-key wiring (billing) remains operational.**
- ✅ **BILLING FINISHED (both providers)** — `cbdcce4`. Razorpay + Stripe were already implemented;
  hardened: `STRIPE_WEBHOOK_SECRET` validated, provider selection extracted to a testable factory
  (mock-fallback on any missing key), +29 money-path specs (factory table, HMAC verify both providers,
  service activate/verify/idempotent-webhook/cancel/MRR). Go-live = ops only (flag + keys).
- ✅ **QUICK WINS round 1 (6 items)** — KNOW-BUG-001, VOICE-BUG-001, PORT-BUG-001, CERT-BUG-002,
  CERT-BUG-001 (+3 specs), BILL-ENH-001 (already done). Gate: server **236/236** (39 suites), server
  lint 0 err, client build+lint clean.
