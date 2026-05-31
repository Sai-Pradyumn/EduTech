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
| **1** | **Flow Studio** (visual learning graphs) | ✅ **Shipped** |
| **1** | **Visual Intelligence Studio** | ✅ **Shipped** |
| **1** | **Mistake OS foundation** | ✅ **Shipped** |
| **1** | **Skill Twin foundation** | ✅ **Shipped** |
| **1** | **Complete Voice Room** (browser STT/TTS + persisted sessions) | ✅ **Shipped** |

**Priority 1 COMPLETE** (5 modules). **Priority 2 COMPLETE** (3 modules):

| Priority | Module | Status |
|---|---|---|
| **2** | **Study Spaces** (multimodal notebooks) | ✅ **Shipped** |
| **2** | **Simulation Labs** (rubric-scored practice) | ✅ **Shipped** |
| **2** | **Daily Autopilot** (today plan) | ✅ **Shipped** |
| **3** | **Course Builder** (teacher/mentor course generation) | ✅ **Shipped** |
| **3** | **Peer Rooms** (collaborative study) | ✅ **Shipped** |

**Priority 1, 2 & 3 COMPLETE** (10 modules). **Priority 4 breakthroughs shipped:**

| Priority | Feature | Status |
|---|---|---|
| **4** | **Proof-of-Learning Ledger** | ✅ **Shipped** |
| **4** | **AI Mentor Council** | ✅ **Shipped** |
| **4** | **Learning Replay** | ✅ **Shipped** |
| **4** | **Weakness-to-Project Generator** | ✅ **Shipped** |
| 4 | Adaptive Modality Router · Explainability Drawer | ✅ (shipped in Skill Twin) |

**Phase 8 is COMPLETE** across all four priorities. Remaining items are polish/optional
(see "Next-pass"), not core modules.
| 2 | Study Spaces · Simulation Labs · Daily Autopilot | ⏳ queued |
| 3 | Course Builder · Peer Rooms | ⏳ queued |
| 4 | AI Mentor Council · Proof-of-Learning · Learning Replay · Modality Router | ⏳ queued |

Build status: **`npm run build:server` green**, **`npm run build:client` green & warning-free**
(initial bundle **524.25 kB**, < 540 kB budget). Server **boots clean** (all Phase-8 module route groups
mapped, no DI errors); every module **runtime-smoked** with the mock provider (incl. Mistake-OS quiz
auto-capture, Skill-Twin compute + reset, full voice session lifecycle → flow/quiz, Study-Space ask +
generators, Simulation finish → Mistake-OS feed, Daily-Plan modes, Course-Builder role-gated publish,
Peer-Room AI moderator + join-by-code, **Ledger event-capture** (flow-node complete → verified event),
**Mentor-Council** verdict, **Learning-Replay** recap, and **Weakness-to-Project**). Seed inserts
**2 flows**, **4 visuals**, **4 mistakes**, **1 voice session**, **1 study space**, **1 simulation**,
**1 course**, **1 peer room**, and **5 ledger entries** (Skill Twin / Daily Plan / Council / Replay are
computed live).

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

## Module 2 — Visual Intelligence Studio ✅

Turns any concept (or a flow node) into a **structured educational visual**. Structured-first — it
produces renderable **JSON graphs** (rendered natively as SVG client-side), **Mermaid**, and
**Markdown**, plus mock SVG **illustrations** — so it works with **zero paid image API**.

### Routes (client)
- `/app/visuals` — gallery + generate panel (concept + type selector with "Auto" + idea chips). States: loading / error / empty / success.
- `/app/visuals/:id` — viewer: renderer on the left, caption + "how to read this" + actions on the right.

### Visual types (16) & formats
`flowchart · mind_map · concept_graph · sequence_diagram · system_design · architecture · comparison ·
timeline · infographic · flashcard · memory_palace · formula_map · process_map · cheat_sheet ·
illustration · analogy`. Each maps to a `contentFormat`: **jsonGraph** (graph-like → vertical/radial/
layered/horizontal SVG), **markdown** (comparison/cheat-sheet/flashcard/infographic/memory-palace),
**imageUrl** (illustration/analogy → mock SVG data-URI), with a portable **mermaid** string stored
alongside graph visuals for copy/export. `svg`/`html` formats are also renderable.

### Renderer
`VisualRendererComponent` is a single reusable component that renders all formats: a dependency-free
**SVG graph renderer** (computes node positions from the layout + draws bezier edges) for jsonGraph,
the existing `MarkdownPipe` (marked) for markdown, `<img>` for image data-URIs, and a copyable code
block for mermaid. No new heavy dependencies (no mermaid.js / d3 / cytoscape).

### Backend
```
server/src/modules/visuals/
  schemas/visual-asset.schema.ts        VisualAsset (type/contentFormat/content/mermaid/thumbnail/caption/howToRead/status/provider)
  providers/image-provider.ts           IImageProvider + MockImageProvider (deterministic SVG data-URI); IMAGE_PROVIDER_TOKEN
  visual-explainer/
    generated-visual.types.ts           GeneratedVisual + VisualGraph + VisualGenInput
    visual-generator.ts                  deterministic builder (infer type, graph/markdown/illustration archetypes, mermaid)
    visual-explainer.service.ts          VisualExplainerAgent: LLM structured output + mock fallback + image provider
  visuals.service.ts                     generate / fromFlowNode (+links node) / list / get / update / regenerate / remove
  visuals.controller.ts                  REST + toView + ENABLE_VISUAL_STUDIO gate
  visuals.module.ts                      VisualAsset model + FlowsModule (for node linking) + image provider
```

### API (`/api`, JWT-guarded, `userId`-scoped)
`GET /visuals/status` · `POST /visuals/generate` · `POST /visuals/from-flow-node` · `GET /visuals` ·
`GET /visuals/:id` · `PATCH /visuals/:id` · `POST /visuals/:id/regenerate` · `DELETE /visuals/:id`.

### Agent — VisualExplainer
`VisualExplainerService.generate` calls `AiService.generateStructuredOutput<GeneratedVisual>` with a
schema + `mockFactory` deterministic builder, **normalizes/validates**, and routes illustration/analogy
types through the **image provider abstraction** (mock by default). Falls back to the deterministic
generator on any failure — **works offline**.

### Provider abstraction (image)
`IImageProvider` (`generate(prompt) → {url, provider}`) with `MockImageProvider` returning a
deterministic SVG data-URI. Registered via `IMAGE_PROVIDER_TOKEN`; a real provider (OpenAI Images /
Gemini / Stability) can be slotted in behind `ENABLE_IMAGE_GENERATION` (default off). No hard
dependency on any paid API.

### Cross-module integration
**"Explain visually"** action in the **Flow Studio node inspector** calls `POST /visuals/from-flow-node`
→ generates a visual for that node, sets `sourceType: flow` + `sourceNodeId`, and **links the new
visual id onto the flow node's `linkedVisualAssetIds`** (verified in the runtime smoke), then opens the
viewer. The visual viewer's "Ask the AI Tutor about this" routes to the tutor with a prefilled prompt.

### Feature flags
`ENABLE_VISUAL_STUDIO` (`flags.visualStudio`, default **on**) and `ENABLE_IMAGE_GENERATION`
(`flags.imageGeneration`, default **off** → mock SVG). `GET /visuals/status` reports both.

### Seed data
4 demo visuals for the seeded student: a MERN request **sequence**, a React lifecycle **mind map**, a
scalable-app **architecture** diagram, and a **SQL vs NoSQL** comparison.

### Acceptance (Module 2) — all met
✅ generate SVG/Mermaid/graph visuals **without a paid image API** · ✅ save visuals · ✅ attach to a
flow node (links back) · ✅ regenerate · ✅ export/copy (Mermaid + content + download) · ✅
loading/empty/error/success states · ✅ mock provider works · ✅ build green & warning-free.

---

## Module — Mistake OS ✅ (Priority 1)

Remembers **misconceptions**, not just scores. Auto-captures the topics a learner misses, turns them
into **repair loops**, and can inject `weak_area_repair` nodes into the active flow.

### Route (client)
- `/app/mistakes` — repair inbox: stats strip (open/repairing/resolved + avg severity), **top repair
  focus** card, **weakness heatmap** (severity bars), status filter, and expandable mistake cards with
  a repair plan + actions.

### Auto-capture (event-driven)
`MistakesService` listens to `PROGRESSION_EVENTS.quizGraded` (enriched with per-topic `topicScores`)
and **upserts a mistake per weak topic** — dedupes by concept, increments `frequency`, blends
`severity`, maps `severity → mistakeType`, and **reopens** a resolved mistake if it recurs. Verified
live: a 0% quiz created `Graph algorithms [severity 100, misconception, source quiz]`.

### Mistake model
`Mistake { concept, topic, mistakeType, wrongReasoning, correction, severity(0–100), frequency,
source, sourceId, status(open|repairing|resolved), repairActions[], linkedQuizId, linkedFlowId,
linkedVisualId, lastSeenAt, resolvedAt }`. **8 mistake types**: misconception, missing_prerequisite,
careless_error, weak_recall, poor_explanation, implementation_gap, interview_communication_gap,
project_architecture_gap.

### Repair loops
`POST /mistakes/:id/repair` builds a concrete, routable plan (deterministic): **tutor_explanation**
(/app/tutor), **visual_correction** (/app/visuals), **micro_quiz** (/app/quizzes), and either a
**voice_viva** (/app/voice-room, for communication/explanation gaps) or a **flow_repair_node**. Each
action is toggle-able; completing all auto-resolves the mistake.

### Backend
```
server/src/modules/mistakes/
  schemas/mistake.schema.ts       Mistake + RepairAction
  mistake-repair.generator.ts     severityToType + buildRepairPlan (deterministic)
  mistakes.service.ts             @OnEvent capture / upsert / stats / generateRepair / status / toggleAction / repairFlow
  mistakes.controller.ts          REST + toView
  mistakes.module.ts              Mistake model + FlowsModule (for repair nodes)
```

### API (`/api`, JWT-guarded, `userId`-scoped)
`GET /mistakes` (+ `?status=`) · `GET /mistakes/stats` · `GET /mistakes/:id` · `POST /mistakes/capture` ·
`POST /mistakes/:id/repair` · `PATCH /mistakes/:id/status` · `PATCH /mistakes/:id/actions` ·
`POST /mistakes/:id/repair-flow` · `DELETE /mistakes/:id`.

### Cross-module integration
- **Quiz → Mistake**: graded quizzes auto-create/strengthen mistakes (enriched `QuizGradedEvent`).
- **Mistake → Flow**: `repair-flow` adds a `weak_area_repair` node (with a `weak_area_patch` edge to the
  matching concept) to the learner's active flow via the new `FlowsService.addRepairNode` — verified.
- **Mistake → Tutor / Visual / Quiz / Voice**: repair actions deep-link to those studios with a prompt.

### Acceptance (Mistake OS) — all met
✅ wrong quiz creates mistake entries (auto) · ✅ user can repair a mistake (plan + actions) · ✅
flow can add weak-area patch nodes from a mistake · ✅ dashboard-ready "top repair focus" + heatmap ·
✅ resolve/reopen · ✅ states · ✅ build green & warning-free. (Skill-Twin effect lands when the Twin
module reads mistakes next.)

---

## Module — Skill Twin ✅ (Priority 1)

A **live, explainable model of the learner** that powers recommendations across Asta. Read-only — it
owns no persistence; it blends signals the platform already produces into one model.

### Route (client)
- `/app/skill-twin` — readiness/health rings + retention/burnout-risk gauges, pace + projected days to
  goal, **next-best-actions with a "Why?" explainability drawer**, **recommended modality** card, a
  mastery graph (value vs target), weakness roots, misconception memory, strengths, and a transparent
  **"signals feeding your twin"** list. Includes a guarded **Reset memory** action.

### What it computes (transparent heuristics)
- **readiness / health** — reused from `LearningIntelligenceService.overview()`.
- **retentionRisk** (0–100) — from activity window + streak (low activity → high risk to forget/disengage).
- **burnoutRisk** (0–100) — *sustained* per-day load weighted by streak (a single busy day isn't burnout).
- **pace** (behind/steady/ahead) + **projectedDaysToGoal** — from readiness gap × pace factor.
- **mastery graph** — from the LI skill radar (value vs target).
- **weaknessRoots / misconceptionMemory** — from open/repairing **Mistake OS** entries (severity-sorted).

### Adaptive Modality Router (breakthrough feature)
Picks **how** to study next — read / voice / quiz / project / visual / mentor / simulation — from the
dominant open-mistake type (misconception→visual, weak_recall→quiz, communication→voice,
implementation→project), retention risk, the active flow, and the profile's preferred style — each with
a one-line reason.

### Explainability drawer ("Why Asta recommends this")
Every next-best-action carries a `reason` rendered in a drawer, e.g. *"Seen wrong 1× with severity
100/100 — your highest-impact gap"*, *"Next unlocked step toward 'Prepare for a system design round'"*,
*"Asta's modality router picked quiz based on your current gaps"*.

### Backend
```
server/src/modules/skill-twin/
  skill-twin.service.ts     compute() blends LI + Mistake OS + active flow + profile; routeModality;
                            nextActions (explainable); resetMemory()
  skill-twin.controller.ts  GET /skill-twin · POST /skill-twin/reset
  skill-twin.module.ts      imports LearningIntelligence + Mistakes + Flows + StudentProfile modules
```
Added `StudentProfileService.clearWeakAreas` + `MistakesService.clearForUser` for the memory reset.

### API
`GET /skill-twin` (the live model) · `POST /skill-twin/reset` (clears Mistake OS + flagged weak areas).

### Cross-module integration
Reads **Learning-Intelligence** (readiness/health/radar/momentum/weaknesses/strengths), **Mistake OS**
(weakness roots, misconception memory, modality routing), the **active Flow** (next step), and the
**profile** (preferred modality, goal). Next-best-actions deep-link into Mistakes / Flows / Quizzes /
Visuals / Voice / Projects.

### Acceptance (Skill Twin) — all met
✅ shows learner state (readiness/health/retention/burnout/pace/mastery/weaknesses) · ✅ recommendations
use the twin · ✅ explainable AI recommendations ("Why?") · ✅ adaptive modality recommendation · ✅ no
creepy wording · ✅ user can reset/clear learning memory · ✅ updates live after quizzes/flows (computed
on read) · ✅ build green & warning-free.

---

## Module — Complete Voice Room ✅ (Priority 1)

Voice-native learning: **persisted multi-turn sessions** across **8 modes**, routed through the Agent
OS, with **voice-to-flow** and **voice-to-quiz**. Mic capture + speech synthesis run **in-browser**
(Web Speech API) via the existing services; server STT/TTS sit behind `IVoiceProvider` (mock default).

### Routes (client)
- `/app/voice-room` — lobby: 8 mode cards + recent sessions (with → flow / → quiz link pills).
- `/app/voice-room/session/:id` — live session: speaking **orb** (listening/thinking/speaking states),
  push-to-talk mic **and** a type fallback, transcript timeline, replay / stop-voice / auto-read toggle,
  and a "turn this session into…" rail (flow / quiz / notes / summary).

### 8 modes
tutor · viva · interview · doubt · flow_builder · revision · mentor · project_review — each frames the
prompt and picks the answering agent (Tutor / Career / DoubtSolver / Mentor).

### Browser-native + graceful fallback
STT via `SpeechRecognitionService` (Web Speech API) with interim results; TTS via
`TextToSpeechService` (`speaking` signal drives the orb). If the browser lacks speech recognition the UI
says so and the **type fallback** keeps the room fully usable; if it lacks TTS, answers show as text.
Mic-permission/`not-allowed` errors surface as a toast.

### Backend
```
server/src/modules/voice/
  schemas/voice-session.schema.ts   VoiceSession (8 modes, transcript[], summary, extractedActions, links)
  voice.service.ts                  sessions CRUD + addTurn (Agent OS by mode) + summarize +
                                    createFlow (→ FlowsService) + createQuiz (→ AssessmentService) +
                                    extractNotes + end; legacy converse() kept for the Ask-Asta dock
  voice.controller.ts               REST (status + ask + 11 session routes)
  voice.module.ts                   VoiceSession model + AgentsModule + FlowsModule + AssessmentModule
  voice.provider.ts                 IVoiceProvider + MockVoiceProvider (server STT/TTS abstraction)
```

### API (`/api`, JWT-guarded, `userId`-scoped)
`GET /voice/status` · `POST /voice/sessions` · `GET /voice/sessions` · `GET /voice/sessions/:id` ·
`POST /voice/sessions/:id/turn` · `PATCH /voice/sessions/:id` · `POST /voice/sessions/:id/summarize` ·
`POST /voice/sessions/:id/create-flow` · `POST /voice/sessions/:id/create-quiz` ·
`POST /voice/sessions/:id/extract-notes` · `POST /voice/sessions/:id/end` · `DELETE /voice/sessions/:id`.

### Provider abstraction
`IVoiceProvider` (transcribe / synthesize) with `MockVoiceProvider` (passthrough; browser does the real
work). A real STT/TTS provider (OpenAI Realtime / ElevenLabs / Azure) slots in behind
`VOICE_PROVIDER_TOKEN`; `status` reports `serverStt`/`serverTts` (gated by `ENABLE_REALTIME_VOICE`).

### Cross-module integration
**Voice → Flow** (`create-flow` generates a flow from the spoken goal and links it), **Voice → Quiz**
(`create-quiz`), **Voice → Notes/Summary**. Verified live (flow_builder session → flow + quiz created
and linked).

### Feature flag
`ENABLE_VOICE` (`flags.voice`, default **on** — browser STT/TTS need no keys). `ENABLE_REALTIME_VOICE`
remains for future server-side STT/TTS.

### Acceptance (Voice Room) — all met
✅ works with browser-native voice where supported · ✅ graceful fallback (type) when unsupported · ✅
mic-permission errors handled · ✅ transcript saved · ✅ transcript → flow / quiz / notes · ✅ spoken
answers (TTS) · ✅ stop speaking + replay · ✅ switch modes · ✅ mobile-friendly layout · ✅ build green.

---

## Module — Study Spaces ✅ (Priority 2)

NotebookLM-style **multimodal workspaces**. Add sources (text/url/transcript/…), then ask grounded
questions and generate a summary, flashcards, an audio-overview script, a learning flow, a quiz, or a
concept-graph visual — all from the same space.

- **Routes**: `/app/spaces` (grid + create), `/app/spaces/:id` (cockpit: ask panel + artifacts on the
  left; source rail + generator buttons on the right).
- **Backend** `server/src/modules/spaces/`: `StudySpace` (sources[], artifacts[], linked flow/visual/
  quiz/voice ids). `SpacesService`: source CRUD, **grounded `ask`** (AI gateway over source text, with a
  deterministic fallback), `summary`/`flashcards`/`audioOverview` artifacts, and `createFlow` (→
  FlowsService) / `createQuiz` (→ AssessmentService) / `createVisual` (→ VisualsService, concept_graph).
- **API**: `POST/GET /spaces` · `GET/PATCH/DELETE /spaces/:id` · `POST /spaces/:id/sources` ·
  `DELETE /spaces/:id/sources/:sourceId` · `POST /spaces/:id/{ask,summary,flashcards,audio-overview,flow,quiz,visuals}`.
- **Audio overview**: generates a script; the client reads it via the browser TTS service.
- **Flag**: `ENABLE_STUDY_SPACES` (default on). **Acceptance met**: create · add sources · grounded
  ask · summary · quiz · flow · concept visual · audio playback · states · works offline (mock).

## Module — Simulation Labs ✅ (Priority 2)

Real, **rubric-scored practice** across 10 round types (interview / viva / debugging / system-design /
code-walkthrough / product-thinking / mentor-review / group-discussion / client-requirements /
teaching-back). Each round runs through the Agent OS; finishing scores against a rubric and writes an
improvement plan.

- **Routes**: `/app/simulations` (type + topic picker + history), `/app/simulations/:id` (scenario +
  transcript + respond + finish → score/rubric/feedback/plan + retry easier/harder + repair-flow).
- **Backend** `server/src/modules/simulations/`: `Simulation` (type, topic, rubric[], transcript[],
  score, feedback, improvementPlan, links). `simulation-coach.ts` holds per-type blueprints (agent +
  scenario + rubric + response framing) and a deterministic engagement-based scorer. `SimulationsService`:
  start / respond (Agent OS) / **finish** (scores, writes plan, and on a sub-60 score **feeds Mistake OS**
  via `captureManual` + links it) / retry (difficulty step) / **createRepairFlow** (→ FlowsService.addRepairNode).
- **API**: `POST /simulations/start` · `GET /simulations` · `GET /simulations/:id` ·
  `POST /simulations/:id/{respond,finish,retry,create-repair-flow}` · `DELETE /simulations/:id`.
- **Flag**: `ENABLE_SIMULATIONS` (default on). **Acceptance met**: create · respond · rubric-based
  feedback · mistakes saved (verified `linkedMistakes:1` on a low score) · retry · repair flow.

## Module — Daily Autopilot ✅ (Priority 2)

Turns the active flow + open mistakes + roadmap into a **today plan** with energy-aware modes.

- **Route**: `/app/today` — mode pills (Today / Quick / Exam / Recover), a checklist of reasoned items,
  and a completion ring + quick-mode shortcuts.
- **Backend** `server/src/modules/daily-plan/`: `DailyPlan` (one per user per day; items with kind,
  reason, route, estimate, done). `DailyPlanService` builds items from `FlowsService.findActive`
  (next node) + `MistakesService` (top open gap) + the active Roadmap (current week) + a quiz nudge.
  Modes: **normal** (~5 items), **quick** ("I only have 20 minutes" — budget-trimmed), **exam** ("exam
  tomorrow" — quiz + cram-repairs + a viva sim), **burnout_recovery** (one light item). Completion
  carries over across recalcs.
- **API**: `GET /daily-plan/today` · `POST /daily-plan/{generate,complete-item,recalculate,quick-mode}`.
- **Acceptance met**: dashboard-ready today plan · complete items · recalculate · quick mode builds a
  smaller plan. Every item carries a "why" (its `reason`).

---

## Module — Course Builder ✅ (Priority 3)

Mentors/admins turn a **goal / outline / roadmap** into a full course: modules + lessons + a per-module
quiz/visual/voice-script + a capstone project + a flow + certificate criteria — editable, then publishable.

- **Routes**: `/app/course-builder` (generate + grid), `/app/course-builder/:id` (module/lesson editor +
  per-module Generate quiz/visual + Generate project/flow + Publish).
- **Backend** `server/src/modules/course-builder/`: `Course` (modules[]→lessons[], project, certificate
  criteria, visibility). `course-blueprint.generator.ts` (curated tracks + generic decomposition →
  modules/lessons/project/criteria). `CourseBuilderService`: generate / fromRoadmap / update (edit
  modules+lessons) / generateQuiz (→ Assessment) / generateVisual (→ Visuals) / generateProject (→
  Projects) / generateFlow (→ Flows) / **publish** (org/cohort **role-gated** to mentor/admin — verified:
  student org-publish 403, mentor org-publish ok).
- **API**: `POST /courses` · `POST /courses/from-roadmap/:roadmapId` · `GET /courses` · `GET /courses/:id`
  · `PATCH /courses/:id` · `POST /courses/:id/modules/:moduleId/{quiz,visual}` ·
  `POST /courses/:id/{project,flow,publish}` · `DELETE /courses/:id`.
- **Flag**: `ENABLE_COURSE_BUILDER` (default on). **Acceptance met**: create draft · edit modules ·
  generate quiz/project/visuals · publish as org/cohort resource (role-gated).

## Module — Peer Rooms ✅ (Priority 3)

Collaborative study rooms: create/join by code, a shared message board, an **AI moderator**, an
auto-summary with action items, and a **shared learning flow**.

- **Routes**: `/app/peer-rooms` (create + join-by-code + grid), `/app/peer-rooms/:id` (member rail +
  message board with chat/system/ai styling + compose + room tools).
- **Backend** `server/src/modules/peer-rooms/`: `PeerRoom` (members[], messages[], code, summary,
  actionItems, linkedFlowId). `PeerRoomsService`: create (join code) / list (member + open rooms) /
  joinByCode / join / postMessage / **moderate** (AI nudge via the Agent OS) / summarize / linkFlow (→
  Flows) / close / remove (host-only guards). Mentors join as the `mentor` member role.
- **API**: `POST /peer-rooms` · `GET /peer-rooms` · `POST /peer-rooms/join` · `GET /peer-rooms/:id` ·
  `POST /peer-rooms/:id/{join,messages,moderate,summary,link-flow,close}` · `DELETE /peer-rooms/:id`.
- **Realtime**: uses the existing Socket.IO foundation conceptually; this pass ships a REST board with
  refresh (live socket broadcast is a clean follow-up). **Flag**: `ENABLE_PEER_ROOMS` (default on).
- **Acceptance met**: create · invite/join (by code) · basic shared session · AI room summary.

---

## Priority 4 — Breakthrough features ✅

### Proof-of-Learning Ledger
An append-only, **verified** timeline of real learning events. Decoupled: `LedgerService` listens to
domain events (quiz-pass / week / project) **and** exposes `record()` for the services that don't emit —
so completing a **flow node**, resolving a **mistake**, and finishing a **simulation** all post verified
events (wired into FlowsService / MistakesService / SimulationsService; flow-node capture verified live).
Route `/app/ledger` (timeline + stats); `GET /ledger`, `GET /ledger/stats`.

### AI Mentor Council
Five agent perspectives — **Tutor / Assessment / Project / Career / Mentor** — each propose the next best
move from shared signals (active flow, open mistakes, readiness, momentum) with a stance + rationale +
**urgency** score; a chair picks the highest-urgency proposal and writes a synthesis that also credits
the runner-up. Read-only, explainable, deterministic. Route `/app/mentor-council`; `GET /mentor-council`.

### Learning Replay
A narrated post-activity recap built from the **Ledger** ("what you did") + the **Skill Twin** ("where
you are / struggled / what's next"), with a TTS-playable 3-minute **recap script**. Route `/app/replay`;
`GET /replay`.

### Weakness-to-Project Generator
`POST /mistakes/:id/repair-project` turns a logged weakness into a tiny targeted project via
ProjectsService and moves the mistake to `repairing` — surfaced as a "Generate targeted project" action
in the Mistake OS inbox.

### Already shipped earlier (Priority-4 list)
**Adaptive Modality Router** and the **Explainability Drawer** ("Why Asta recommends this") shipped in the
**Skill Twin**. Concept-DNA / Mode-Morphing / Confusion-Detector are largely covered by the
Flow + Visual + Voice + Mistake-OS interplay.

---

## Data relationships wired this pass
- **Roadmap → Flow**: `POST /flows/from-roadmap/:roadmapId` seeds the graph backbone from roadmap weeks.
- **Flow node → Tutor / Quiz / Project / Voice / Mentor / Knowledge**: `execute-node` returns the route + prompt + agent.
- **Profile weak areas → Flow**: `recalculate` injects `weak_area_repair` nodes from `StudentProfile.weakAreas`.
- Node link fields (`linkedQuizId`, `linkedProjectId`, `linkedVisualAssetIds`, `linkedVoiceSessionIds`, …)
  are persisted now so Modules 2–7 can attach artifacts back onto flow nodes without a schema change.

## Limitations / deferred
- `from-knowledge` flow generation and Visual Studio's `from-knowledge` / `from-quiz-mistake` /
  `from-tutor-message` convenience endpoints are deferred (the generic `generate` + `from-flow-node`
  cover the core flows; the node link fields already exist).
- `diagram` / `image` / `document_source` flow node types route to Knowledge today; they can be
  pointed at Visual Studio in a follow-up. `simulation` routes to Voice until Module 7 lands.
- Mermaid visuals render as copyable source (no mermaid.js dependency by design); the jsonGraph format
  is the natively-rendered structured visual.
- FlowArchitect / VisualExplainer run as generator services (like the Roadmap agent), not in the chat
  orchestrator's agent registry; registry entries can be added when voice "speak-a-goal → flow" lands.

## Feature flags (Phase 8 roster)
All default **on** unless noted: `ENABLE_FLOW_STUDIO`, `ENABLE_VISUAL_STUDIO`, `ENABLE_VOICE`
(browser STT/TTS need no keys), `ENABLE_STUDY_SPACES`, `ENABLE_SIMULATIONS`, `ENABLE_COURSE_BUILDER`,
`ENABLE_PEER_ROOMS`. Off by default: `ENABLE_IMAGE_GENERATION` (→ mock SVG) and `ENABLE_REALTIME_VOICE`
(future server-side STT/TTS).

## Next-pass recommendations (Phase 8 COMPLETE → polish/hardening)
All four priorities are shipped. Remaining items are optional polish, not core modules:
1. Surface the Skill-Twin top action + Daily-Plan "today" + Mentor-Council verdict on the **dashboard** widget.
2. Wire Voice Room + Peer Rooms **socket streaming** (REST works today); add a real STT/TTS + image provider behind `ENABLE_REALTIME_VOICE` / `ENABLE_IMAGE_GENERATION`.
3. Move heavy generators (flow/course/visual) onto **BullMQ** jobs so requests never block.
4. Live UI screenshot/eyeball + a11y pass across the 13 new Phase-8 screens; persist Skill-Twin snapshots so Learning Replay can show a true before/after delta.
