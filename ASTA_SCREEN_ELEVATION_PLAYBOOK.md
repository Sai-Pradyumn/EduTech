# Asta — Screen Elevation Playbook

How to elevate every screen to the approved **Asta Noir Cockpit** design language —
consistently, safely, and build-green. This is the single source of truth for the
rollout. Read it before touching any screen.

**Gold-standard reference screens (study these first, every time):**
- `client/src/app/features/dashboard/dashboard.component.ts`
- `client/src/app/features/ai-tutor/tutor-workspace.component.ts`

---

## 0. Golden rules (do not violate)

1. **Visual/interaction only.** Never change data wiring — signals, computeds,
   services, `@Input/@Output`, streaming, `@if/@for`, route params. If you touch
   logic, you've gone too far.
2. **One screen = one file.** Edit only that component's `.ts`. Put screen-specific
   CSS in its own `styles: []`. **Never edit `styles.css` or any shared component**
   from a screen pass (those are global and change every screen).
3. **Build must stay green and warning-free.** `npm run build:client` from repo root.
   The Angular strict-template compiler is the gate (there is no client lint script).
4. **Compact, dark, premium, data-dense.** No giant heroes, no oversized orbs, no
   marketing banners, no border strips as identity. Depth comes from light + motion.
5. **Brand green is the identity on every screen** (student, admin, mentor alike).
   Do not introduce a separate admin palette — the app must feel like one product.

---

## 1. The design language (what "Noir Cockpit" means)

- **Surface:** the global `.card` is the panel — a near-black lifted sheet with a
  soft top-left corner bloom + a 1px hairline. On dark it sits one step above the
  page (`--paper-2`) so **edges and gaps read**. Never add a colored top/side strip.
- **Depth from light, not lines:** corner blooms, cursor spotlight, glow-ring hover.
- **Accent line allowed:** the `.kicker` (green dash + uppercase micro-label).
- **Motion is meaningful and subtle:** staggered entrance, hover lift, magnetic CTAs,
  shimmer/glow on progress, count-up numbers, confetti on completion. All
  reduced-motion-safe (globally neutralized).
- **Agent screens** get a conic "agent orb" that spins while busy.

---

## 2. The recipe (apply in this order on every screen)

### 2.1 Command header (replaces any plain page title / hero)
```html
<header class="asta-page-command-header">
  <div class="min-w-0">
    <h1 class="text-[26px] leading-tight mb-2 grad-flow">{{ Screen Title }}</h1>
    <span class="goal-pill"><span class="dot"></span>SHORT CONTEXT LINE</span>
  </div>
  <div class="flex gap-2.5 shrink-0">
    <asta-btn variant="accent" astaMagnetic ...>Primary</asta-btn>
    <asta-btn variant="ghost" astaMagnetic ...>Secondary</asta-btn>
  </div>
</header>
```
`.asta-page-command-header`, `.goal-pill` (+`.dot`), `.grad-flow` are **global** — no import.

### 2.2 Surfaces → `<asta-card>`
Convert generic stat/`.card` panels to `<asta-card>` (built-in cursor spotlight +
glow-ring hover). Keep tall **scrolling/reading surfaces** (chat threads, long
tables) as a calm raw `.card` (a spotlight on a scroll area is distracting).
Use `pad="16px 18px"` for compact panels, `[padded]="false"` for edge-to-edge
(tables) — note the **square brackets** on `[padded]` (it's a boolean input).

### 2.3 Entrance animation — PER CARD, never the container
Put `[astaReveal]="i"` on **each card** with an incrementing index (delay = i×80ms),
**not** on the wrapping grid. Container-level reveal animates the block as one and
looks like "no animation." Example: cards get `[astaReveal]="0"`, `"1"`, `"2"`…

### 2.4 Tilt + magnetic
- `astaTilt [tiltMax]="4"` on **compact** data cards (not on tables, long lists,
  kanban columns, or chat threads).
- `astaMagnetic` on primary CTA buttons.

### 2.5 Shared data atoms (already upgraded — use them, don't hand-roll)
- `<asta-ring [value]="x" [size]="..">` — gradient ring, glow, **counts up**, flat centre.
- `<asta-progress [value]="x">` — gradient fill, shimmer, glowing lead dot.
- `<asta-btn variant="accent">` — green pill with a shine sweep.
- `<span [astaCount]="n" suffix="%">` — count-up any number (`prefix`/`suffix`/`decimals`).
- `<span class="arr">→</span>` — trailing arrow that nudges on hover (global class).

### 2.6 Panel header with glyph
```html
<div class="panel-head">
  <p class="kicker">LABEL</p>
  <span class="panel-ico" aria-hidden="true"><svg .../></span>
</div>
```
Add to the component's `styles: []`:
```css
.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.panel-ico{width:32px;height:32px;flex-shrink:0;display:grid;place-items:center;border-radius:10px;
  color:var(--green-deep);background:color-mix(in oklch,var(--green) 13%,transparent);
  transition:transform .4s var(--ease-spring);}
asta-card:hover .panel-ico{transform:scale(1.14) rotate(-8deg);}
```
(The `asta-card:hover .panel-ico` selector works because the host `<asta-card>`
carries this component's view-encapsulation attribute.)

### 2.7 Agent/chat screens (mirror AI Tutor exactly)
Conic **agent orb** in the header that spins on `busy()`/streaming; per-message
streaming orb; gradient `.user-bubble`; refined `.starter-chip`/`.act-chip`; icon
feedback buttons; right rail as `asta-card`s (tilt + reveal + glyph). Copy the
orb/chip/bubble CSS verbatim from the AI Tutor `styles: []`.

### 2.8 States (every screen)
Loading skeleton · empty (encouraging copy + CTA, never "No data") · error + retry ·
success. Restyle in Noir; keep the existing state logic.

### 2.9 Interaction extras where they fit
- Quiz answers: press-scale, selected glow, correct success-pulse, wrong → explanation reveal.
- Table rows: hover elevation + green-tinted highlight; selected-row highlight.
- Inputs: focus glow (green ring). Upload zones: drag/hover glow.
- Confetti (`ConfettiService.burst({y:0.42})`) on completion moments only.

---

## 3. Shared toolkit (import paths)

| Thing | Import from | Notes |
|---|---|---|
| `CardComponent` (`<asta-card>`) | `shared/ui/card.component` | spotlight built-in; `accentVar`/`pad`/`[padded]` |
| `ButtonComponent` (`<asta-btn>`) | `shared/ui/button.component` | accent has shine |
| `RingComponent` (`<asta-ring>`) | `shared/ui/ring.component` | gradient + count-up |
| `ProgressComponent` (`<asta-progress>`) | `shared/ui/progress.component` | shimmer + lead dot |
| `RevealDirective` (`[astaReveal]="i"`) | `shared/directives/reveal.directive` | per-card |
| `TiltDirective` (`astaTilt [tiltMax]`) | `shared/directives/tilt.directive` | compact cards only |
| `MagneticDirective` (`astaMagnetic`) | `shared/directives/magnetic.directive` | CTAs |
| `CountDirective` (`[astaCount]`) | `shared/directives/count.directive` | numbers |
| `ConfettiService` | `core/services/confetti.service` | `.burst({y})` |
| Synapse set (`asta-step-tracker`, `asta-learning-river`, `asta-signal-timeline`, `asta-mastery-ring`, `asta-agent-orbit`, `asta-section-header`) | `shared/ui/synapse` | metaphor components |
| Global classes (no import) | — | `.asta-page-command-header`, `.goal-pill`/`.dot`, `.kicker`, `.grad-flow`, `.arr`, `.card`, `.metric-card`, `.motion-stagger`, `.motion-fade-up` |

**Standalone reminder:** every new symbol must be added to BOTH the `import {…}`
statement AND the component's `imports: []` array.

---

## 4. Pitfalls (these have actually bitten us)

1. **Cards merging / "no gap" on dark.** Card bg ≈ page bg and dark shadows are
   invisible on dark → cards blend. FIX (already in `styles.css`): on dark, cards
   use `--paper-2` (a step above the page) + a ~90% hairline. Don't weaken it.
2. **"Animation not present."** Caused by `[astaReveal]` on the grid *container*.
   Put it on **each card** with a stagger index.
3. **`@else if (x; as y)` fails** — the `as` alias works only on a **primary** `@if`.
   Nest: `@else { @if (x; as y) { … } }`.
4. **CSS custom properties** must be bound as full strings: `[style.--c]="'42%'"`,
   never `[style.--c.%]`.
5. **Boolean inputs** need brackets: `[padded]="false"` (NOT `padded="false"`),
   `[area]="true"` for chart flags.
6. **Don't leave dangling imports.** If you add an import, use it. Unused imports
   compile but are dead code (and a sign of an unfinished pass).
7. **Never run the build inside a parallel sub-agent** — concurrent `ng build` in
   one workspace races. Build once, centrally, after all edits.
8. **Reduced motion** is globally handled — don't add `@media (prefers-reduced-motion)`
   per screen unless you introduce a brand-new keyframe that needs taming.
9. **Don't dump a long list into a `col-span-2` card next to a short card** — a tall
   left card beside a short Progress card creates a big empty void. On dashboards use
   a **compact summary** (e.g. current-week box, not all 12 weeks); put the full
   list/tracker on its dedicated page (roadmap details) or bound its height with a
   scroll. (This was the one bug the live screenshot pass caught.)
10. **Topbar route-title vs page `<h1>`:** the shell shows the route title AND the
    command-header h1 — on screens where they're identical (Knowledge Hub, AI Tutor…)
    that reads as a mild duplication. Acceptable for now (the topbar acts as a
    breadcrumb); revisit shell-wide once all screens carry a command header.

---

## 5. Per-screen review checklist

For each screen, confirm:
- [ ] Command header (grad-flow title + goal pill + CTAs), no hero/oversized orb.
- [ ] Panels are `<asta-card>` (or calm `.card` for scroll/reading surfaces).
- [ ] **Every** card has `[astaReveal]="i"` (staggered), gaps visible (`gap-5`/`mt-5`).
- [ ] Compact cards have `astaTilt`; CTAs have `astaMagnetic`.
- [ ] Rings/bars use `asta-ring`/`asta-progress`; numbers use `[astaCount]`; arrows use `.arr`.
- [ ] Panel headers use `.panel-head` + `.panel-ico` glyph.
- [ ] Loading / empty / error / success states restyled in Noir.
- [ ] No border strips; no top-line emboss; brand green only.
- [ ] Build green + warning-free; all logic untouched.
- [ ] (Agent screens) agent orb + refined chips + gradient bubble.

---

## 6. Screen status

### ✅ Completed — elevated + **LIVE screenshot-verified** (dark, 1440px, against running app)
| Screen | File | Notes |
|---|---|---|
| Dashboard | `features/dashboard/dashboard.component.ts` | Gold standard. ✅ verified: gaps read, cards balanced, river renders. **Fixed:** full 12-week tracker → compact current-week box (tracker lives on roadmap details). |
| AI Tutor | `features/ai-tutor/tutor-workspace.component.ts` | ✅ verified: agent orb, mode chips, empty-state orb, rail. |
| Roadmap details | `features/roadmap/roadmap-details.component.ts` | ✅ verified: river + week-tracker + weekly-plan, balanced 2-col. Best-looking screen. |
| Knowledge Hub | `features/knowledge-hub/knowledge-hub.component.ts` | ✅ verified (upload + grounded-chat empty state). |
| Quiz Studio | `features/quiz-studio/quiz-studio.component.ts` | ✅ verified (stat row + generator + library). |
| Project Studio | `features/project-studio/project-studio.component.ts` | ✅ verified (forge panel + empty state). |
| Learning Intelligence | `features/intelligence/intelligence-cockpit.component.ts` | ✅ verified — looks elevated purely via the global ring/progress/card upgrades (file itself not edited). |
| Mentor Workspace | `features/mentor/mentor-workspace.component.ts` | ✅ verified (this-week + students + AI summary ring + notes). |
| Admin Analytics | `features/admin/admin-analytics.component.ts` | ✅ verified (dense metric row + donut + table). |
| Admin Students | `features/admin/admin-students.component.ts` | ✅ verified (roster + color health pills + header search). |

### 🟡 Code-elevated this turn — recipe applied, build green + warning-free (LIVE screenshot pass still pending)
| Screen | File | Notes |
|---|---|---|
| Agent Workspace (Mentor Room / Doubt Solver / Career Coach / Study Notes — 4 routes) | `features/agent-workspace/agent-workspace.component.ts` | Mirrors AI Tutor: command header, conic agent orb (header + per-msg), starter/act chips, gradient user-bubble, icon feedback, rail `asta-card`s (tilt+reveal+glyph, Quick actions / Recommended). Added `latestActions` computed (view-only). |
| Learning Intelligence | `features/intelligence/intelligence-cockpit.component.ts` | Command header + Refresh CTA; dropped banned `accentVar` on 3 cards; per-card `[astaReveal]` cascade (0–10); `astaTilt` on compact cards; magnetic CTAs. |
| Roadmap list | `features/roadmap/roadmap-list.component.ts` (+`components/roadmap-card.component.ts`) | Command header w/ active/archived counts + magnetic CTA; per-card reveal. Card refined: dropped `accentVar`, added `astaTilt` + animated `.arr`. |
| Roadmap generate | `features/roadmap/roadmap-generate.component.ts` | Command header on the form view; profile card tilt+reveal; magnetic Generate CTA. Cinematic generating state untouched. |
| Cohorts | `features/cohorts/cohorts.component.ts` | Command header; leaderboard bars → `asta-progress`; staggered reveal on detail panels. Master-detail lists kept calm. |
| Community | `features/community/community.component.ts` | Command header; thread-detail reveal. Thread/reply reading surfaces kept calm `.card`. |
| Certificates | `features/certificates/certificates.component.ts` | Command header; cert cards keep custom achievement bloom + got `astaTilt` + reveal. |
| Profile | `features/profile/profile.component.ts` | Command header; **new Voice section** surfacing wake-word toggle, mic-permission badge, Test-voice (via `VoiceActivationService`), unsupported note. |
| Reports | `features/reports/reports.component.ts` | Command header w/ Export CTA; tabs moved below; stat cards tilt+reveal; chart/table cards reveal. Brand green kept (no separate admin palette per §0.5). |

### 🟡 Code-elevated — third batch (whole-app sweep, build green + warning-free)
| Screen | File | Notes |
|---|---|---|
| Live Sessions | `features/live-sessions/live-sessions.component.ts` | Command header; staggered reveal on detail/recap/attendance panels (master-detail lists kept calm). |
| Workflows | `features/workflows/workflows.component.ts` | Command header (shows above the flag-off notice too); run-result card reveal. |
| Voice Room | `features/voice/voice-room.component.ts` | Command header; reveal on conversation + speak panels (pulsing mic kept). |
| Founder | `features/founder/founder-dashboard.component.ts` | Command header; reveal extended to the 4 lower panels (5–8); metrics already had reveal+count-up. |
| Admin Documents | `features/admin/admin-documents.component.ts` | Command header; donut + table card reveal. |
| Admin Roadmaps | `features/admin/admin-roadmaps.component.ts` | Command header; stat cards tilt+reveal; donut + table reveal. |
| Admin Assessments | `features/admin/admin-assessments.component.ts` | Command header; stat cards tilt+reveal; bar + table reveal. |
| Fine-Tuning | `features/admin/fine-tuning.component.ts` | Command header (above flag-off notice); per-job card reveal. |
| Org admin | `features/org/org-admin.component.ts` | Command header (keeps org switcher in the right slot); overview cards reveal/tilt. |
| Platform orgs | `features/platform/platform-orgs.component.ts` | Command header; stat cards tilt+reveal; create + list card reveal. |
| Onboarding | `features/onboarding/onboarding.component.ts` | Cinematic wizard preserved; magnetic Continue/Save CTAs (no command header — would clash). |
| Billing | `features/billing/billing.component.ts` | Command header; plan/usage + plan cards (tilt+reveal) + invoices reveal. (Was out-of-scope; included on explicit "all screens" request.) |
| Pricing (public) | `features/billing/pricing.component.ts` | Marketing hero preserved; plan cards tilt+reveal cascade. |
| Login / Register (public) | `features/auth/{login,register}.component.ts` | Magnetic accent submit CTA. |
| Cert verify (public) | `features/certificates/cert-verify.component.ts` | Verified-credential card reveal. |

**✅ Whole-app elevation complete.** Every routed screen now carries the Noir Cockpit
recipe (command header where it fits, per-card reveal cascade, tilt on compact cards,
magnetic CTAs, brand green). The only screens deliberately WITHOUT a command header are
the cinematic full-bleed flows (Onboarding wizard, Pricing/landing hero, auth forms) —
they got fitting motion instead. **LIVE screenshot pass is the only remaining step.**
| Admin Documents | `features/admin/admin-documents.component.ts` | Med |
| Admin Roadmaps | `features/admin/admin-roadmaps.component.ts` | Med |
| Admin Assessments | `features/admin/admin-assessments.component.ts` | Med |
| Fine-Tuning | `features/admin/fine-tuning.component.ts` | Low |
| Org | `features/org/org-admin.component.ts` | Low |
| Platform | `features/platform/platform-orgs.component.ts` | Low |
| Onboarding | `features/onboarding/onboarding.component.ts` | Low (already cinematic) |

### 🚫 Out of scope
- **Billing** (`features/billing/billing.component.ts`) — looks good, leave it (user's call).
- Public pages (landing/pricing/auth/cert-verify) — separate effort; not part of this app-shell rollout.

---

## 7. How to proceed (process)

1. Pick the next screen by priority.
2. **Read** the screen file + both gold-standard references.
3. Apply §2 recipe; preserve all logic (§0).
4. Add screen-specific CSS to the component `styles: []` only.
5. Walk the §5 checklist.
6. `npm run build:client` (green + warning-free) — fix any strict-template errors.
7. Visually verify (reload app / screenshot). Confirm gaps + per-card cascade.
8. Move on. Batch with sub-agents only if each agent owns a distinct file, none
   edits shared files, and the build is run **once** centrally afterward.
