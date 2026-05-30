# Asta — Fixed / Remaining

## ✅ Fixed / done — recovery turn (latest)
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

## 🎯 Remaining — priority order (one verified screen per turn)
> **Guard:** apply the **compact Noir cockpit** treatment (command header, `.card`
> panels, `.kicker` labels, dense layout, subtle motion). NO heroes/oversized orbs
> inside the app. Metaphors below are layout intents, kept compact.

1. **AI Tutor** → Cognitive Studio: split canvas + Agent Orbit rail; render response as visual blocks (already typed) with per-block styling.
2. **Roadmaps** (list + details + generate) → Learning Path Galaxy: learning river as the spine, milestone constellation, recalculate CTA.
3. **Knowledge Hub** → Knowledge Vault: build `asta-knowledge-shard`; retrieval-confidence panel; encouraging empty state.
4. **Quiz Studio** → Mastery Arena: focus-question mode, press/correct/wrong micro-interactions, result mastery rings (confetti already wired ≥70%).
5. **Learning Intelligence** → Skill Observatory: keep charts, frame with Mission Hero + mastery rings + intelligence ribbon.
6. **Project Studio** → Project Forge: build `asta-project-forge-card`; blueprint → journey timeline → AI-review signal.
7. **Mentor Room** → Mentor Compass: build `asta-mentor-compass` (N/E/S/W).
8. **Admin Analytics + Students** → Platform Observatory: wrap in `.asta-observatory`; build `asta-observatory-table`.
9. **Voice Room** → polish with the existing living voice orb + Mission Hero.
10. Notifications panel → Signal Timeline; Profile → Personal AI Core (+ surface voice settings); then Billing/Certificates/Reports/Founder/Community/Cohorts/Live-sessions/Org/Platform.

## 🧩 Synapse components still to build
`asta-agent-swarm-map`, `asta-knowledge-shard`, `asta-project-forge-card`,
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
