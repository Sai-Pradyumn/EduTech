# Phase 9 — Outcome Network, Skill Passport & Ecosystem OS

> **Theme: "From learning to verified outcomes."**
> Asta no longer only helps people learn — it helps them **prove** what they've mastered, see exactly how close they are to a real role, and decide the single best next move toward employability. Built strictly inside the existing **Noir Cockpit** design language: compact command headers, dense cards, skill graphs, proof timelines — no heroes, no dead placeholders.

**All 15 modules are now built** — Priority 1 deeply, then Priority 2–4 end-to-end (backend + frontend + seed). Everything ships **offline-safe** (mock AI provider, deterministic fallbacks, no paid keys) and connects to the existing learning graph (Skill Twin, flows, roadmaps, projects, quizzes, voice, certificates, ledger). New AI agents use the existing gateway and degrade gracefully to deterministic logic when no key is present.

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
- Grouped nav: **Outcome** + **Ecosystem** sections.

### Module 4 — Portfolio Builder ✅
Generates an editable, public-facing portfolio from verified evidence (passport + projects + certificates) with **AI-written about copy + per-project case studies** (`PortfolioBuilderAgent`, LLM + fallback). Publish/unpublish, granular public toggles, public route **`/p/:username`**. `/app/portfolio`.

### Module 5 — Project Review 2.0 ✅
Builds on Project Studio's existing rubric AI review. Adds a **case-study generator** (`POST /projects/:id/generate-case-study`), **add-to-passport** (`POST /skill-passport/from-project/:id` → creates `SkillEvidence` + a verified ledger event) and **add-to-portfolio** (`POST /portfolio/add-project/:id`) — turning a reviewed project into portable proof.

### Module 6 — Interview OS ✅
Role-based mock interviews across **9 types** (HR, technical, frontend, backend, system design, project deep-dive, behavioral, DSA, voice viva). Deterministic question bank + `InterviewCoachAgent` answer scoring (LLM + transparent heuristic), a full feedback report (technical/communication/confidence), and outcome wiring: a **verified ledger event feeds Career Readiness** and **weak areas flow into Mistake OS**. `/app/interview`.

### Module 7 — Resume & Application Assistant ✅
`ResumeAgent` generates an ATS-style resume from verified evidence (summary, highlights, project bullets, copy-as-Markdown). `ApplicationAgent` + a deterministic **skill-detection vocabulary** analyze a **pasted JD** (no scraping) into a **match score, matched/missing skills, a tailored cover letter and a prep plan**, with an application tracker (status + notes). `/app/resume`, `/app/applications`.

### Module 8 — Mentor Marketplace ✅
Mentor profiles students can browse; **session requests** (project/interview/portfolio/roadmap/general reviews); mentor accept/complete; a completed session writes a **mentor-verified ledger event** back to the student's proof timeline. "Become a mentor" profile editor. `/app/mentors`.

### Module 9 — Creator/Template Marketplace ✅
Creators publish reusable templates (flow/roadmap/quiz/project/simulation/interview/course/study-space/visual); **admin moderation queue** (approve/reject); learners browse by type and **use → clone route** into the matching generator; usage tracking. `/app/marketplace`, `/app/creator-studio`.

### Module 10 — Institution Outcome Layer ✅
Org-isolated, admin/mentor-only **cohort placement-readiness analytics** reusing the cohort + Career Readiness engines: per-student readiness rolled up to cohort + institution (avg readiness, at-risk, job-ready, top performers, weak concepts across cohorts) and **assign flow/template to a cohort**. `/app/institution`.

### Module 13 — Public Trust / Sharing Layer ✅
Public, unauthenticated, privacy-filtered **`/u/:username`** (Skill Passport) and **`/p/:username`** (Portfolio), plus the existing certificate verification — all server-side privacy filtered, "Verified by Asta" trust styling.

### Module 14 — Nudge Intelligence ✅
**Event-driven**: `NudgeEngine` turns quiz/project/week events into de-duplicated, actionable notifications (`createUnique`, no spam). **Pull-based**: `GET /nudges` computes the learner's ranked next actions from live readiness/passport state.

### Module 15 — Privacy, Export & Reset ✅
`GET /privacy/export` (full outcome data as downloadable JSON), one-click **make-everything-private**, **reset Skill Twin**, **clear application tracker**, and a settings page showing exactly what's public. `/app/privacy`.

---

## Routes added

| Route | Auth | Purpose |
|---|---|---|
| `/app/skill-passport` | student | Skill Passport cockpit |
| `/app/skill-passport/public-preview` | student | Preview your public profile |
| `/app/career-readiness` | student | Career readiness + gaps + plan |
| `/app/outcome-council` | student | AI Outcome Council |
| `/app/portfolio` | student | Portfolio builder |
| `/app/interview`, `/app/interview/sessions/:id` | student | Interview OS |
| `/app/resume`, `/app/applications` | student | Resume + Applications |
| `/app/mentors`, `/app/mentor-sessions` | student | Mentor Marketplace |
| `/app/marketplace`, `/app/creator-studio` | student/creator | Template Marketplace |
| `/app/institution` | admin/mentor | Institution outcomes |
| `/app/privacy` | student | Data & privacy |
| `/u/:username` | **public** | Public, verifiable Skill Passport |
| `/p/:username` | **public** | Public, verifiable Portfolio |

## APIs added

**Skill Passport** — `GET /skill-passport/me`, `PATCH /skill-passport/me`, `POST /skill-passport/recompute`, `POST /skill-passport/publish`, `POST /skill-passport/unpublish`, `GET /skill-passport/evidence`, `POST /skill-passport/add-evidence`, `DELETE /skill-passport/evidence/:id`, `GET /skill-passport/public/:username` *(public)*.

**Proof Ledger** — `GET /proof-ledger`, `GET /proof-ledger/summary`, `GET /proof-ledger/stats`, `POST /proof-ledger/events`, `PATCH /proof-ledger/events/:id/visibility`.

**Career Readiness** — `GET /career-readiness/me`, `POST /career-readiness/analyze`, `GET /career-readiness/roles`, `GET /career-readiness/roles/:id`, `POST /career-readiness/set-target-role`, `POST /career-readiness/generate-gap-plan`.

**Outcome Council** — `POST /outcome-council/recommend`, `GET /outcome-council/latest`.

**Portfolio** — `GET/PATCH /portfolio/me`, `POST /portfolio/generate|publish|unpublish`, `POST /portfolio/add-project/:id`, `GET /portfolio/public/:username` *(public)*.

**Project Review 2.0** — `POST /projects/:id/generate-case-study`, `POST /skill-passport/from-project/:id`, `POST /portfolio/add-project/:id`.

**Interview OS** — `GET /interview/types`, `POST /interview/start`, `POST /interview/:id/respond`, `POST /interview/:id/finish`, `GET /interview/sessions`, `GET /interview/sessions/:id`.

**Resume / Applications** — `GET/PATCH /resume/me`, `POST /resume/generate`; `POST /applications/analyze-jd`, `POST /applications`, `GET /applications`, `PATCH /applications/:id`, `DELETE /applications/:id`.

**Mentor Marketplace** — `GET /mentors`, `GET /mentors/:id`, `GET /mentors/profile/me`, `POST/PATCH /mentors/profile`, `POST /mentor-sessions`, `GET /mentor-sessions`, `PATCH /mentor-sessions/:id/status`, `POST /mentor-sessions/:id/notes`.

**Template Marketplace** — `GET /marketplace/templates`, `GET /marketplace/templates/mine`, `GET /marketplace/templates/pending` *(admin)*, `GET /marketplace/templates/:id`, `POST /marketplace/templates`, `PATCH /marketplace/templates/:id`, `POST /marketplace/templates/:id/publish`, `POST /marketplace/templates/:id/review` *(admin)*, `POST /marketplace/templates/:id/use`.

**Institution** *(admin/mentor, org-isolated)* — `GET /institution/overview`, `GET /institution/cohorts/:id/outcomes`, `POST /institution/cohorts/:id/assign-flow|assign-template`, `GET /institution/reports/outcomes|readiness`.

**Nudges** — `GET /nudges`. **Privacy** — `GET /privacy/settings`, `GET /privacy/export`, `POST /privacy/make-private|reset-skill-twin|clear-applications`.

## Schemas added
- `SkillPassport`, `SkillEvidence`, `CareerReadinessState`, `CouncilRecommendation`
- `Portfolio`, `InterviewSession`, `Resume`, `Application`
- `MentorProfile`, `MentorSession`, `MarketplaceTemplate`
- `Project` extended: `caseStudy`; `LedgerEntry` extended: `skills`, `verificationLevel`, `visibleOnPassport` + new kinds.

## Agents added
- `CareerReadinessAgent` — narrates the readiness score
- `OutcomeCouncilAgent` — narrates the council verdict
- `PortfolioBuilderAgent` — about copy + project case studies
- `InterviewCoachAgent` — scores interview answers + feedback
- `ResumeAgent` / `ApplicationAgent` — resume summary + JD-tailored cover letter

All use the existing **AI gateway** (`AiService`), log usage metadata only (no sensitive content), validate/guard output, and degrade to deterministic logic with **no paid keys**.

## Seed data
Seeded student (`student@asta.dev`) now demos the whole outcome flow on first run:
- A **published** Skill Passport (`/u/aarav-sharma-xxxx`) with a headline + target role.
- 10 ledger events carrying **skill tags + verification levels** (quizzes, project + AI review, viva, mistake repair, week complete).
- 2 manual skill-evidence artifacts (repo link + DOM projects).
- A `CareerReadinessState` targeting **Full Stack Developer** → live score ≈ **48% (building)** with credible per-dimension breakdown.
- A **draft Portfolio**, a **published mentor profile** (Maya Mentor) + a **requested project-review session**, and **two marketplace templates** (one published, one in the admin moderation queue).
- The **admin** is wired to the demo org so the **Institution** dashboard renders cohort outcomes on first run.

> Seed is idempotent. The Phase-9 collections (`ledger_entries`, `skill_passports`, `skill_evidence`, `career_readiness_states`) were refreshed during development so the enriched ledger (with skill tags) is what powers the demo.

## Privacy & public-sharing rules
- Default visibility is **private**; nothing is public until the learner publishes.
- The **public builder runs server-side** and removes hidden sections, zeroes scores when `showScores` is off, and (with `verifiedOnly`) drops self/AI-only evidence. The public route 404s for private profiles.
- Per-event ledger visibility lets a learner hide individual proofs from the public passport.
- `GET /skill-passport/public/:username` is the **only** unauthenticated outcome endpoint.

## Build status
- `npm run build:server` ✅ green · `npm run build:client` ✅ green (Angular strict templates).
- `npm run seed` ✅ runs clean against local Mongo.
- Runtime-smoked end-to-end: passport, readiness (proof-based), ledger summary, outcome council, **portfolio generate**, **interview start→respond→finish** (report), **resume generate**, **applications analyze-jd** (match score), **mentors + mentor-sessions**, **marketplace list + admin pending**, **institution overview** (admin & mentor), **nudges**, **privacy settings**, and the unauthenticated public `/u/:username` + `/p/:username`.

## Known limitations (honest)
All 15 modules are functional and integrated, but a few are deliberately **foundation-level** (per the brief — "build the foundation, not full payment complexity"):
- **Mentor Marketplace** has no payments/scheduling/calendaring (free + request/accept/complete flow only); ratings are seeded, not yet user-submitted.
- **Template Marketplace** "use" increments usage and routes to the matching generator; it does not yet auto-populate the generator with the template's blueprint payload (the `content.goal` is carried, deep prefill is the next step).
- **Institution** computes readiness per student on demand (capped at 40/request) rather than via a background job/cache; large cohorts would want BullMQ precompute. Org name falls back to a generic label when the cohort view doesn't carry it.
- **Interview answer scoring** uses an LLM when a key is present, otherwise a transparent length/structure heuristic (it does not claim to grade factual correctness offline).
- **Nudges** are event-driven + pull-based; no email/WhatsApp delivery (placeholders only).

## Next phase recommendation
**Phase 10 — "Hired":** real mentor scheduling + payments, marketplace deep-clone (template → fully populated flow/roadmap/quiz), background readiness precompute (BullMQ) for institutions, and outbound nudge delivery (email/WhatsApp) — converting the proof layer shipped here into booked sessions and submitted applications at scale.
