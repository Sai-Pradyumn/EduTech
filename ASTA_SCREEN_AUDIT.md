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
| `/u/:username` | PublicPassportComponent | **Public Skill Passport** — verifiable, privacy-respecting (Phase 9) | ✅ | `GET /skill-passport/public/:username` |
| `/p/:username` | PublicPortfolioComponent | **Public Portfolio** — verifiable, privacy-respecting (Phase 9) | ✅ | `GET /portfolio/public/:username` |
| `/login`, `/register` | Login/Register | Auth | ➖ | `/auth/*` |
| `/onboarding` | OnboardingComponent | 7-step + cinematic generate | ➖ | `/student-profile`, `/roadmap` |

## Student app (`/app/*`) — warm brand-green identity
| Route | Component | Metaphor / pattern | Rebuild | Backend |
|---|---|---|---|---|
| `dashboard` | DashboardComponent | **Mission Control** (hero · ribbon · mastery rings · learning river · signal timeline) | ✅ | profile, roadmap, intelligence |
| `tutor` | TutorWorkspaceComponent | **Cognitive Studio** (canvas + agent rail; visual blocks) | 🎯 | Agent OS (socket), RAG |
| `mentor-room` `doubt-solver` `career-coach` `content-studio` | AgentWorkspaceComponent | Agent Orbit rail + visual blocks | 🎯 | Agent OS stream |
| `voice-room` / `voice-room/session/:id` | VoiceRoomComponent | **Voice Room** — 8 modes, browser STT/TTS, speaking orb, persisted sessions, voice→flow/quiz (Phase 8) | ✅ | `/voice/sessions/*` |
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
| `today` | TodayComponent | **Daily Autopilot** — today plan (quick/exam/burnout modes) from flow+mistakes+roadmap (Phase 8) | ✅ | `/daily-plan/*` |
| `spaces` / `spaces/:id` | Spaces{List,Detail} | **Study Spaces** — multimodal notebooks: sources, grounded ask, generators (Phase 8) | ✅ | `/spaces/*` |
| `simulations` / `simulations/:id` | Simulations{List,Detail} | **Simulation Labs** — rubric-scored rounds (Phase 8) | ✅ | `/simulations/*` |
| `course-builder` / `course-builder/:id` | Course{List,Detail} | **Course Builder** — generate + edit + publish courses (Phase 8) | ✅ | `/courses/*` |
| `peer-rooms` / `peer-rooms/:id` | PeerRooms{List,Detail} | **Peer Rooms** — collaborative study + AI moderator (Phase 8) | ✅ | `/peer-rooms/*` |
| `mentor-council` | MentorCouncilComponent | **AI Mentor Council** — 5 agents debate → chair verdict (Phase 8) | ✅ | `/mentor-council` |
| `ledger` | LedgerComponent | **Proof-of-Learning** — verified event timeline (Phase 8) | ✅ | `/ledger` |
| `replay` | ReplayComponent | **Learning Replay** — narrated recap + TTS (Phase 8) | ✅ | `/replay` |
| `skill-passport` | SkillPassportComponent | **Skill Passport** — verified profile: skill graph, proof, projects, timeline, privacy (Phase 9) | ✅ | `/skill-passport/*` |
| `skill-passport/public-preview` | PublicPassportComponent | Public preview of own passport (Phase 9) | ✅ | `/skill-passport/me` |
| `career-readiness` | CareerReadinessComponent | **Career Readiness** — role rubric, explainable 5-dim score, gaps, 7-day plan (Phase 9) | ✅ | `/career-readiness/*` |
| `outcome-council` | OutcomeCouncilComponent | **AI Outcome Council** — 6 perspectives → ranked verdict (Phase 9) | ✅ | `/outcome-council/*` |
| `portfolio` | PortfolioComponent | **Portfolio Builder** — generated from evidence, publish, public link (Phase 9) | ✅ | `/portfolio/*` |
| `interview` | InterviewComponent | **Interview OS** — mock interviews, scored Q&A, report (Phase 9) | ✅ | `/interview/*` |
| `resume` | ResumeComponent | **Resume** — generated from evidence, copy markdown (Phase 9) | ✅ | `/resume/*` |
| `applications` | ApplicationsComponent | **Applications** — JD match analyzer + tracker (Phase 9) | ✅ | `/applications/*` |
| `mentors` | MentorsComponent | **Mentor Marketplace** — browse, request reviews, become a mentor (Phase 9) | ✅ | `/mentors/*`, `/mentor-sessions` |
| `marketplace` | MarketplaceComponent | **Template Marketplace** — browse + clone (Phase 9) | ✅ | `/marketplace/*` |
| `creator-studio` | CreatorStudioComponent | **Creator Studio** — author templates + admin moderation (Phase 9) | ✅ | `/marketplace/templates/*` |
| `institution` | InstitutionComponent | **Institution** — cohort outcome analytics (Phase 9, admin/mentor) | ✅ | `/institution/*` |
| `privacy` | PrivacyComponent | **Data & Privacy** — export, make-private, reset (Phase 9) | ✅ | `/privacy/*` |
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

## Phase 10 — Platform / SaaS screens
| Route | Component | Purpose | Backend |
|---|---|---|---|
| `/app/billing` | BillingComponent | Plan + status + cancel, plan-limit meters, AI cost-by-feature, 5-plan grid, invoices | `/billing/*`, `/entitlements/me` |
| `/app/offline` | OfflineComponent | Connection state, offline resources, drafts, sync queue, web-push opt-in | `/push/*` + IndexedDB |
| `/app/integrations` | IntegrationsComponent | Connect mock/manual/export connectors + `.ics` export | `/integrations/*` |
| `/app/developer` | DeveloperComponent | API keys (shown once) + webhooks (test + delivery log) | `/developer/*` |
| `/app/security` | SecurityComponent | Active sessions / devices, revoke, sign-out-everywhere | `/auth/sessions`, `/auth/logout-all` |
| `/app/data` | DataGovernanceComponent | Export my data + request deletion (tracked jobs) | `/data/*` |
| `/app/org/branding` | OrgBrandingComponent | Org white-label branding + live certificate preview | `/org/branding` |
| `/admin/billing` | AdminBillingComponent | MRR, plan distribution, account roster | `/billing/admin/*` |
| `/admin/ai-ops` | AdminAiOpsComponent | AI cost/latency/error, provider health, top spenders | `/admin/ai-ops/*` |
| `/admin/ops` | AdminOpsComponent | Health, job ledger (retry), error feed | `/ops/*` |
| `/admin/product-analytics` | AdminProductAnalyticsComponent | DAU/WAU, funnels, event volume | `/admin/product-analytics/*` |
| `/admin/audit-logs` | AdminAuditLogsComponent | Security action trail | `/admin/audit-logs` |
| `/admin/feature-flags` | AdminFeatureFlagsComponent | Runtime flag toggles + AI kill-switches | `/admin/feature-flags` |

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
