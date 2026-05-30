# Asta Synapse Design System

> Asta is a **learning constellation**. The student moves through a personalized
> path; AI agents orbit the learner; knowledge appears as shards; quizzes become
> mastery arenas; projects become forges; admin becomes an observatory; voice
> becomes a living orb.

Synapse is a **metaphor-driven layer built on top of** Asta's existing OKLCH brand
tokens (`client/src/styles.css`). It is **additive and non-breaking** — every
existing screen keeps working; new flagship screens adopt Synapse components.

---

## 1. Design philosophy

The app must read as *"my AI-powered learning cockpit"*, not an LMS / admin
template / chatbot wrapper / stat-card grid. Identity comes from **spatial
composition, lighting, depth, motion, glyphs, learning paths, AI states, and
data visualization** — never from coloured border strips.

Emotional target: intelligent · calm · premium · futuristic · agentic · alive.

### Dual palette (decided 2026-05-30)
- **Student app = warm brand green** (`--green`/`--green-deep`) — encouraging,
  the learner's identity. This is the default `--asta-accent`.
- **Admin / Founder / Reports = cool observatory** — blue → violet command-center
  feel, via the `.asta-observatory` scope which overrides `--asta-accent`.

The Synapse hue ramp (blue/cyan/violet/emerald/amber/rose/indigo) is used for
**agent identity and AI state**, not as a wholesale recolor of the brand.

---

## 2. Visual tokens (`styles.css` → "ASTA SYNAPSE DESIGN SYSTEM" block)

| Token | Role |
|---|---|
| `--asta-blue / cyan / violet / emerald / amber / rose / indigo` | Synapse hue ramp (agent/state accents) |
| `--asta-glow-blue / cyan / violet / emerald` | Soft glow rgba for shadows/blooms |
| `--asta-accent`, `--asta-accent-2`, `--asta-accent-glow` | **Contextual** accent — green for students; cool inside `.asta-observatory` |
| `--asta-hero-1/2/3` | Cinematic dark hero ink (both themes) |
| `--asta-ease`, `--asta-ease-spring` | Aliases of brand eases |

Brand tokens still own surfaces/text/radii/shadows: `--paper*`, `--ink*`,
`--text*`, `--r-sm…xl`, `--shadow-sm/md/lg`, `--card-hi`. **Use tokens — never
scatter raw colours in components.**

---

## 3. Spacing, type, geometry
- Spacing: the 4px grid (`--space-1..20`); Tailwind `p-/m-/gap-` follow the same grid.
- Type: `.t-display-1/-2`, `.t-h-app`, `.t-h-card`, `.t-body`, `.t-small`, `.t-label`, `.kicker`. Synapse adds `.syn-kicker` (accent-coloured mono eyebrow).
- Radii: `--r-sm 12 · md 18 · lg 26 · xl 36`. Heroes use `--r-xl`; cards `--r-md/lg`; pills/buttons `999px`.
- Containers: `--maxw-reading/app/content/dash` (shell main = dash).

---

## 4. Layout rules (app shell — already correct, A2)
- Fixed-viewport split: document never scrolls. Sidebar column and `<main data-asta-scroll>` each own their scroll (`.scroll-area`).
- Topbar sticky inside the content column; ambient aurora pinned behind content.
- Mobile: sidebar → off-canvas drawer; bottom-nav `lg:hidden`; main `pb-24` clears it; Ask Asta dock sits **above** the bottom-nav (`calc(76px + safe-area)`).

---

## 5. Command-button system
- `.asta-primary-command` — gradient (`--asta-accent → --asta-accent-2`), glow, lift on hover, press-scale, `:disabled` dimmed.
- `.asta-secondary-command` — frosted glass, lift.
- `.asta-action-chip` — small tinted action; accent wash on hover.

(The existing `asta-btn` atom remains valid for in-card actions; command buttons are for hero/ribbon CTAs.)

---

## 6. Motion system (all reduced-motion-safe via the global kill-switch)
`.motion-lift` · `.motion-press` · `.motion-reveal` · `.motion-soft-pop` ·
`.motion-stagger` (auto-delays children). Keyframes: `astaRevealUp`,
`astaSoftPop`, `astaPulse`, `astaOrbitSpin`, `astaVoiceWave`, `astaRiverDraw`.

**Principles:** motion explains hierarchy / shows AI state / confirms actions /
reduces confusion — never decorates. `@media (prefers-reduced-motion: reduce)`
neutralizes all animation + transition durations globally.

---

## 7. Component library (`client/src/app/shared/ui/synapse/`)

| Component | Selector | Purpose |
|---|---|---|
| Section Header | `asta-section-header` | kicker + title + subtitle + action slot |
| Mission Hero | `asta-mission-hero` | cinematic screen intent + orb cluster + next-action brief |
| Intelligence Ribbon | `asta-intelligence-ribbon` | one strong AI insight + conic orb + actions |
| Mastery Ring | `asta-mastery-ring` | conic progress ring + copy (replaces stat cards) |
| Signal Timeline | `asta-signal-timeline` | connected event stream (activity/notifications/logs) |
| Learning River | `asta-learning-river` | flowing SVG path through milestone nodes |
| Agent Orbit | `asta-agent-orbit` | single AI agent with live state glyph |

Shared types + `TONE_VAR` map in `synapse.types.ts`. Barrel: `synapse/index.ts`.

**Usage rule:** prefer these over duplicating card markup. Map generic content →
component:

```
Progress / stat        → Mastery Ring
Roadmap / progress     → Learning River
AI / agent             → Agent Orbit
Notification/activity  → Signal Timeline
Page header            → Mission Hero
AI recommendation      → Intelligence Ribbon
Actions                → Command buttons / Action Chips
```

---

## 8. Screen recipes (metaphor per screen)
1. Dashboard = **Mission Control** — hero → ribbon → mastery rings → learning river → current-focus + signal timeline. ✅ *built*
2. AI Tutor = Cognitive Studio (canvas + agent rail; response as visual blocks)
3. Roadmaps = Learning Path Galaxy (learning river + milestone constellation)
4. Knowledge Hub = Knowledge Vault (knowledge shards + retrieval confidence)
5. Quiz Studio = Mastery Arena (focus question + mastery rings)
6. Project Studio = Project Forge (blueprint + journey + review signal)
7. Mentor Room = Mentor Compass (N/E/S/W guidance)
8. Learning Intelligence = Skill Observatory (radar/heatmap/momentum + rings)
9. Admin = Platform Observatory (`.asta-observatory`, cool palette)
10. Voice Room = Asta Voice Chamber (living voice orb — exists)
11. Notifications = Signal Timeline · 12. Profile = Personal AI Core

---

## 9. Anti-patterns (forbidden as design identity)
- `border-left/-top: Npx solid` as card identity, coloured/gradient border strips.
- The same card repeated on every screen; a wall of stat cards.
- Border as identity. Borders may exist only as subtle 1px separators (`color-mix(... var(--paper-3) 58%, transparent)`).
- Random gradient blobs without purpose.

> Replacing a side-border with a top-border is a **failed** implementation.

---

## 10. Accessibility
- Global focus ring (`:focus-visible`), `aria-current="page"` nav, `role="alert"` field errors, aria-live toasts, charts `role="img"`, modal focus-trap, skip-to-content link.
- Reduced-motion kill-switch (§6). Decorative orbs/rings are `aria-hidden`.
- Contrast: live-swept 0 violations (light + dark) across 37 routes — keep new tones (cyan/amber on paper) for **glyphs/accents**, not body text.

---

## 11. Mobile rules
- Learning river height grows on `≤720px`; mission hero collapses to single column `≤880px`.
- Tables → cards; swarms → vertical stacks.
- Bottom-nav only on mobile; Ask Asta never overlaps it; long pages scroll fully to end.
