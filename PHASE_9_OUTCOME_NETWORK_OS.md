# Phase 9 — Outcome Network, Skill Passport & Ecosystem OS

> **Theme: "From learning to verified outcomes."**
> Asta no longer only helps people learn — it helps them **prove** what they've mastered, see exactly how close they are to a real role, and decide the single best next move toward employability. Built strictly inside the existing **Noir Cockpit** design language: compact command headers, dense cards, skill graphs, proof timelines — no heroes, no dead placeholders.

This phase was delivered **Priority-1-deep + the Outcome Council**, then scaffolded the remaining ecosystem modules as a clear, honest backlog (see *Known limitations / next*). Everything ships **offline-safe** (mock AI provider, deterministic fallbacks, no paid keys) and connects to the existing learning graph (Skill Twin, flows, roadmaps, projects, quizzes, voice, certificates, ledger).

---

## Vision

Most AI education apps help answer questions. Asta helps **prove progress**. Phase 9 answers, for every learner:

1. What have I actually mastered? → **Skill Passport** skill graph (mastery · confidence · evidence · risk)
2. What proof exists? → **Proof-of-Learning Ledger** (verified events with verification levels)
3. What projects prove my ability? → **Project evidence** on the passport
4. How close am I to a real role? → **Career Readiness** score against a role rubric
5. What exact gaps block me? → skill-gap matrix, top-3 blockers, proof gaps
6. What should I do this week? → explainable **7-day plan** + **AI Outcome Council** verdict
7. How can others verify me? → **public Skill Passport** at `/u/:username`, certificate-grade trust

---

## What shipped (built deep & runtime-verified)

### Module 1 — Skill Passport ✅
A living, verified profile. **Computed on read** by blending Skill Twin + Proof Ledger + certificates + projects + manually-added evidence; persists only identity + sharing settings + a small cached snapshot.

- **Sections:** identity card (name, target role, level, readiness/health rings, top skills, pace) · skill graph (mastery, confidence, evidence count, last practiced, risk level) · proof summary tiles · project evidence cards (stack, AI score, mentor status, repo/demo links) · learning timeline with **per-event public/private eye toggle**.
- **Privacy:** visibility `private | unlisted | public`; granular toggles (`showScores`, `showProjects`, `showTimeline`, `showCertificates`, `verifiedOnly`). The public builder strips hidden sections and zeroes scores server-side — no client-trust leakage.
- **Public profile:** trust-styled, unauthenticated `/u/:username` ("Verified by Asta"), plus an in-app **public preview** (`/app/skill-passport/public-preview`).
- **Manual evidence:** attach a skill + summary + link; recorded as a ledger event too.

### Module 2 — Proof-of-Learning Ledger 2.0 ✅ (extends the Phase-8 ledger)
- Added **skill tags**, **verification levels** (`self < ai < system < mentor < certificate`), and **per-event passport visibility** to the schema.
- New event kinds: `quiz_failed`, `project_ai_reviewed`, `project_mentor_approved`, `voice_viva_passed`, `mentor_feedback_added`, `skill_mastery_increased`, `daily_plan_completed`, `interview_completed`, `interview_passed`, `evidence_added`.
- Rich `summary()` (by kind, by verification, active days, verified/public counts, top skills), manual `events` endpoint, and a visibility toggle. Base path moved to `/proof-ledger` (back-compatible `stats` alias kept; client updated).

### Module 3 — Career Readiness Engine ✅
- **11-role rubric catalog** (`career-roles.ts`): Full-Stack, MERN, Java Full-Stack, Angular, Backend, AI Engineer, DevOps, Data Analyst, Cybersecurity, Mobile, Product. Each declares required/optional skills, project/interview/portfolio expectations and a weighted readiness rubric.
- **Explainable score** across 5 dimensions (skills, projects, interview, consistency, portfolio). Crucially **proof-based**: mastery is `max(radar mastery, proven ledger evidence)` so passing a React quiz / getting a project reviewed actually moves the needle.
- Skill-gap matrix, **top-3 blockers**, portfolio checklist, **7-day plan** (each item deep-links to flows/quizzes/projects/interview/mistakes), and a human **CareerReadinessAgent** explanation (LLM when live, deterministic fallback always).

### Module 11 — AI Outcome Council ✅
- Six specialist perspectives (Skill Twin, Career Readiness, Project Reviewer, Interview Coach, Portfolio Builder, Consistency Coach) each propose **one grounded action** with expected impact, time required, route and risk-if-ignored.
- Deterministic **impact ranking** → best action + ranked alternatives; an agent narrates an explainable **verdict** (LLM + fallback). Caches latest; accept (deep-link) / dismiss in the UI.

### Module 12 — Dashboard 3.0 (outcome cockpit) ✅
- Compact outcome strip on the dashboard: **Career Readiness** (score ring + top blocker) and **Skill Passport** (verified-proof count + publish status), both deep-linked. No hero; same row, same reveal family; reduced-motion safe.
- Grouped nav: new **Outcome** section (Skill Passport · Career Readiness · Outcome Council · Proof-of-Learning).

---

## Routes added

| Route | Auth | Purpose |
|---|---|---|
| `/app/skill-passport` | student | Skill Passport cockpit |
| `/app/skill-passport/public-preview` | student | Preview your public profile |
| `/app/career-readiness` | student | Career readiness + gaps + plan |
| `/app/outcome-council` | student | AI Outcome Council |
| `/u/:username` | **public** | Public, verifiable Skill Passport |

## APIs added

**Skill Passport** — `GET /skill-passport/me`, `PATCH /skill-passport/me`, `POST /skill-passport/recompute`, `POST /skill-passport/publish`, `POST /skill-passport/unpublish`, `GET /skill-passport/evidence`, `POST /skill-passport/add-evidence`, `DELETE /skill-passport/evidence/:id`, `GET /skill-passport/public/:username` *(public)*.

**Proof Ledger** — `GET /proof-ledger`, `GET /proof-ledger/summary`, `GET /proof-ledger/stats`, `POST /proof-ledger/events`, `PATCH /proof-ledger/events/:id/visibility`.

**Career Readiness** — `GET /career-readiness/me`, `POST /career-readiness/analyze`, `GET /career-readiness/roles`, `GET /career-readiness/roles/:id`, `POST /career-readiness/set-target-role`, `POST /career-readiness/generate-gap-plan`.

**Outcome Council** — `POST /outcome-council/recommend`, `GET /outcome-council/latest`.

## Schemas added
- `SkillPassport` (identity + visibility + public settings + cached snapshot, unique `user`/`username`)
- `SkillEvidence` (manual proof artifacts)
- `CareerReadinessState` (chosen target role + cached score)
- `CouncilRecommendation` (cached council verdict)
- `LedgerEntry` extended: `skills`, `verificationLevel`, `visibleOnPassport` + new kinds.

## Agents added
- `CareerReadinessAgent` — narrates the readiness score (LLM + deterministic fallback)
- `OutcomeCouncilAgent` — narrates the council verdict (LLM + deterministic fallback)

Both use the existing **AI gateway** (`AiService`), log usage metadata only (no sensitive content), validate/guard output, and degrade gracefully with **no paid keys**.

## Seed data
Seeded student (`student@asta.dev`) now demos the whole outcome flow on first run:
- A **published** Skill Passport (`/u/aarav-sharma-xxxx`) with a headline + target role.
- 10 ledger events carrying **skill tags + verification levels** (quizzes, project + AI review, viva, mistake repair, week complete).
- 2 manual skill-evidence artifacts (repo link + DOM projects).
- A `CareerReadinessState` targeting **Full Stack Developer** → live score ≈ **48% (building)** with credible per-dimension breakdown.

> Seed is idempotent. The Phase-9 collections (`ledger_entries`, `skill_passports`, `skill_evidence`, `career_readiness_states`) were refreshed during development so the enriched ledger (with skill tags) is what powers the demo.

## Privacy & public-sharing rules
- Default visibility is **private**; nothing is public until the learner publishes.
- The **public builder runs server-side** and removes hidden sections, zeroes scores when `showScores` is off, and (with `verifiedOnly`) drops self/AI-only evidence. The public route 404s for private profiles.
- Per-event ledger visibility lets a learner hide individual proofs from the public passport.
- `GET /skill-passport/public/:username` is the **only** unauthenticated outcome endpoint.

## Build status
- `npm run build:server` ✅ green · `npm run build:client` ✅ green (Angular strict templates).
- `npm run seed` ✅ runs clean against local Mongo.
- Runtime-smoked: login → `skill-passport/me`, `career-readiness/me` (proof-based score), `proof-ledger/summary` (skill aggregation), `outcome-council/recommend`/`latest`, and the **unauthenticated** `skill-passport/public/:username`.

## Known limitations / next (scaffolded backlog)
Delivered Priority 1 + the Outcome Council deeply. The remaining Phase-9 modules are **specced and ready to build on the same foundation** (they all reuse the ledger/passport/readiness services already shipped):

- **Portfolio Builder** (`/app/portfolio`, `PortfolioBuilderAgent`) — generate a public portfolio from passport evidence.
- **Project Review 2.0** — rubric scoring already exists in Project Studio; add `ProjectReview` history, "add-to-passport/portfolio", richer mentor flow.
- **Interview OS** (`/app/interview`, `InterviewCoachAgent`) — the readiness 7-day plan and council already deep-link to `/app/interview`; wire the session engine (can reuse Phase-8 Simulation Labs + Voice Room).
- **Resume & Application Assistant** (`/app/resume`, `/app/applications`) — JD paste → match score from the readiness engine.
- **Mentor Marketplace**, **Template/Creator Marketplace**, **Institution Outcome Layer** — extend existing `mentor`, `course-builder`, `cohort`/`org` modules.
- **Public Portfolio route** `/p/:username`, intelligent **Nudge Engine**, and a dedicated **Privacy/Export/Reset** settings page (privacy primitives — per-event visibility, evidence delete, passport unpublish, Skill-Twin reset — already exist).

## Next phase recommendation
**Phase 10 — "Apply & get hired":** Interview OS + Resume/Application assistant + Mentor Marketplace, all feeding the Skill Passport and Career Readiness already shipped here — turning verified proof into actual applications and offers.
