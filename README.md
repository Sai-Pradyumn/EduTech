# Asta — AI Skill Mentor

> An **AI-native learning operating system**. Not an LMS with a chatbot bolted on — every surface is driven by cooperating AI agents. Students get a personalized roadmap, learn with an AI tutor, ask doubts grounded in their own notes (RAG), generate & take quizzes, plan real projects, and track progress.

**Stack:** Angular 18 · NestJS 11 · MongoDB (Mongoose) · Redis + BullMQ · Socket.IO · TypeScript (strict) · Tailwind. AI behind a provider abstraction with a **mock provider** so the whole app runs with **no API keys**.

---

## Features (MVP)

| # | Feature | Status |
|---|---|---|
| 1 | Auth — register/login, JWT (access+refresh), roles (student/admin/mentor), guards | ✅ Phase 1 |
| 2 | Student onboarding — 7-step profile (full field set) feeding the agents | ✅ Phase 2 |
| 3 | Dashboard — adaptive (onboarding → generate → active roadmap), progress, weak areas, next milestone | ✅ Phase 2 |
| 4 | **Agent OS** — normalized request/response + visual blocks, orchestrator (classify→route→context+memory→agent→validate→persist→stream), router, memory, tools, observability, sessions | ✅ Phase 3 |
| 5 | AI roadmap generator — goal-aware, personalized week-by-week plan | ✅ Phase 2 |
| 6 | **AI Tutor Workspace** — live WebSocket streaming, 10 modes, markdown, **visual blocks** (concept map, study plan, quiz, practice), agent activity feed, next actions | ✅ Phase 3 |
| 6b | **AI Mentor** — learning-health score + weekly action plan (auto-routed) | ✅ Phase 3 |
| 6c | Multi-provider (mock/openai/gemini/claude) + AI eval layer (prompt templates, output validation, feedback) | ✅ Phase 3 |
| 6d | **ml-service** — real PEFT/LoRA fine-tuning + inference (GPU-ready) | ✅ Phase 3 (arch) |
| 7 | **Knowledge Hub (RAG)** — upload/paste, chunk, embed, hybrid retrieve, **cited grounded answers + honest refusal**, summary, flashcards; RAG agent on the Agent OS | ✅ Phase 3 |
| 8 | **Quiz Studio (Assessment)** — adaptive quiz generation (topic / doc-grounded / weak-area / roadmap), grading, weak-area detection fed back to the profile, stats; Assessment agent | ✅ Phase 3 |
| 9 | **Project Studio** — goal → blueprint (stack/features/phased Kanban/milestones), Kanban board with live progress, submission scaffold; ProjectBuilder agent | ✅ Phase 3 |
| 10 | **Learning Intelligence cockpit** — skill radar, weakness heatmap, health & readiness scores, momentum, quiz trend, activity timeline (aggregates roadmap + quizzes + agent activity) | ✅ Phase 3 |
| 11b | **All 11 agents live** — Tutor, Mentor, Roadmap, RAG, Assessment, ProjectBuilder, Doubt-solver, Career, ContentCreator, AdminInsight (no more Tutor-fallback); intent auto-routing + dedicated pages | ✅ Phase 3 |
| 11c | **Multi-tenant SaaS + RBAC** — organizations + memberships, OrgRole/Permission engine, tenant-isolation guards, org workspace + platform operator pages | ✅ Phase 4 · B1 |
| 11d | **Mentor ecosystem** — assigned-students roster, per-student risk + AI summary, mentor notes, project review queue (approve / request changes) | ✅ Phase 4 · B2 |
| 11e | **Landing page** — full design-spec rebuild: scroll-blur nav, hero isometric tilt + animated path, movable infinite dot-grid background, marquee, scroll-drawn "journey" path with milestone pops, agent glyph grid, live streaming mini-chat demo, count-up stats, CTA glow (reduced-motion safe) | ✅ Experience · U1 |
| 11f | **Dark mode** — `light / dark / system` theme with no-flash boot, persisted choice, OS-sync, sun/moon/auto toggle (topbar + landing); all design tokens flip via `data-theme` | ✅ Experience · U2 |
| 11g | **Ambient backgrounds** — app-wide drifting aurora + movable dot-grid behind content, scroll-parallaxed; reusable `astaParallax`/`astaTilt` directives (reduced-motion safe) | ✅ Experience · U3 |
| 11h | **Shared components** — `asta-dropdown`, `asta-search`, `asta-modal`, and a global **⌘K command palette** (jump to any page/agent) | ✅ Experience · U4 |
| 11i | **Smart composer** — shared `asta-composer` with custom file-upload (drag/drop + chips) + **mic dictation** + auto-grow; on the agent workspaces & dock | ✅ Experience · U5 |
| 11j | **Talking AI dock** — always-on floating assistant (bottom-right) on every screen: streaming chat, **read-aloud (TTS)** + voice-in, animated speaking orb | ✅ Experience · U6 |
| 11k | **Cohort-based learning** — org-scoped cohorts (mentors + students + shared roadmap goal + timeline), **LI-powered leaderboard**, announcements, member management; `/app/cohorts` | ✅ Phase 4 · B3 |
| 11l | **Billing + AI metering** — plan catalog (Free/Pro/Team), mock checkout, subscriptions, invoices, and a monthly **AI usage meter** vs plan limits; `/app/billing` + public `/pricing` | ✅ Phase 4 · B5/B6 |
| 11m | **Certificates** — issue verifiable credentials (gated by permission), **public verification page** at `/certificate/verify/:id`; `/app/certificates` | ✅ Phase 4 · B7 |
| 11n | **In-app notifications** — topbar bell with unread badge + mark-read; cohort announcements fan out to enrolled students | ✅ Phase 4 · B13 |
| 11o | **Production ops** — Dockerfiles (FE/BE), `docker-compose.prod.yml`, nginx reverse-proxy, CI workflow, deploy doc; security headers + per-IP rate limiting; `/api/health/detailed` readiness probe | ✅ Phase 4 · B10/B11/B12 |
| 11 | Admin dashboard + AI analytics | ⏳ Phase 6 |
| 12 | Notifications (in-app + BullMQ) | ⏳ Phase 6 |
| 13 | WebSocket foundation (streaming + realtime) | ⏳ Phase 3 |

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for the phase-by-phase build. **Phases 1–2 are complete and verified end-to-end** — you can register → onboard → generate a personalized roadmap → track progress → see it on the dashboard.

> **Experience upgrade in progress.** The big UI/UX push — finishing the landing page, dark mode, signature micro-interactions & animated backgrounds, a shareable component library, a universal smart composer (file upload + mic), and an always-on talking AI dock — is tracked as a checkable backlog in [`docs/UI_UX_UPGRADE_PLAN.md`](docs/UI_UX_UPGRADE_PLAN.md). It also mirrors the product backlog (B3+) from [`docs/PHASE_4_DELIVERY_PLAN.md`](docs/PHASE_4_DELIVERY_PLAN.md) and lists brainstormed feature proposals.

### Phase 2 flow (try it)
1. Register (or log in as the seeded student) → if not onboarded you're routed to **/onboarding** (7 steps).
2. Finish onboarding → routed to **/app/roadmap/generate** → edit the goal/timeline/intensity → **Generate roadmap** (Roadmap Agent runs; an AI-working loader shows).
3. Land on **roadmap details**: weekly timeline, milestones, projects, assessment plan, daily plan, tips. Tick weeks/tasks → progress updates live.
4. **Dashboard** now shows the active roadmap, progress ring, current week, next milestone, weak areas and recommended actions.

The roadmap is generated by a goal-aware mock that produces genuinely different plans for MERN vs DevOps vs DSA, etc. — varying by skill level, weak areas, timeline and career target. See [`docs/AI_AGENTS.md`](docs/AI_AGENTS.md) §7b.

---

## Architecture

```
client/  Angular SPA  — features/* · shared/ui (asta-* atoms) · core (services/guards/interceptors) · layout (shell)
server/  NestJS API   — modules/* · common (guards/filters/interceptors) · config · database · sockets · queues · storage
docs/    PRD · ARCHITECTURE · DATABASE_SCHEMA · API_CONTRACTS · AI_AGENTS · IMPLEMENTATION_PLAN
EduTechDesign/  the visual contract (design spec + reference landing page)
```

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The UI follows [`EduTechDesign/docs/DESIGN_SPEC.md`](EduTechDesign/docs/DESIGN_SPEC.md) (brand **Asta**, OKLCH tokens, Bricolage/Hanken/JetBrains type, green=growth accent, the scroll-drawn "path" metaphor).

---

## Setup

### Prerequisites
- Node 20+
- Docker (for Mongo + Redis) **or** local `mongod` + `redis-server`

### 1. Install (one command — npm workspaces)
```bash
npm install
```

### 2. Configure env
```bash
cp server/.env.example server/.env
# client config lives in client/src/environments/environment.ts (see client/.env.example)
```

### 3. Start infrastructure (Mongo as a single-node replica set + Redis)
```bash
npm run dev:infra        # docker compose up -d
```
> No Docker? Run your own `mongod` (replica set recommended) and `redis-server`, and point `MONGO_URI` at it.

### 4. Seed demo data
```bash
npm run seed
```
Creates:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@asta.dev` | `admin12345` |
| Student | `student@asta.dev` | `student12345` |

### 5. Run
```bash
npm run dev              # server (:3000) + client (:4200) together
# or individually:
npm run dev:server
npm run dev:client
```
Open **http://localhost:4200**. API is at **http://localhost:3000/api** (health: `/api/health`).

### Build
```bash
npm run build            # builds server then client
```

---

## Environment variables (`server/.env`)

| Var | Purpose |
|---|---|
| `PORT` | API port (3000) |
| `CLIENT_ORIGIN` | CORS origin (http://localhost:4200) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | token signing secrets |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | token lifetimes |
| `REDIS_HOST` / `REDIS_PORT` | Redis for BullMQ |
| `AI_PROVIDER` | `mock` \| `openai` \| `gemini` (mock needs no keys) |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | real provider keys (optional) |
| `VECTOR_BACKEND` | `keyword` \| `atlas` (keyword needs no vector DB) |
| `STORAGE_PROVIDER` | `local` \| `s3` |
| `AWS_*` / `S3_BUCKET` | S3 storage (optional) |

Frontend (`client/.env.example`): `API_BASE_URL`, `SOCKET_URL` → set in `client/src/environments/environment.ts`.

---

## How the AI provider abstraction works

All AI goes through **`IAIProvider`** (`generateText`, `streamText`, `generateStructuredOutput`, `generateEmbedding`). A factory selects the implementation from `AI_PROVIDER`:

- **`MockAIProvider`** (default) — realistic, deterministic responses; simulates token streaming; deterministic hashed embeddings. **Runs with zero API keys.**
- **`OpenAIProvider` / `GeminiProvider`** — real SDK calls behind the same interface; throw a clear "configure key" error until wired.

Swap providers by changing one env var — no code changes. Details: [`docs/AI_AGENTS.md`](docs/AI_AGENTS.md).

## How RAG works

`upload → extract → chunk → embed → store chunks (+ vector) → retrieve → grounded answer (with citations)`. Vector search is behind **`IVectorSearch`**: `KeywordVectorSearch` (default, no DB needed) or `AtlasVectorSearch` (`VECTOR_BACKEND=atlas`). Chunks store an `embedding: number[]`, so it's vector-ready from day one.

---

## Future roadmap

Mentor marketplace · payments · real email/WhatsApp notifications · mobile apps · multi-tenant orgs · fine-tuned models · real Atlas Vector Search at scale. All have clean placeholders/abstractions in the MVP.

---

## How the Agent OS works (Phase 3)

Every AI surface goes through one pipeline: **classify intent → route to agent → load profile/roadmap/memory → run agent (calling tools) → validate structured output → persist → stream**. Agents return an `AgentResponse` whose `visualBlocks[]` (concept map, study plan, quiz, weakness analysis, mentor feedback, …) the frontend renders as real UI — so the product is a *learning cockpit*, not a chat box. Streaming runs over Socket.IO (`agent:started|thinking|tool_call|chunk|visual_block|completed`). Providers are swappable (`AI_PROVIDER=mock|openai|gemini|claude`); the mock runs everything with no keys. See [`docs/AI_AGENT_OS.md`](docs/AI_AGENT_OS.md).

## ml-service (LoRA/PEFT)

`ml-service/` is a **real** Python PEFT/LoRA service (training + inference, GPU-ready, with a no-GPU smoke path) — separate from NestJS, which only orchestrates job records. It is **not** wired into the running app yet (`ENABLE_FINE_TUNING=false`). See [`docs/FINE_TUNING_LORA_ARCHITECTURE.md`](docs/FINE_TUNING_LORA_ARCHITECTURE.md).

## Repo docs
- [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) · [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) · [`docs/AI_AGENTS.md`](docs/AI_AGENTS.md)
- Phase 3: [`docs/AI_AGENT_OS.md`](docs/AI_AGENT_OS.md) · [`docs/AGENT_WORKFLOWS.md`](docs/AGENT_WORKFLOWS.md) · [`docs/RAG_ARCHITECTURE.md`](docs/RAG_ARCHITECTURE.md) · [`docs/VOICE_AGENT_ARCHITECTURE.md`](docs/VOICE_AGENT_ARCHITECTURE.md) · [`docs/FINE_TUNING_LORA_ARCHITECTURE.md`](docs/FINE_TUNING_LORA_ARCHITECTURE.md)
- UX/dashboards: [`docs/FRONTEND_UX_SYSTEM.md`](docs/FRONTEND_UX_SYSTEM.md) · [`docs/STUDENT_DASHBOARD.md`](docs/STUDENT_DASHBOARD.md) · [`docs/ADMIN_COMMAND_CENTER.md`](docs/ADMIN_COMMAND_CENTER.md)
