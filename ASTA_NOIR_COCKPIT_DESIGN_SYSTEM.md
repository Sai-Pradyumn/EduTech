# Asta Noir Cockpit — Design System

> A dark, sharp, calm, **compact** AI learning control center. Not a landing page,
> not a SaaS template, not a colorful toy. Data density and product usability first;
> decoration never crowds out information.

This documents the **product surface** rules. It supersedes any hero/marketing
direction inside the app. The existing OKLCH dark theme already realizes the Noir
mood (see screenshots A & C) — this codifies and protects it.

## 1. Principles
- **Compact > decorative.** Useful above the fold. No giant heroes, oversized orbs, or banner sections inside the app.
- **Identity from rhythm, not borders.** Subtle 1px hairline panels + uppercase micro-labels. No thick colored side/top border strips as card identity.
- **Green is the product identity.** Cyan/violet are reserved for AI-state/agent accents and the admin observatory — never a wholesale recolor.
- **Motion is subtle and functional** (hover lift, press, fade-up, active-nav glow) and globally reduced-motion-safe.

## 2. Tokens (existing OKLCH theme — `client/src/styles.css`)
Surfaces `--ink/-2/-3`, `--paper/-2/-3`; text `--text/-soft/-mute`; accents
`--green/-deep`, `--peri`, `--coral`, `--danger`; radii `--r-sm..xl`; shadows
`--shadow-sm/md/lg`; eases `--ease`, `--ease-spring`. Dark theme via
`:root[data-theme="dark"]`. The Synapse `--asta-*` ramp + glows exist for
AI-state/agent accents only.

The Noir spec colours (`#070b12`, `#63ef7a`, …) map onto these existing tokens —
we did **not** fork a parallel palette.

## 3. Surfaces
- **`.card` IS the Noir panel** — subtle hairline (`color-mix(var(--paper-3) 58%)`) + top light-bloom (`inset 0 1px 0 var(--card-hi)`). Clickable cards lift on hover. Use everywhere instead of `.asta-panel`-style duplicates.
- `.metric-card` — compact dense metric (analytics/observatory); outline + lift, green-tinted hover border.
- **No `accentVar` left-border** as identity; use `.kicker` instead.

## 4. Micro-labels & header
- `.kicker` — green dash + uppercase mono label (the panel kicker). The allowed accent line.
- `.pill` / `.goal-pill` — uppercase mono pill with a glowing green dot.
- `.asta-page-command-header` — compact page header: `h1` + goal pill on the left, primary/secondary actions on the right. **Use this instead of a hero on every app screen.**

## 5. Buttons
- `asta-btn variant="accent"` (green pill, baseline) for in-product CTAs; `variant="ghost"` for secondary.
- `.asta-primary-command` / `.asta-secondary-command` available for hero-less command rows.

## 6. Shell (fixed-viewport split)
- `h-dvh overflow-hidden`; sidebar + `<main data-asta-scroll>` each own-scroll; topbar sticky; body never scrolls.
- **Bottom nav is mobile-only**: hidden on desktop via the shell's own `@media (max-width:1023.98px)` (do NOT rely on Tailwind `lg:hidden` — scoped component styles outrank it). Floating capsule on mobile; main `pb-24` clears it.
- Ask Asta dock: bottom-right desktop; above the bottom-nav on mobile.

## 7. Sidebar
Compact links, small left active indicator (3px green bar + glow) — allowed. Hover x-translate + faint bg. Independent scroll; mobile off-canvas drawer.

## 8. Motion (reduced-motion-safe)
`.motion-lift`, `.motion-press`, `.motion-fade-up`, `.motion-stagger`,
`.motion-reveal`; `astaReveal` directive for scroll-in (reuse — do not add a new
scroll-reveal directive). `@media (prefers-reduced-motion)` neutralizes all.

Apply to: sidebar hover/active, topbar/Ask-Asta buttons, Continue buttons, metric
& panel cards, rings, table/notification rows, quiz answers, AI blocks, upload
zones, dropdowns/modals. **Do not animate large page sections heavily.**

## 9. Dashboard recipe (canonical compact layout)
```
Command header (greeting + goal pill + Continue / Ask Asta)
Active roadmap (anchor, lg:col-span-2)  +  Progress (ring + weeks/milestones/streak)
Learning intelligence strip (mini rings + insight + Open cockpit →)
3 compact panels (Next milestone · Weak areas · Recommended project)
Learning river (lower path overview — not a hero)
```

## 10. Screen rules (compact, no heroes)
AI Tutor = cockpit (answer area + agent rail + knowledge chips + session timeline,
response blocks). Roadmap = compact header + active panel + week cards + milestones.
Knowledge = compact upload + document cards + retrieval chips. Quiz = generator +
focus question + reveal + result rings. **Admin/AI Analytics = dense metric row +
charts + tables, observability feel, no banners.**

## 11. States (Noir-styled)
Every major screen: loading skeleton · empty (encouraging, with CTA) · error +
retry · success. Empty copy is specific ("No roadmap yet — Asta can create a focused
path…"), never "No data found."

## 12. Anti-patterns (forbidden)
Giant hero banners / oversized orbs / landing sections inside the app; repeated
border-left or border-top cards; giant empty cards; glassmorphism everywhere;
big rounded low-density cards; chatbot-only layouts; decoration that reduces usability.
