# Asta — App Motion System (originally "Dashboard")

> Codifies the consistent reveal + hover taxonomy so similar cards move **as a
> family** and same-row cards animate **together**. Compact Noir cockpit,
> reduced-motion-safe. Supersedes the old per-card `astaTilt`/`astaReveal`
> flourishes that made every card feel like it had its own animation.
>
> **Now app-wide — rollout COMPLETE.** Applied to every logged-in screen: dashboard,
> AI Tutor, Agent Workspace, Roadmap (list/details/generate), Knowledge Hub, Quiz
> Studio, Learning Intelligence, Project Studio, Mentor, Founder, Reports, Billing,
> Admin (analytics/students/documents/roadmaps/assessments/fine-tuning), Voice,
> Workflows, Certificates, Community, Cohorts, Live-sessions, Org, Platform, plus the
> public Pricing/Cert-verify pages. The canonical reveal class is `.motion-card-reveal`
> (`.dashboard-reveal` is a retained alias). The **only** screen that keeps the old
> `astaTilt`/`astaReveal` directives is the public `landing` page (cinematic by design).

Authority for layout/identity stays `ASTA_NOIR_COCKPIT_DESIGN_SYSTEM.md`. This doc
governs **motion only**.

## 1. Problem this fixes
Before: each dashboard card carried `astaTilt [tiltMax]=X` with X varying per card
(2, 3, 5, 6, 6, 6, 2…) plus a linear `astaReveal` index (0→6). Result: every card
tilted by a different amount on hover and revealed on its own timeline — visually
"random per card." The reveal was also a dramatic 0.9s / 26px slide.

After: one shared reveal keyframe + one shared hover-lift; rows cascade with a small
fixed delay; cards within a row differ only by a tiny stagger.

## 2. CSS variables (`client/src/styles.css`, `:root`)
| Variable | Value | Purpose |
|---|---|---|
| `--motion-duration-fast` | `0.34s` | quick reveals (chips, small elements) |
| `--motion-duration-med` | `0.5s` | the canonical card reveal duration |
| `--motion-stagger-step` | `70ms` | per-card stagger inside a row |
| `--motion-row-delay` | set by row class | base delay for the whole row |
| `--motion-card-index` | set inline per card | the card's position in its row |

Reveal delay = `--motion-row-delay + (--motion-card-index * --motion-stagger-step)`.

## 3. Row classes (set `--motion-row-delay`)
| Class | Delay | Typical use |
|---|---|---|
| `.motion-row-primary` | `0ms` | first/anchor row |
| `.motion-strip` | `130ms` | a horizontal metric/intel strip |
| `.motion-row-2` | `130ms` | a generic 2nd row |
| `.motion-row-panel` | `200ms` | a grid of equal panels |
| `.motion-row-3` | `260ms` | a generic 3rd row |
| `.motion-lower` | `300ms` | lower sections (river, reviews, timeline) |

Put the row class on the row **wrapper** (grid div), or on the card itself when a
row is a single card (strip, river). The variable inherits to children.

## 4. Card families (uniform hover/press within a kind)
| Class | Use |
|---|---|
| `.dashboard-primary-card` | anchor cards (next-move, active roadmap, progress) |
| `.dashboard-panel-card` | the three compact intelligence panels |
| `.dashboard-action-chip` | small actions/chips (press/lift only) |
| `.metric-card` | compact dense metric (analytics/observatory) |

Hover lift is **not** owned by these classes — it comes from `.hover-lift`
(uniform `translateY(-3px)` + green glow-ring). Any clickable card opts in via the
`asta-card` `[interactive]="true"` input (which toggles `.hover-lift` on the inner
`.card`) or, for an `<a class="card">`, by adding `hover-lift` directly. This keeps
**every clickable dashboard card lifting identically**. Non-clickable container
cards (active roadmap, progress, next-move, river — they hold inner controls) do
**not** lift; they only share the reveal family.

## 5. Reveal class
```css
.dashboard-reveal {
  animation: astaRevealUp var(--motion-duration-med) var(--ease) both;
  animation-delay: calc(var(--motion-row-delay, 0ms)
                       + var(--motion-card-index, 0) * var(--motion-stagger-step));
}
```
`astaRevealUp` (existing keyframe): `opacity 0→1`, `translateY(14px)→0`,
`scale .985→1`. Same keyframe / duration / easing / transform distance for **every**
card — only the delay differs.

## 6. Reduced motion
A `@media (prefers-reduced-motion: reduce)` block neutralizes the dashboard reveal
(`animation: none; opacity: 1`) and chip hover/press transforms. The global
reduced-motion rule already collapses all transition/animation durations, so hover
state changes remain instant and legible without movement.

## 7. Rules for new dashboard cards
1. Add `dashboard-reveal` + the matching family class.
2. Set `style="--motion-card-index:N"` for its position in the row (0-based).
3. Put the row class on the row wrapper.
4. If clickable as a whole, set `[interactive]="true"` (asta-card) or add
   `hover-lift` (anchor). Otherwise leave it static.
5. Never reintroduce per-card `astaTilt` with varying `tiltMax`, and never give a
   same-row card a different reveal duration/distance.

## 8. What was removed
`TiltDirective` and `RevealDirective` were dropped from the dashboard imports
(`MagneticDirective` retained on header CTAs, `CountDirective` retained for the
count-up metrics). The directives still exist for other screens.
