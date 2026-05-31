# Asta — Screen Audit & Synapse Rebuild Inventory

Audited 2026-05-30. The product is **feature-complete & verified** (Phase 1–4,
A1–A9 + B1–B17, experience U1–U7, polish Phase 5, voice activation — see
`docs/` + project memory). This audit is the **Synapse-rebuild map**: which
metaphor each screen adopts and its rebuild status. Functionality is wired to
real backends unless noted.

Legend — Rebuild: ✅ done · 🎯 next priority · ⏳ queued · ➖ keep (no metaphor change).

## Public
| Route | Component | Metaphor / pattern | Rebuild | Backend |
|---|---|---|---|---|
| `/` | LandingComponent | Cinematic landing (U1, faithful design port) | ➖ | — |
| `/pricing` | PricingComponent | Plans (public) | ⏳ | `GET /billing/plans` |
| `/certificate/verify/:id` | CertVerifyComponent | Public verify | ➖ | `GET /certificates/verify/:id` |
| `/login`, `/register` | Login/Register | Auth | ➖ | `/auth/*` |
| `/onboarding` | OnboardingComponent | 7-step + cinematic generate | ➖ | `/student-profile`, `/roadmap` |

## Student app (`/app/*`) — warm brand-green identity
| Route | Component | Metaphor / pattern | Rebuild | Backend |
|---|---|---|---|---|
| `dashboard` | DashboardComponent | **Mission Control** (hero · ribbon · mastery rings · learning river · signal timeline) | ✅ | profile, roadmap, intelligence |
| `tutor` | TutorWorkspaceComponent | **Cognitive Studio** (canvas + agent rail; visual blocks) | 🎯 | Agent OS (socket), RAG |
| `mentor-room` `doubt-solver` `career-coach` `content-studio` | AgentWorkspaceComponent | Agent Orbit rail + visual blocks | 🎯 | Agent OS stream |
| `voice-room` | VoiceRoomComponent | **Voice Chamber** (living orb exists) | ⏳ | `/voice` (flag) |
| `workflows` | WorkflowsComponent | **Agent Swarm Map** | ⏳ | `/agent-graph` (flag) |
| `roadmap` / `roadmap/:id` / `roadmap/generate` | Roadmap{List,Details,Generate} | **Learning Path Galaxy** (learning river + constellation) | 🎯 | `/roadmap/*` |
| `flows` / `flows/new` | FlowsListComponent | **Flow Studio** home — generate panel + flow gallery (Phase 8) | ✅ | `/flows` |
| `flows/:id` | FlowDetailComponent | **Flow Studio cockpit** — SVG dependency graph (pan/zoom/drag), inspector, Map/Timeline/Focus/Weakness/Project views (Phase 8) | ✅ | `/flows/:id` |
| `visuals` | VisualsListComponent | **Visual Studio** — gallery + generate panel (Phase 8) | ✅ | `/visuals` |
| `visuals/:id` | VisualDetailComponent | **Visual viewer** — SVG/Mermaid/Markdown renderer + caption/how-to-read + copy/export/regenerate (Phase 8) | ✅ | `/visuals/:id` |
| `knowledge` | KnowledgeHubComponent | **Knowledge Vault** (shards + retrieval confidence) | 🎯 | `/knowledge/*` |
| `quizzes` | QuizStudioComponent | **Mastery Arena** (focus Q + mastery rings) | 🎯 | `/assessment/*` |
| `projects` | ProjectStudioComponent | **Project Forge** (blueprint + journey + AI review) | ⏳ | `/projects/*` |
| `progress` | IntelligenceCockpitComponent | **Skill Observatory** (radar/heatmap/momentum + rings) | 🎯 | `/intelligence/overview` |
| `mistakes` | MistakesComponent | **Mistake OS** — repair inbox: stats, top focus, weakness heatmap, repair loops (Phase 8) | ✅ | `/mistakes` |
| `skill-twin` | SkillTwinComponent | **Skill Twin** — live learner model: readiness/risk gauges, mastery graph, modality router, explainable next-best-actions (Phase 8) | ✅ | `/skill-twin` |
| `cohorts` | CohortsComponent | Leaderboard + announcements (signal timeline) | ⏳ | `/cohorts/*` |
| `live-sessions` | LiveSessionsComponent | Session + recap | ⏳ | `/live-sessions/*` |
| `community` | CommunityComponent | Channels + threads | ⏳ | `/community/*` |
| `reports` | ReportsComponent | **Observatory** (`.asta-observatory`) + CSV | ⏳ | `/reports/*` |
| `founder` | FounderDashboardComponent | **Observatory** (cool) | ⏳ | `/founder/overview` |
| `certificates` | CertificatesComponent | Achievement Ledger | ⏳ | `/certificates/*` |
| `billing` | BillingComponent | Usage Command Center (gauge) | ⏳ | `/billing/*` |
| `mentor` | MentorWorkspaceComponent | Mentor Compass | ⏳ | `/mentor/*` |
| `org` | OrgAdminComponent | Workspace admin | ⏳ | `/organizations/*` |
| `platform` | PlatformOrgsComponent | Platform observatory | ⏳ | `/platform/*` |
| `profile` | ProfileComponent | **Personal AI Core** (+ voice settings) | ⏳ | `/student-profile`, theme/voice |

## Admin app (`/admin/*`) — cool observatory identity (`.asta-observatory`)
| Route | Component | Metaphor / pattern | Rebuild | Backend |
|---|---|---|---|---|
| `` / `analytics` | AdminAnalyticsComponent | **Platform Observatory** (agent usage) | 🎯 | `/admin/analytics` |
| `students` | AdminStudentsComponent | Student Intelligence Observatory | 🎯 | `/admin/students` |
| `documents` `roadmaps` `assessments` | Admin{Documents,Roadmaps,Assessments} | Observatory browsers (donut/bar + table) | ⏳ | `GET /admin/{…}` |
| `fine-tuning` | FineTuningComponent | LoRA jobs (poll) | ⏳ | `/fine-tuning` (flag) |

## Global / shell
| Area | Component | Notes |
|---|---|---|
| Shell | ShellComponent | Scroll-split ✅, ambient bg ✅, bottom-nav ✅, skip-link ✅ |
| Ask Asta dock | AiDockComponent | Streaming + TTS; sits above bottom-nav ✅ |
| Voice overlay | AstaVoiceOverlayComponent | "Hey Asta" global layer ✅ (⌘/Ctrl+⇧+A) |
| Command palette | CommandPaletteComponent | Global ⌘K ✅ |

## Bugs / pending found this pass
- **No placeholder routes remain** — every route loads a real feature component (the `placeholder()` factory is unused; safe to remove later).
- **No mock/TODO/FIXME design debt** — prior polish phase killed the 3 `🧱` values; only flag-gated features (voice/fine-tuning/agent-graph) ship disabled by design.
- Pre-Synapse screens use the brand card system (correct, but not yet metaphor-driven). Migration tracked in `TODO_FIXED_OR_REMAINING.md`.
- Initial-bundle budget raised 500→540 kB to absorb the intentional global Synapse CSS (build warning-free).
