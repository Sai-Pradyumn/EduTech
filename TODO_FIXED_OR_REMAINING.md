# Asta — Fixed / Remaining

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
