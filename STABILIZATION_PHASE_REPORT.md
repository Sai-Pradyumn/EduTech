# Asta — Stabilization Report

## ⏪ Recovery turn (2026-05-30, latest) — corrected the giant-hero direction
User feedback (with screenshots): the prior turn's marketing-style **Mission Hero**
on the Dashboard was the wrong direction. The compact, dense Noir cockpit
(screenshots A & C) is the baseline soul to protect. Acted as a surgical UI fixer:

- **Reverted** the giant hero + mastery-ring banner → rebuilt the Dashboard to the
  compact baseline: command header (greeting + goal pill + Continue/Ask-Asta) →
  active-roadmap (anchor) + progress grid → learning-intelligence strip → three
  compact panels (next milestone / weak areas / recommended project) → learning
  river demoted to a small lower section. Data is dense above the fold again.
- **Preserved** the baseline: `.card` panels, `.kicker` micro-labels, `.pill`,
  green accent, sidebar/topbar, intelligence strip, all states + data wiring.
- **Dropped** `accentVar` thick left-borders on dashboard cards (banned crutch) →
  identity now from the subtle green-dash kicker.
- **Fixed a real bug** the screenshots exposed: the **mobile bottom-nav showed on
  desktop**. Cause: the shell's scoped component style `.botnav{display:flex}`
  (specificity 0,2,0) outranked Tailwind `lg:hidden` (0,1,0). Now `.botnav` is
  `display:none` by default and only shown via the shell's own
  `@media (max-width:1023.98px)` as a floating capsule. Desktop nav gone → no Ask-Asta overlap.
- **Added** compact utilities: `.asta-page-command-header`, `.goal-pill`,
  `.metric-card` (analytics), `.motion-fade-up`. Reused the existing `astaReveal`
  directive for scroll-in (no new directive — avoids over-engineering).
- New docs: `ASTA_UI_RECOVERY_AUDIT.md`, `ASTA_NOIR_COCKPIT_DESIGN_SYSTEM.md`.
- `npm run build:client` → **green + warning-free.**

The Synapse component library (mission-hero now unused on product screens, plus
learning-river / mastery-ring / signal-timeline / agent-orbit / intelligence-ribbon)
remains available; the hero is reserved for non-app/marketing surfaces only.

---

# Asta — Synapse Rebuild Report (prior turn)

Session 2026-05-30. Scope this turn: **flagship vertical slice** — build the Asta
Synapse design system foundation + core component library, redesign the Dashboard
end-to-end as the proven template, write the four required docs, verify the build.
Decisions: **dual palette** (warm green student / cool observatory admin) and
flagship-slice scope were confirmed with the user before building.

## Shell / footer / dock / scroll — audited, already correct
The three "critical layout bugs" from the brief were verified **already fixed** in
prior phases and re-confirmed this pass:
- Sidebar and main content scroll **independently** (fixed-viewport split, `data-asta-scroll`).
- Mobile bottom-nav is `lg:hidden`; main has `pb-24` so content is never hidden behind it.
- Ask Asta dock sits **above** the bottom-nav (`calc(76px + safe-area)`), no overlap.
- `body` does not scroll in the logged-in app; long pages scroll to their end.
No regressions introduced; the shell was not modified this turn.

## Design system created — Asta Synapse
- **`client/src/styles.css`** gained a self-contained Synapse layer (additive, non-breaking):
  - Hue ramp `--asta-blue/cyan/violet/emerald/amber/rose/indigo` + glows.
  - **Contextual accent** `--asta-accent/-2/-glow` = brand green by default; the `.asta-observatory` scope flips it cool (blue→violet) for admin surfaces — the dual palette.
  - `--asta-hero-1/2/3` cinematic ink; ease aliases; `.asta-synapse-bg` utility.
  - **Command-button system**: `.asta-primary-command`, `.asta-secondary-command`, `.asta-action-chip`.
  - **Motion system**: `.motion-lift/-press/-reveal/-soft-pop/-stagger` + keyframes (`astaRevealUp/SoftPop/Pulse/OrbitSpin/VoiceWave/RiverDraw`). Reduced-motion already globally neutralized.
- **Spec doc**: `client/src/app/shared/design/ASTA_SYNAPSE_DESIGN_SYSTEM.md` (philosophy, tokens, layout, buttons, motion, component library, screen recipes, anti-patterns, a11y, mobile).

## Components created — `client/src/app/shared/ui/synapse/`
`synapse.types.ts` (types + `TONE_VAR`), `asta-section-header`, `asta-mission-hero`
(cinematic intent + orb cluster + next-action brief), `asta-intelligence-ribbon`
(conic AI orb + insight), `asta-mastery-ring` (conic ring, replaces stat cards),
`asta-signal-timeline` (connected event stream), `asta-learning-river` (data-driven
**Catmull-Rom → Bézier** SVG path through milestone nodes with animated active
segment), `asta-agent-orbit` (live AI-state glyph). Barrel `index.ts`. All
standalone, OnPush, signal-input, token-driven, reduced-motion-safe.

## Screen redesigned — Dashboard = Mission Control
`features/dashboard/dashboard.component.ts` rebuilt to: Mission Hero (greeting +
goal/progress subtitle + next-best-action brief + Continue/Ask-Asta commands) →
Intelligence Ribbon (headline + top recommendation → cockpit) → Mastery Rings
(roadmap / learning-health / readiness, or milestones fallback) → Learning River
(roadmap milestones, with sampled-weeks fallback) → Current-focus panel + Signal
Timeline (intelligence timeline, weak-areas fallback). **All data wiring preserved**
(profile/roadmap/intel signals, `load()`) and **all states kept**: loading
skeletons, error+retry, not-onboarded, no-roadmap, full. No stat-card grid; no
border-strip identity.

## APIs added/fixed
None this turn — the Dashboard reuses existing endpoints (`/student-profile`,
`/roadmap/active`, `/intelligence/overview`). No backend changes were needed.

## Build / QA
- `npm run build:client` → **green, warning-free** (initial budget 500→540 kB to absorb intentional global Synapse CSS).
- Dashboard chunk 27.58 kB. No new lint surface (client has no lint script; the Angular strict-template build is the gate, and it passes).
- Fixed one build error in flight: the documented Angular gotcha — `as` alias only binds on a **primary** `@if`, not `@else if`; wrapped the full-state branch in a nested `@if (roadmap(); as r)`.

## Known limitations / not done this turn (see TODO_FIXED_OR_REMAINING.md)
- Only the **Dashboard** is migrated to Synapse; the other 16 priority screens are queued (Tutor, Roadmaps, Knowledge, Quiz, Intelligence are next).
- Synapse components not yet built: agent-swarm-map, knowledge-shard, project-forge-card, mentor-compass, quiz-arena-card, observatory-table, command-surface, command-palette(synapse), smart-composer, bottom-sheet, orb-button — listed for the next turns (existing equivalents cover several today).
- No live Puppeteer screenshot pass this turn (build-verified only); recommended before sign-off (harness recipe in project memory).
