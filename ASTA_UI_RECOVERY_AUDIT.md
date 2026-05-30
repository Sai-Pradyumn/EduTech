# Asta — UI Recovery Audit

The previous turn introduced a **giant marketing-style hero** on the Dashboard
(screenshot B). This audit records what was wrong, what to do with each piece, and
the surgical recovery toward the compact Noir cockpit baseline (screenshots A & C).

> Baseline soul = screenshots A (AI Analytics, dense) + C (compact dashboard:
> active-roadmap + progress grid, intelligence strip). **Protect & improve — don't replace.**

## Damage inventory & disposition
| File / area | Issue introduced | Disposition | Action taken |
|---|---|---|---|
| `features/dashboard/dashboard.component.ts` | Giant `asta-mission-hero` (~350px) + huge orb cluster + full-width mastery-ring row → pushed data below fold, decorative > functional | **REVERT to baseline** | Rebuilt compact: command header → active-roadmap+progress grid → intelligence strip → 3 panels → small river at bottom |
| `shared/ui/synapse/asta-mission-hero.component.ts` | The giant hero component itself | **KEEP but unused** on product screens | No longer imported by Dashboard; remains in library for non-app/marketing use only |
| Dashboard cards using `accentVar` (left border) | Thick colored side-border as card identity (banned) | **REFINE** | Dropped `accentVar`; identity now from the subtle `.kicker` (green dash + uppercase micro-label) — allowed |
| `layout/shell.component.ts` `.botnav` | **Bottom nav showed on desktop** — component style `.botnav{display:flex}` (scoped `[_ngcontent]`, specificity 0,2,0) outranked Tailwind `lg:hidden` (0,1,0) | **FIX (real bug)** | `.botnav` now `display:none` by default; shown only via `@media (max-width:1023.98px)` as a floating capsule. Desktop = not rendered visually |
| `styles.css` Synapse layer (last turn) | Blue/cyan/violet hero tokens + command-button system | **PRESERVE (additive)** | Kept — they don't recolor the product; green stays primary. Compact `.asta-page-command-header`/`.goal-pill`/`.metric-card` added |
| Ask Asta dock | Reported overlap with bottom nav | **VERIFIED fixed** | Dock sits above nav on mobile (`calc(76px+safe)`); with desktop nav now hidden, no overlap on desktop |

## Scroll / shell verification (per screenshots + code)
- `body` does not scroll (fixed-viewport split) ✅
- Sidebar own-scroll + main own-scroll (independent) ✅
- Main scrolls fully to end (`pb-24` clears the floating mobile nav) ✅
- Desktop shows **no** bottom nav (fixed this turn) ✅

## Preserve list (the soul — untouched)
- Dark dotted/grid ambient background; thin panel outlines (`.card`).
- Green primary accent; uppercase mono micro-labels (`.kicker`, `.pill`).
- Serious sidebar with small active indicator; compact topbar; streak flame.
- Admin (cool) vs student (green) workspace distinction.
- AI Analytics dense metric row + donut + table (screenshot A) — **not touched**; `.metric-card` hover available when it's polished next.

## Recovery result
Dashboard is data-dense above the fold again, no hero, no oversized orbs. The
learning-river is demoted to a single lower section (path overview), not a banner.
Build green + warning-free. Remaining screen polish in `TODO_FIXED_OR_REMAINING.md`.
