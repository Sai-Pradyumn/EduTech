# Phase 8 — Multimodal Flow Intelligence + Voice-Native Learning OS

> Goal: evolve Asta into an AI-native learning **operating system** — speak/type a goal, get a
> living visual learning graph, study with voice, see knowledge as a graph, generate diagrams,
> practice in simulations, and evolve through a personal Skill Twin.
>
> This document tracks Phase 8 delivery. It is built **incrementally and deeply** rather than
> shallowly across every module at once (per the phase brief: *"complete Priority 1 deeply"*).

## Status at a glance

| Priority | Module | Status |
|---|---|---|
| **1** | **Flow Studio** (visual learning graphs) | ✅ **Shipped** (this pass) |
| 1 | Visual Intelligence Studio | ⏳ queued |
| 1 | Complete Voice Room (browser STT/TTS + sessions) | ⏳ queued (stub `voice` module + browser STT/TTS services already exist) |
| 1 | Skill Twin foundation | ⏳ queued (builds on `learning-intelligence` + `student-profile`) |
| 1 | Mistake OS foundation | ⏳ queued (quiz wrong-answers + topic severity already captured) |
| 2 | Study Spaces · Simulation Labs · Daily Autopilot | ⏳ queued |
| 3 | Course Builder · Peer Rooms | ⏳ queued |
| 4 | AI Mentor Council · Proof-of-Learning · Learning Replay · Modality Router | ⏳ queued |

Build status: **`npm run build:server` green**, **`npm run build:client` green & warning-free**
(initial bundle **517.77 kB**, < 540 kB budget; `flow-detail` lazy chunk ~24.8 kB). Server **boots
clean** (all 13 flow routes mapped, no DI errors) and the API was **runtime-smoked** with the mock
provider (generate → execute-node → complete-cascade → recalculate → export all verified). Seed
inserts **2 demo flows** (22-node MERN, 20-node DSA).

---

## Module 1 — Flow Studio ✅

A **living, visual graph** of learning nodes generated from a goal (+ the learner's profile, weak
areas, and optionally an existing roadmap). Not a flat roadmap — a dependency graph with unlock
logic, mixed node types, weak-area repair branches, a capstone project, a voice viva and a final
mastery gate.

### Routes (client)
- `/app/flows` — Flow Studio home: generate panel + flow gallery (states: loading / error / empty / success).
- `/app/flows/new` — same component focused on generation.
- `/app/flows/:id` — **graph cockpit**: SVG canvas (pan/zoom/drag), right-side inspector, 5 view modes.

### Graph views
1. **Map** — full SVG dependency graph (dot-grid "mission control" canvas; drag nodes, drag to pan, scroll to zoom).
2. **Timeline** — week/stage buckets as a compact list (also the **mobile fallback** < 768 px).
3. **Focus** — current + next-best-available nodes as action cards with Start.
4. **Weakness** — dims everything except weak-area-repair nodes and low-mastery concepts.
5. **Project** — dims everything except project nodes and the concepts applied in them.

### Node inspector (right rail)
Type + icon, title, status, objective, summary, difficulty, estimated minutes, mastery %,
prerequisites (resolved to titles), linked resources, AI hints, and actions:
**Start** (routes to the right surface), **Mark mastered** / **Reopen**. With no selection it shows a
mission briefing (counts, legend).

### Node types (15) & edge relations (8)
`concept · prerequisite · lesson · practice · quiz · project · checkpoint · weak_area_repair ·
mentor_review · voice_practice · simulation · document_source · diagram · image · mastery_gate`
linked by `prerequisite · unlocks · reinforces · tests · depends_on · alternative_path ·
weak_area_patch · project_application`.

### Node statuses & unlock logic
`locked → available → in_progress → completed` (+ `skipped`). A node becomes **available** when all
its prerequisites are completed; completing a node recomputes the whole graph and unlocks dependents;
flow progress = completed / total. Completing the `mastery_gate` marks the flow complete.

### "Execute node" routing
Starting a node marks it `in_progress` and returns an execution descriptor telling the client where to
do the work:

| Node type | Opens | Agent |
|---|---|---|
| concept / lesson / prerequisite / checkpoint | AI Tutor | tutor |
| practice | AI Tutor (practice) | tutor |
| quiz / mastery_gate | Quiz Studio | — |
| project | Project Studio | — |
| voice_practice / simulation | Voice Room | — |
| mentor_review | Mentor Room | mentor |
| weak_area_repair | AI Tutor (repair) | doubt_solver |
| document_source / diagram / image | Knowledge Hub | — |

### Backend
```
server/src/modules/flows/
  schemas/flow.schema.ts           Flow + embedded FlowNode/FlowEdge/FlowTimelineBucket
  dto/flow.dto.ts                  GenerateFlowDto, UpdateFlowDto, AddNodeDto, UpdateNodeDto, PositionDto
  flow-architect/
    generated-flow.types.ts        GeneratedFlow + FlowBlueprintInput
    flow-blueprint.generator.ts    deterministic graph builder (curated tracks + generic decomposition)
    flow-architect.service.ts      FlowArchitectAgent: LLM structured output + mock fallback + normalize/validate
  flows.service.ts                 generate / fromRoadmap / CRUD / node ops / execute / recalculate / export
  flows.controller.ts              REST + toView mapper + ENABLE_FLOW_STUDIO gate
  flows.module.ts                  registers Flow + Roadmap models, StudentProfileModule
```

### API (all under `/api`, JWT-guarded, `userId`-scoped)
`GET /flows/status` · `POST /flows/generate` · `POST /flows/from-roadmap/:roadmapId` ·
`GET /flows` · `GET /flows/:id` · `PATCH /flows/:id` · `POST /flows/:id/nodes` ·
`PATCH /flows/:id/nodes/:nodeId` · `DELETE /flows/:id/nodes/:nodeId` ·
`POST /flows/:id/execute-node/:nodeId` · `POST /flows/:id/recalculate` · `POST /flows/:id/export` ·
`DELETE /flows/:id` (archive).

### Schema (Mongoose, collection `flows`)
`Flow { user, org?, title, goal, description, sourceType, sourceId?, status, difficulty, nodes[],
edges[], timeline[], progressPercentage, metadata }`. `FlowNode { id, type, title, summary,
objective, difficulty, estimatedMinutes, masteryScore, status, position{x,y}, stage,
prerequisites[], resources[], agentHints[], linkedRoadmapId?, linkedQuizId?, linkedProjectId?,
linkedKnowledgeDocumentIds[], linkedVisualAssetIds[], linkedVoiceSessionIds[] }`. `FlowEdge { id,
source, target, relation, strength, explanation }`.

### Agent — FlowArchitect
`FlowArchitectService.generate(userId, input)` calls `AiService.generateStructuredOutput<GeneratedFlow>`
with a JSON schema and a `mockFactory` that builds a deterministic blueprint. LLM output is
**normalized** (missing positions laid out by stage, statuses seeded, edges defaulted) and **validated**
(≥3 nodes, edges array) — on any failure it falls back to the blueprint, so **Flow Studio works with no
API key**. Curated topic backbones exist for MERN, DSA, system design, Java/Spring, Angular and
cybersecurity; anything else is decomposed generically. Usage is logged to `ai_usage_logs` under the
roadmap agent class.

### Provider abstraction
No new provider needed — Flow Studio reuses the existing **LLM gateway** (`AiService`) with its mock
fallback. Image/diagram/STT/TTS provider abstractions arrive with Modules 2 & 3.

### Seed data
`seed.ts` inserts two demo flows for the seeded student (idempotent — only if none exist): a 22-node
**MERN** flow with a lived-in progress state (2 completed, 1 in-progress, dependents unlocked, ~9%) and
a 20-node **DSA** flow. The app looks alive immediately after `npm run seed`.

### Feature flag
`ENABLE_FLOW_STUDIO` (config `flags.flowStudio`). **On by default** (Flow Studio is the flagship
Priority-1 deliverable); set `ENABLE_FLOW_STUDIO=false` to disable — `GET /flows/status` reports it and
generation/from-roadmap return 403 when off.

### Design-system compliance (Noir Cockpit)
Compact command headers, `.card` panels, `.kicker` labels, no heroes/oversized orbs. Green = active
learning path; cyan/violet (`--peri`) = AI/intelligence nodes (quiz/diagram/voice/mentor); amber/coral
(`--coral`) = weak-area/risk; the canvas reads as a mission-control map. Motion uses the shared
`.motion-card-reveal` + `.motion-row-*` taxonomy; canvas/node transitions are subtle and the
`prefers-reduced-motion` block neutralizes them. Mobile (< 768 px) auto-switches to the timeline/list
view with a static inspector.

### Acceptance (Module 1) — all met
✅ generate a flow from a goal · ✅ view it as a visual graph · ✅ inspect nodes · ✅ start
tutor/quiz/project/voice/mentor from a node · ✅ mark complete (unlock cascade) · ✅ recalculate (adds
weak-area repairs) · ✅ export · ✅ loading/empty/error/success states · ✅ mobile list fallback ·
✅ works without paid API (deterministic blueprint) · ✅ build passes · ✅ demo seed.

---

## Data relationships wired this pass
- **Roadmap → Flow**: `POST /flows/from-roadmap/:roadmapId` seeds the graph backbone from roadmap weeks.
- **Flow node → Tutor / Quiz / Project / Voice / Mentor / Knowledge**: `execute-node` returns the route + prompt + agent.
- **Profile weak areas → Flow**: `recalculate` injects `weak_area_repair` nodes from `StudentProfile.weakAreas`.
- Node link fields (`linkedQuizId`, `linkedProjectId`, `linkedVisualAssetIds`, `linkedVoiceSessionIds`, …)
  are persisted now so Modules 2–7 can attach artifacts back onto flow nodes without a schema change.

## Limitations / deferred
- `from-knowledge` flow generation is deferred to land with the Visual/Spaces modules (the node link
  fields already exist).
- `diagram` / `image` / `simulation` node types render and route today but their dedicated studios
  (Modules 2 & 7) are not built yet — they currently route to Knowledge / Voice as sensible stand-ins.
- FlowArchitect is **not** wired into the chat orchestrator's agent registry (it runs as a generator
  service like the Roadmap agent); a `FlowArchitect` `AgentType` + registry entry can be added when
  voice "speak-a-goal → flow" lands in Module 3.

## Feature flags (Phase 8 roster)
Shipped: `ENABLE_FLOW_STUDIO` (default on). Planned: `ENABLE_VISUAL_STUDIO`, `ENABLE_VOICE`,
`ENABLE_BROWSER_STT`, `ENABLE_BROWSER_TTS`, `ENABLE_IMAGE_GENERATION`, `ENABLE_SIMULATIONS`,
`ENABLE_STUDY_SPACES`. (`ENABLE_REALTIME_VOICE` already exists for the stub voice module.)

## Next-pass recommendations
1. **Visual Intelligence Studio** — SVG/Mermaid/graph-JSON first (no paid image API), behind an image-provider abstraction; attach visuals to flow nodes via `linkedVisualAssetIds`.
2. **Complete Voice Room** — promote the stub `voice` module to persisted `VoiceSession`s + socket events, using the existing browser STT/TTS services; add "speak a goal → generate flow".
3. **Skill Twin** — fold flow progress + quiz mastery + weak areas into `learning-intelligence` as a learner graph that powers recommendations with an explainability drawer.
4. **Mistake OS** — turn quiz `QuestionResult`/`TopicScore.severity` into repair entries that spawn `weak_area_repair` flow nodes (the edge relation already exists).
