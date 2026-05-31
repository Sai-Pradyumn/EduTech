# Asta — Fixed / Remaining

## ✅ Shipped — Phase 10 · Scale, Monetization, AI Ops & Enterprise Reliability
Full detail in [`PHASE_10_SCALE_MONETIZATION_AI_OPS.md`](PHASE_10_SCALE_MONETIZATION_AI_OPS.md). "From impressive
AI product to a real SaaS platform." Shipped priority-by-priority (one commit each, complete flow), all builds
green + seed + 10 unit tests passing + runtime-smoked:
- **P1 — Monetization & control:** `entitlements` (per-feature limit maps over a 5-plan catalog, check/consume/
  summary, `<asta-entitlement-gate>`), `feature-flags` (16 flags + admin kill-switches), AI metering wired into
  `AiService`, billing upgrade (change-plan/cancel/invoices + admin overview) + `PaymentProvider` abstraction.
- **P2 — Production ops:** `ai-ops` (cost/latency/error/fallback + provider health + budget policies), `ops`
  (health, job ledger w/ retry, persisted error feed), `audit` (`/admin` + `/org` logs), request/error IDs in
  the global filter, `product-analytics` (funnels/DAU-WAU/retention).
- **P3 — PWA/offline:** IndexedDB cache + sync queue (replays on reconnect) + network banner, `<asta-offline-
  toggle>`, SW stale-while-revalidate + push handlers, `push` module (VAPID-gated no-op).
- **P4 — Enterprise:** `sessions` (device list/revoke/logout-all), `org-branding` (cert preview),
  `data-governance` (export/deletion jobs + retention).
- **P5 — Platform/growth:** `developer` (hashed API keys + HMAC webhooks + delivery log), `integrations`
  (GitHub/Calendar `.ics`/Slack/Discord/LMS), Jest tests + CI test step.

**Phase-10 follow-ups (foundation by design):** enforce entitlement org-inheritance + AI budget at the gateway;
turn Stripe/Razorpay, VAPID web-push and real OAuth live behind their flags; back the job ledger with a real
BullMQ worker; e2e/Playwright smoke suite.

## ✅ Shipped — Phase 9 · Outcome Network (ALL 15 modules)
Priorities 1–4 complete end-to-end (backend + frontend + seed). In addition to the Priority-1 + Council
work below, Phase 9 now also ships: **Portfolio Builder** (+ public `/p/:username`), **Project Review 2.0**
(case study + add-to-passport/portfolio), **Interview OS** (9 types, scored, feeds readiness + Mistake OS),
**Resume & Application Assistant** (JD analyzer + tracker), **Mentor Marketplace**, **Creator/Template
Marketplace** (+ admin moderation), **Institution Outcome Layer**, **Nudge intelligence** (event + pull),
and **Privacy/Export/Reset** (`/app/privacy`). Both builds green; seed runs; all new endpoints runtime-smoked.
Foundation-level by design: marketplace payments/scheduling, template deep-clone prefill, BullMQ readiness
precompute for large cohorts, and outbound (email/WhatsApp) nudge delivery are the Phase-10 follow-ups.

## ✅ Shipped — Phase 9 · Outcome Network (Priority 1 + Outcome Council)
Full detail in [`PHASE_9_OUTCOME_NETWORK_OS.md`](PHASE_9_OUTCOME_NETWORK_OS.md). "From learning to **verified outcomes**."
- **Skill Passport** `server/src/modules/skill-passport/` + `features/skill-passport/`: living verified
  profile (computed from Skill Twin + ledger + certs + projects + manual evidence); identity, skill graph,
  proof tiles, project evidence, timeline w/ per-event public toggle, privacy controls, manual evidence.
  Public profile `/u/:username` (unauth, privacy-respecting) + in-app public preview. 9 endpoints.
- **Proof-of-Learning Ledger 2.0**: extended schema (skill tags, verification levels, passport visibility)
  + 10 new event kinds + `summary` + manual events + visibility toggle. Base path `/proof-ledger`.
- **Career Readiness Engine** `server/src/modules/career-readiness/`: 11-role rubric catalog, explainable
  5-dimension score (**proof-based** — credits ledger evidence), skill-gap matrix, top-3 blockers, 7-day
  plan, portfolio checklist, `CareerReadinessAgent` (LLM + fallback). `/app/career-readiness`.
- **AI Outcome Council** `server/src/modules/outcome-council/`: 6 specialist perspectives → impact-ranked
  best action + alternatives + narrated verdict (`OutcomeCouncilAgent`). `/app/outcome-council`.
- **Dashboard 3.0**: outcome cockpit strip (readiness + passport) + new **Outcome** nav group.
- **Seed**: published passport, skill evidence, readiness state, enriched ledger. Builds green (server +
  Angular-strict client); seed runs clean; runtime-smoked incl. unauthenticated public passport.
- **Remaining (scaffolded backlog)**: Portfolio Builder, Project Review 2.0, Interview OS, Resume/Application
  assistant, Mentor/Template marketplaces, Institution outcome layer, Nudge engine, Privacy settings page —
  all reuse the shipped passport/ledger/readiness services. See Phase 9 doc.

## ✅ Shipped — Phase 8 · PRIORITY 4 breakthroughs — PHASE 8 COMPLETE
The breakthrough features, end-to-end. Full detail in [`PHASE_8_MULTIMODAL_LEARNING_OS.md`](PHASE_8_MULTIMODAL_LEARNING_OS.md).
- **Proof-of-Learning Ledger** `server/src/modules/ledger/` + `client/.../features/ledger/`: append-only
  verified-event timeline. `LedgerService` listens to quiz/week/project events **and** is called by
  Flows(node complete) / Mistakes(resolved) / Simulations(finish). 2 routes. Seed 5 entries. (Flow-node
  capture verified live: 5→6.)
- **AI Mentor Council** `server/src/modules/mentor-council/` + `features/mentor-council/`: 5 agent
  perspectives (Tutor/Assessment/Project/Career/Mentor) propose with urgency; chair picks + synthesizes.
  Read-only (LI + Flows + Mistakes). `/app/mentor-council`.
- **Learning Replay** `server/src/modules/replay/` + `features/replay/`: recap from Ledger + Skill Twin
  with a TTS-playable 3-min script. `/app/replay`.
- **Weakness-to-Project**: `POST /mistakes/:id/repair-project` (→ ProjectsService) + "Generate targeted
  project" button in Mistake OS. (Adaptive Modality Router + Explainability Drawer already in Skill Twin.)
- **Wiring**: 5 routes + nav (Mentor Council, Learning Replay, Proof-of-Learning) + voice rules. Cross-
  module: Flows/Mistakes/Simulations now import LedgerModule; Mistakes imports ProjectsModule.
- **Verification**: builds green; client warning-free (524.25 kB < 540 kB); server boots clean; API
  smoked — ledger list/stats + **flow-node→ledger capture**, council 5-member verdict, replay recap,
  weakness→project.
- **PHASE 8 COMPLETE** — all 4 priorities (11 module groups). Remaining = optional polish (dashboard
  widget, socket streaming, real STT/TTS+image providers, BullMQ, live UI/a11y pass).

## ✅ Shipped — Phase 8 · PRIORITY 3 (Course Builder + Peer Rooms) — in one pass
Both Priority-3 modules built end-to-end. Full detail in [`PHASE_8_MULTIMODAL_LEARNING_OS.md`](PHASE_8_MULTIMODAL_LEARNING_OS.md).
- **Course Builder** `server/src/modules/course-builder/` + `client/.../features/course-builder/`: goal/
  outline/roadmap → modules+lessons+project+certificate criteria (`course-blueprint.generator`),
  editable; per-module generate quiz (→Assessment) / visual (→Visuals); generate project (→Projects) /
  flow (→Flows); **role-gated publish** to org/cohort (mentor/admin). 11 routes; `ENABLE_COURSE_BUILDER`.
  Seed 1 draft course (mentor).
- **Peer Rooms** `server/src/modules/peer-rooms/` + `features/peer-rooms/`: create/join-by-code, shared
  message board, **AI moderator** (Agent OS nudge), summary + action items, shared learning flow,
  host-only close. 11 routes; `ENABLE_PEER_ROOMS`. Seed 1 open room (code DEMO01).
- **Wiring**: 8 routes + nav (Course Builder, Peer Rooms) + voice rules.
- **Verification**: builds green; client warning-free (522.79 kB < 540 kB); server boots clean; API
  runtime-smoked — course generation + per-module quiz/visual/project/flow; **publish role gate
  (student org-publish 403, mentor org-publish ok)**; peer-room create/message/moderate/summary/flow +
  mentor join-by-code with role mapping.
- **PRIORITY 3 COMPLETE.** Remaining: Priority 4 breakthroughs (AI Mentor Council, Proof-of-Learning
  Ledger, Learning Replay).

## ✅ Shipped — Phase 8 · PRIORITY 2 (Study Spaces + Simulation Labs + Daily Autopilot) — in one pass
All three Priority-2 modules built end-to-end. Full detail in [`PHASE_8_MULTIMODAL_LEARNING_OS.md`](PHASE_8_MULTIMODAL_LEARNING_OS.md).
- **Study Spaces** `server/src/modules/spaces/` + `client/.../features/spaces/`: NotebookLM-style spaces
  (sources → grounded ask, summary, flashcards, audio-overview script, + spawn flow/quiz/concept-visual).
  14 routes; `ENABLE_STUDY_SPACES`. Reuses AI gateway + Flows + Assessment + Visuals. Seed 1 space.
- **Simulation Labs** `server/src/modules/simulations/` + `features/simulations/`: 10 round types,
  per-type blueprints (agent + scenario + rubric), start/respond(Agent OS)/finish(rubric score +
  improvement plan + **feeds Mistake OS** on sub-60)/retry/create-repair-flow. 8 routes;
  `ENABLE_SIMULATIONS`. Seed 1 finished sim.
- **Daily Autopilot** `server/src/modules/daily-plan/` + `features/today/`: builds today's plan from
  active flow + open mistakes + roadmap + quiz nudge; modes normal/quick/exam/burnout_recovery;
  complete/recalculate. 5 routes. `/app/today`.
- **Wiring**: 8 new routes + nav items (Today, Study Spaces, Simulations) + voice-command rules.
- **Verification**: builds green; client warning-free (521.46 kB < 540 kB); server boots clean (all
  route groups mapped); API runtime-smoked across all three (grounded ask + generators; sim finish →
  Mistake-OS link verified; daily-plan normal/quick/exam).
- **PRIORITY 2 COMPLETE.** Remaining Phase 8: Priority 3 (Course Builder, Peer Rooms), Priority 4
  breakthroughs (AI Mentor Council, Proof-of-Learning, Learning Replay).

## ✅ Shipped — Phase 8 · Complete Voice Room (Priority 1 · module 5) — PRIORITY 1 DONE
Voice-native learning, end-to-end. Full detail in [`PHASE_8_MULTIMODAL_LEARNING_OS.md`](PHASE_8_MULTIMODAL_LEARNING_OS.md).
- **Backend** `server/src/modules/voice/`: promoted the stub to **persisted `VoiceSession`** (8 modes,
  transcript, summary, extractedActions, links). `VoiceService` adds sessions CRUD + `addTurn` (routes
  through the Agent OS per mode) + summarize + **createFlow** (→ FlowsService) + **createQuiz** (→
  AssessmentService) + extractNotes + end; kept legacy `converse()` for the Ask-Asta dock. Controller
  +11 session routes; module imports Flows + Assessment + Mongoose. `ENABLE_VOICE` flag (default on).
  Seed: 1 demo voice session.
- **Frontend** `client/src/app/features/voice/voice-room.component.ts`: rewritten as lobby (8 mode cards
  + recent sessions) + live session (`/app/voice-room/session/:id`) — speaking **orb**, push-to-talk mic
  (browser `SpeechRecognitionService`) **and** type fallback, TTS playback (`TextToSpeechService`),
  transcript timeline, replay/stop/auto-read, and a "turn into flow/quiz/notes/summary" rail. New
  `voice-session.service.ts`; live-session route added; nav/voice rules already present.
- **Graceful degradation**: unsupported STT → notice + type fallback; mic-permission errors → toast.
- **Verification**: builds green; client warning-free (519.60 kB < 540 kB); server boots clean (13 voice
  routes); API smoked across the full lifecycle (create → turn via Agent OS → voice→flow + voice→quiz
  linked → notes → end + summary).
- **PRIORITY 1 COMPLETE**: Flow Studio ✅, Visual Studio ✅, Mistake OS ✅, Skill Twin ✅, Voice Room ✅.
  Next: Priority 2 (Study Spaces, Simulation Labs, Daily Autopilot).

## ✅ Shipped — Phase 8 · Skill Twin (Priority 1 · module 4)
A **live, explainable learner model** that powers recommendations. Full detail in [`PHASE_8_MULTIMODAL_LEARNING_OS.md`](PHASE_8_MULTIMODAL_LEARNING_OS.md).
- **Backend** `server/src/modules/skill-twin/`: `SkillTwinService.compute()` blends `LearningIntelligence`
  overview + **Mistake OS** + active **Flow** + profile into readiness/health, retention & burnout risk,
  pace + projected days, mastery graph, weakness roots, misconception memory, an **Adaptive Modality
  Router** and **explainable next-best-actions** (each with a `reason`). `resetMemory()` clears Mistake
  OS + flagged weak areas (added `MistakesService.clearForUser` + `StudentProfileService.clearWeakAreas`).
  Read-only (no new persistence). 2 routes.
- **Frontend** `client/src/app/features/skill-twin/`: readiness/health rings + retention/burnout gauges,
  next-best-actions with a **"Why?" drawer**, recommended-modality card, mastery graph (value vs target),
  weakness roots, misconception memory, strengths, transparent signals list, guarded reset. `skill-twin.service.ts`;
  route `/app/skill-twin`; nav "Skill Twin"; voice rule.
- **Verification**: builds green; client warning-free (519.29 kB < 540 kB); server boots clean (skill-twin
  routes mapped); API smoked (compute returns full model w/ modality + explainable actions; burnout
  heuristic softened to use streak; reset clears 5 mistakes → twin recomputes). Re-seeded demo data.
- **Priority 1 now COMPLETE except Voice Room** (Flow Studio ✅, Visual Studio ✅, Mistake OS ✅, Skill Twin ✅).

## ✅ Shipped — Phase 8 · Mistake OS (Priority 1 · module 3)
Remembers **misconceptions, not just scores**. Full detail in [`PHASE_8_MULTIMODAL_LEARNING_OS.md`](PHASE_8_MULTIMODAL_LEARNING_OS.md).
- **Backend** `server/src/modules/mistakes/`: `Mistake` schema (8 types, severity/frequency, repair
  actions, status), `MistakesService` with **`@OnEvent(quizGraded)` auto-capture** (enriched the event
  with per-topic `topicScores`), `buildRepairPlan` generator (tutor/visual/micro-quiz/voice-viva/flow-
  node), stats (open/repairing/resolved + top focus + heatmap), controller (9 routes). Added
  `FlowsService.addRepairNode` + `findActive` so a mistake can inject a `weak_area_repair` node into the
  active flow. Seed: 4 demo mistakes.
- **Frontend** `client/src/app/features/mistakes/`: repair **inbox** — stats strip, top-repair-focus
  card, **weakness heatmap**, status filter, expandable cards with a repair plan whose actions deep-link
  to tutor/visual/quiz/voice or add a flow repair node; resolve/reopen/delete. `mistake.service.ts`;
  route `/app/mistakes`; nav "Mistakes"; voice rule.
- **Verification**: builds green; client warning-free (518.80 kB < 540 kB); server boots clean (mistake
  routes mapped); API runtime-smoked incl. the **0%-quiz → auto-captured mistake** event path and
  **repair-flow → node added to active flow**.

## ✅ Shipped — Phase 8 · Visual Intelligence Studio (Priority 1 · module 2)
Built **Visual Studio** end-to-end — turns any concept (or a flow node) into a structured educational
visual, **with no paid image API**. Full detail in [`PHASE_8_MULTIMODAL_LEARNING_OS.md`](PHASE_8_MULTIMODAL_LEARNING_OS.md).
- **Backend** `server/src/modules/visuals/`: `VisualAsset` schema (16 types, formats svg/mermaid/
  jsonGraph/imageUrl/markdown/html), **VisualExplainer** agent (LLM structured output + deterministic
  `buildVisual` fallback), **image-provider abstraction** (`IImageProvider`/`MockImageProvider`, behind
  `ENABLE_IMAGE_GENERATION`, default off → mock SVG), `VisualsService` (generate / from-flow-node /
  regenerate / CRUD), controller (8 routes, `ENABLE_VISUAL_STUDIO` gate). Seed: 4 demo visuals.
- **Frontend** `client/src/app/features/visuals/`: reusable `VisualRendererComponent` (dependency-free
  SVG graph renderer for jsonGraph + `MarkdownPipe` + image + mermaid code — **no mermaid.js/d3 dep**),
  `visuals-list` (gallery + generate panel) and `visual-detail` (viewer + copy/export/regenerate/ask-
  tutor). New `visual.service.ts`. Routes `/app/visuals`,`/visuals/:id`; nav "Visual Studio"; voice rule.
- **Cross-module**: "Explain visually" in the **Flow inspector** → `from-flow-node` generates a visual
  and **links it back onto the flow node** (`linkedVisualAssetIds`, verified in smoke).
- **Verification**: builds green; client warning-free (518.31 kB < 540 kB); server boots clean (visual
  routes mapped); API runtime-smoked (generate / comparison / from-flow-node+link / get / regenerate /
  delete). Noir cockpit compliant.

## ✅ Shipped — Phase 8 · Flow Studio (Multimodal Learning OS, Priority 1 · module 1)
Built **Flow Studio** end-to-end and deeply (per the Phase 8 brief: complete Priority 1 deeply, not
everything shallowly). Full detail in [`PHASE_8_MULTIMODAL_LEARNING_OS.md`](PHASE_8_MULTIMODAL_LEARNING_OS.md).
- **Backend** `server/src/modules/flows/`: `Flow` schema (embedded `FlowNode`/`FlowEdge`/timeline, 15
  node types, 8 edge relations, unlock statuses), DTOs, `FlowsService` (generate / from-roadmap / CRUD /
  node ops / execute-node / recalculate / export), `FlowsController` (13 routes, `ENABLE_FLOW_STUDIO`
  gate), and the **FlowArchitect** agent (`AiService.generateStructuredOutput` + `mockFactory`
  deterministic blueprint + normalize/validate → works offline). Registered in `app.module`; flag added
  to config (default on).
- **Frontend** `client/src/app/features/flows/`: `flows-list` (generate panel + gallery + states),
  `flow-detail` **graph cockpit** — custom **SVG canvas** (pan/zoom/drag, dot-grid mission-control look),
  right inspector, **5 views** (Map/Timeline/Focus/Weakness/Project), node actions (Start → routes to
  tutor/quiz/project/voice/mentor/knowledge; Mark mastered → unlock cascade), recalculate, export. New
  `flow.service.ts` + `flow-node-meta.ts`. Routes (`/app/flows`, `/flows/new`, `/flows/:id`), **nav**
  ("Flow Studio" in Learn), command palette (auto), and a voice-command nav rule.
- **Seed**: 2 demo flows (22-node MERN with lived-in progress, 20-node DSA).
- **Verification**: `build:server` green; `build:client` green & **warning-free** (517.77 kB < 540 kB);
  server **boots clean** (all flow routes mapped, no DI errors); API **runtime-smoked** with the mock
  provider (generate → execute-node → complete-cascade → recalculate → export).
- **Design**: compact Noir cockpit — command headers, `.card`/`.kicker`, no heroes; green=path,
  cyan/violet=AI nodes, amber=weakness; shared motion taxonomy + reduced-motion safe; mobile → list view.
- **Remaining Phase 8** (queued, see the Phase 8 doc): Visual Intelligence Studio, complete Voice Room,
  Skill Twin, Mistake OS (Priority 1); then Study Spaces / Simulations / Daily Autopilot (P2); etc.

## ✅ Fixed / done — WHOLE-APP motion rollout (latest)
Completed the motion-taxonomy rollout across **every remaining logged-in screen**
(20 files, via two waves of 3 parallel agents + central build verification). The
ONLY screen still using `astaTilt`/`astaReveal` is `landing.component.ts` — the
**public marketing page**, which intentionally keeps cinematic reveals. Build green +
warning-free, initial **516.8 kB**.
- Migrated: Mentor, Founder, Reports, Billing, Pricing(public), Admin (analytics,
  students, documents, roadmaps, assessments, fine-tuning), Voice, Workflows,
  Certificates, Cert-verify(public), Community, Cohorts, Live-sessions, Org, Platform.
- Each: `astaTilt`/`astaReveal` → `.motion-card-reveal` + `.motion-row-*` tier per row;
  `TiltDirective`/`RevealDirective` dropped from imports (Magnetic/Count kept).
- **`.asta-observatory` wrapper applied** to all admin pages + platform-orgs (cool
  palette) — closes the cross-cutting follow-up.
- State hardening added where weak: real `loading`/`loadError` + skeleton + error-retry
  on Reports, Billing, Platform-orgs, Mentor; empty-state line on Community.
- Flag-gated screens (Voice, Workflows) keep their command header above the disabled
  notice and the living voice orb intact.

## ✅ Fixed / done — screen motion-rollout batch (6 priority screens)
Rolled the consistent app motion taxonomy out across the **6 top-priority screen areas**
(replacing the old per-card `astaTilt [tiltMax]` + linear `astaReveal` flourishes),
solidified states, and finished missing metaphor pieces. Client build green +
warning-free, initial **516.8 kB** (< 540 kB budget).
- **Motion system generalized** app-wide: `.motion-card-reveal` (canonical; `.dashboard-reveal`
  kept as alias) + row tiers `.motion-row-primary/-strip/-row-2/-row-3/-row-panel/-lower`.
  Same row = same reveal family; only `--motion-card-index` staggers.
- **AI Tutor + Agent Workspace** (Cognitive Studio): rail reveals as one family; added a
  streaming skeleton (pre-first-chunk), gated stream cursor, explicit **failed + Retry**
  state (`failed?` flag + `retry()` re-sending last topic). Streaming/socket logic untouched.
- **Roadmap** (list + details + generate): week-cards & roadmap-cards are one reveal family;
  active roadmap highlighted (accentVar); current-week-focus + completed-week visual state on
  `week-card`; visible **Recalculate** CTA; encouraging empty state. Optimistic progress intact.
- **Knowledge Hub** (Knowledge Vault): built + wired **`asta-knowledge-shard`** (file glyph,
  status pill w/ spinner, chunk count, tags, warnings, summary/flashcards/delete + **retry-on-failed**;
  presentational, all actions via @Output). Added `retryIngestion()` (clears failed doc → re-upload,
  no fake reprocess endpoint). Retrieval-confidence pill already present.
- **Quiz Studio** (Mastery Arena): reveal families on stats/result; added real `loading`/`loadError`
  signals + skeleton + error-retry (were referenced but missing); confetti ≥70% unchanged.
- **Learning Intelligence** (Skill Observatory): all rows are reveal families (radar, heatmap,
  momentum, trend, recommendations, timeline); no tilt.
- **Project Studio** (Project Forge): blueprint + milestones + kanban columns + submit/AI-review/
  mentor-review all reveal families; accentVar blooms kept; grading/review logic untouched.

## ✅ Fixed / done — dashboard motion turn
- **Dashboard motion system** — replaced the per-card `astaTilt [tiltMax]` (varying
  2/3/5/6) + linear `astaReveal` flourishes with ONE shared reveal+hover taxonomy.
  Same row = same reveal family; cards differ only by a tiny `--motion-card-index`
  stagger; rows cascade via `--motion-row-delay`. Full spec in
  `ASTA_DASHBOARD_MOTION_SYSTEM.md`.
- New CSS: `.dashboard-reveal`, `.motion-row-primary|-strip|-row-panel|-lower`,
  `.dashboard-primary-card`, `.dashboard-panel-card`, `.dashboard-action-chip`,
  motion vars (`--motion-duration-fast|-med`, `--motion-stagger-step`); reduced-motion
  block neutralizes it. Calmer reveal (0.5s/14px vs old 0.9s/26px).
- `asta-card` gained `[interactive]` → toggles `.hover-lift` so every clickable card
  lifts identically (uniform `translateY(-3px)` + green glow). `.hover-lift` now sets
  `cursor:pointer`.
- The 3 intelligence panels are now **meaningful links** (next-milestone → roadmap,
  weak-areas → quizzes, recommended-project → projects) with uniform hover.
- Dropped `TiltDirective`/`RevealDirective` from the dashboard (kept `MagneticDirective`
  on header CTAs + `CountDirective`). Client build green, warning-free, initial 516 kB
  (< 540 kB budget); dashboard chunk 16.4 kB.

## ✅ Fixed / done — recovery turn (prior)
- **Reverted the giant Dashboard hero** → compact Noir cockpit (command header + active-roadmap/progress grid + intelligence strip + 3 panels + small lower river).
- **Fixed: bottom-nav on desktop** (CSS specificity defect vs `lg:hidden`) — now hidden on desktop via the shell's own media query; mobile = floating capsule.
- Dropped banned `accentVar` left-borders on dashboard cards (use `.kicker`).
- Compact utilities added (`.asta-page-command-header`, `.goal-pill`, `.metric-card`, `.motion-fade-up`); reused `astaReveal` for scroll-in.
- Docs: `ASTA_UI_RECOVERY_AUDIT.md`, `ASTA_NOIR_COCKPIT_DESIGN_SYSTEM.md`; build green + warning-free.

## ✅ Fixed / done — prior Synapse turn
- Asta Synapse CSS foundation (tokens, dual-palette observatory scope, command buttons, motion system) — `client/src/styles.css`.
- Synapse component library (7 components + types/barrel) — `client/src/app/shared/ui/synapse/`.
- Dashboard rebuilt as Mission Control (all states + data wiring preserved).
- 4 docs: `ASTA_SYNAPSE_DESIGN_SYSTEM.md`, `ASTA_SCREEN_AUDIT.md`, `STABILIZATION_PHASE_REPORT.md`, this file.
- Build green + warning-free (budget 500→540 kB).
- Verified (already-correct from prior phases): scroll-split shell, mobile bottom-nav `lg:hidden`, Ask Asta dock no longer overlaps bottom-nav, no placeholder routes, no mock/TODO design debt.

## 🎯 Remaining — priority order
> **Guard:** apply the **compact Noir cockpit** treatment (command header, `.card`
> panels, `.kicker` labels, dense layout, subtle motion) + the consistent app motion
> taxonomy (`.motion-card-reveal` + a `.motion-row-*` tier per row; NO per-card `astaTilt`
> with varying `tiltMax`). NO heroes/oversized orbs inside the app.

1. ✅ **AI Tutor** → Cognitive Studio — motion rollout + failed/retry + streaming skeleton.
2. ✅ **Roadmaps** (list + details + generate) → Learning Path Galaxy — reveal families, recalculate CTA, week states.
3. ✅ **Knowledge Hub** → Knowledge Vault — `asta-knowledge-shard` built + wired; retry-on-failed.
4. ✅ **Quiz Studio** → Mastery Arena — reveal families + real loading/error states (confetti ≥70%).
5. ✅ **Learning Intelligence** → Skill Observatory — reveal families across radar/heatmap/momentum/trend/recs/timeline.
6. ✅ **Project Studio** → Project Forge — reveal families across blueprint/milestones/kanban/submit/reviews.
7. ✅ **Mentor Room** — motion rollout + roster/risk/review/notes reveal family + error state. (`asta-mentor-compass` N/E/S/W component still optional/unbuilt.)
8. ✅ **Admin Analytics + Students** (+ documents/roadmaps/assessments/fine-tuning) — motion rollout + `.asta-observatory` wrapper. (`asta-observatory-table` component still optional/unbuilt — tables work as-is.)
9. ✅ **Voice Room** — motion rollout; living orb + disabled flag-state intact.
10. ✅ **Notifications / Profile / Billing / Certificates / Reports / Founder / Community / Cohorts / Live-sessions / Org / Platform** — motion taxonomy rolled out across all.

**Motion rollout = COMPLETE for the whole logged-in app.** Only `landing` (public) keeps cinematic reveals by design.

### Optional polish still open (not motion debt)
- Build the bespoke Synapse components where they'd add value: `asta-mentor-compass`,
  `asta-observatory-table`, `asta-project-forge-card`, `asta-quiz-arena-card`,
  `asta-agent-swarm-map`. Screens function fully without them today.
- Live screenshot/eyeball pass on the newly-migrated secondary screens.

## 🧩 Synapse components still to build
`asta-knowledge-shard` ✅ built (`features/knowledge-hub/components/`). Remaining:
`asta-agent-swarm-map`, `asta-project-forge-card`,
`asta-mentor-compass`, `asta-quiz-arena-card`, `asta-observatory-table`,
`asta-path-node` (standalone), `asta-command-surface`, `asta-orb-button`,
`asta-bottom-sheet`, `asta-smart-composer` (asta-composer exists), Synapse
`asta-command-palette` (generic exists). Existing atoms cover empty/error/loading/
status-pill today.

## 🔧 Cross-cutting follow-ups
- Apply `.asta-observatory` wrapper on all admin/founder/reports page shells when migrated.
- Migrate per-screen `text-[NNpx]`/inline px to the type/space scale during each screen's rebuild (F-sweep tail).
- Optional: live Puppeteer screenshot pass after 3–4 screens migrate (harness recipe in memory: mongod:27018 → seed → API:3000 → static:4200 → puppeteer /tmp/astaqa).
- Voice settings: ensure Profile surfaces enable-voice / wake-phrase / TTS / mic-permission (services exist).

## ⚪ Intentional non-goals (not bugs)
- Flag-gated features (voice `/voice`, fine-tuning, agent-graph) ship disabled by default.
- `placeholder()` route factory is unused; remove in a cleanup pass.
- Currency/timezone formatting and hinglish locale remain `🧱` foundations (documented, not silent).
