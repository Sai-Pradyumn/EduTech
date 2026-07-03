## Bugs
| ID | Screen | Severity | Effort | One-line |
|---|---|---|---|---|
| CORE-BUG-001 | App shell/Auth | P1 | S | App initializer clears the local session on any `/auth/me` 403 without a visible recovery path. |
| CORE-BUG-002 | Offline & Sync | P1 | M | Offline sync uses raw `fetch`, bypassing refresh/error interceptors and leaving queued work stuck after token expiry. |
| CORE-BUG-003 | Sidebar routes | P1 | S | Dashboard links to `/app/courses`, but the router exposes `/app/course-builder`. |
| SOCKET-BUG-001 | AI Tutor/Agent screens | P1 | M | One shared socket plus one in-flight server stream can reject concurrent AI sends across screens/tabs. |
| DASH-BUG-001 | Dashboard | P1 | M | Dashboard roadmap task completion refreshes only part of the dependent learning surface. |
| ROAD-BUG-001 | Roadmap | P1 | M | Task completion does not change roadmap progress percentage until whole weeks are completed. |
| ROAD-BUG-002 | Roadmap | P1 | M | Roadmap mutations do not invalidate Today plans that were already generated. |
| AGENT-BUG-001 | AI Tutor/Agent screens | P1 | M | Changing between agent screens destroys the current unsaved chat session. |
| AGENT-BUG-002 | AI Tutor | P1 | M | Editing and regenerating a prior user message drops later turns locally without a backend branch/restore path. |
| PEER-BUG-001 | Peer Rooms | P1 | M | Room messages are fetched once and then only local sends update the thread, so other participants are invisible until reload. |
| KNOW-BUG-001 | Knowledge | P1 | S | User-supplied Knowledge document IDs can be cast to ObjectId in vector filtering without validation. |
| VISUAL-BUG-001 | Visual Studio | P1 | M | Generated visual content is trusted with sanitizer bypass for SVG/URL rendering. |
| VOICE-BUG-001 | Voice Room | P1 | S | Failed voice turns leave the optimistic user transcript in the local session. |
| COMM-BUG-001 | Community | P1 | M | Community is visible in Learn nav but the backend requires org view permission. |
| COHORT-BUG-001 | Cohorts | P1 | S | Cohorts is visible in Learn nav but the backend requires cohort permissions. |
| LIVE-BUG-001 | Live Sessions | P1 | S | Live Sessions is visible in Learn nav but the backend requires cohort permissions. |
| INST-BUG-001 | Institution | P1 | S | Institution is visible in Ecosystem nav but the backend allows only admin/mentor roles. |
| DEV-BUG-001 | Developer | P1 | S | Developer is visible in Account nav but the backend requires org manage permission. |
| DEV-BUG-002 | Developer | P1 | S | Malformed webhook/API-key identifiers can throw ObjectId cast errors instead of controlled 400/404 responses. |
| SEC-BUG-001 | Security | P1 | S | Malformed session revoke IDs can throw ObjectId cast errors. |
| MENTOR-BUG-001 | Mentors | P1 | M | Hidden mentor profiles can still appear in marketplace discovery. |
| MENTOR-BUG-002 | Mentors | P1 | S | Mentor session requests do not prevent duplicate pending requests or self-booking. |
| BILL-BUG-001 | Billing | P1 | M | Billing checkout/change/cancel flows are wired to a mock payment provider while UI presents real purchase actions. |
| PRIV-BUG-001 | Data & Privacy | P1 | M | Privacy destructive actions do not invalidate dependent portfolio/applications/passport screens. |
| PORT-BUG-001 | Portfolio | P2 | S | Public portfolio load errors are shown as "not published" even when the API/network failed. |
| INTEG-BUG-001 | Integrations | P1 | M | Calendar `.ics` downloads are tokenized through a query URL instead of the normal authenticated client flow. |
| PASSPORT-BUG-001 | Skill Passport | P1 | S | Malformed evidence IDs can throw ObjectId cast errors. |
| CERT-BUG-001 | Certificates | P2 | S | Certificate revoke is protected by the issue permission instead of a distinct revoke permission. |
| CERT-BUG-002 | Certificates | P2 | S | Public certificate verification shows API failures as invalid/revoked certificates. |
| MARKET-BUG-001 | Marketplace | P1 | M | "Use template" increments usage and returns routing hints but does not create a usable copied asset. |
| ADMIN-BUG-001 | Admin | P1 | S | Admin nav exposure is broader than backend admin/permission guards, causing preventable unauthorized transitions. |

## Missing fixes
| ID | Screen | Severity | Effort | One-line |
|---|---|---|---|---|
| HIST-MF-001 | Asta History | P1 | S | History list/search errors only stop spinners, leaving blank tabs with no explanation. |
| CORE-MF-001 | App shell/Error handling | P1 | M | GET failures are intentionally not globally toasted, but many screens do not handle them inline. |
| TUTOR-MF-001 | AI Tutor | P1 | S | Tutor history failures are swallowed, so the History tab can render empty. |
| AGENT-MF-001 | AI Tutor/Agent screens | P2 | S | Feedback submission errors are not surfaced. |
| DASH-MF-001 | Dashboard | P1 | M | Dashboard secondary cards swallow API failures and continue with stale/empty content. |
| TODAY-MF-001 | Today | P1 | M | Today streak/history failures are swallowed. |
| RES-MF-001 | Resources | P1 | S | Recommended/library/catalog resource failures are hidden or shown as empty data. |
| QUIZ-MF-001 | Quizzes | P1 | S | Quiz documents, attempts and history errors are hidden. |
| PROJ-MF-001 | Projects | P1 | S | Project list/stats/task mutations miss local error handling. |
| COURSE-MF-001 | Course Builder | P1 | M | Generated flows do not invalidate Roadmap/Flow Studio dependent state. |
| FLOW-MF-001 | Flow Studio | P1 | M | Flow node completion updates the flow locally but not Today/Dashboard/Passport dependents. |
| SIM-MF-001 | Simulations | P2 | M | Simulation completion does not invalidate Today/Roadmap/Passport views. |
| VOICE-MF-001 | Voice Room | P2 | M | Voice practice relies on mock synthesis/transcription provider behavior. |
| VOICE-MF-002 | Voice Room | P1 | S | Voice session list/detail failures clear loading without visible error states. |
| VISUAL-MF-001 | Visual Studio | P2 | M | Visual generation relies on mock image provider behavior. |
| VISUAL-MF-002 | Visual Studio | P2 | S | Visual provider-status failures are ignored. |
| WORKFLOW-MF-001 | Workflows | P1 | S | Workflow status/graph loading failures collapse to disabled or empty state. |
| KNOW-MF-001 | Knowledge | P2 | S | Knowledge Q&A history save/clear failures are best-effort and hidden. |
| MISTAKE-MF-001 | Mistakes | P1 | S | Due-review queue failures do not mark the screen as failed. |
| MISTAKE-MF-002 | Mistakes | P2 | S | Repair action toggle failures are swallowed. |
| CAREER-MF-001 | Career Readiness | P1 | S | Career role loading failure is converted to empty data. |
| INTERVIEW-MF-001 | Interview OS | P1 | S | Interview type/archetype/session failures are hidden. |
| APP-MF-001 | Applications | P1 | S | Application list failure only clears loading. |
| RESUME-MF-001 | Resume | P2 | S | Resume PDF export has no rejection handler. |
| PORT-MF-001 | Portfolio | P2 | S | Portfolio public-setting saves fail with a toast but no busy/rollback/last-good treatment. |
| MENTOR-MF-001 | Mentors | P1 | S | Mentor discovery/session/profile load failures render as empty or partial screens. |
| CREATOR-MF-001 | Creator Studio | P1 | S | Creator Studio mine/pending load failures are swallowed. |
| BILL-MF-001 | Billing | P1 | S | Billing plans/subscription/usage/transactions/entitlements load failures are swallowed. |
| OFFLINE-MF-001 | Offline & Sync | P1 | M | Offline copy promises drafting/sync for work the queue does not model. |
| INTEG-MF-001 | Integrations | P1 | S | Integration list/connect/disconnect failures are hidden or only clear busy. |
| DATA-MF-001 | Your Data | P1 | S | Data export job loading failures are hidden. |
| PRIV-MF-001 | Data & Privacy | P1 | S | Privacy settings load failures are hidden. |
| SECURITY-MF-001 | Security | P1 | S | Security session loading failures are hidden. |
| NOTIF-MF-001 | Notifications | P2 | S | Notification read-state mutations are optimistic with no failure rollback. |
| ADMIN-MF-001 | Admin | P1 | S | Admin analytics/provider/audit/org screens swallow load failures. |
| ADMIN-MF-002 | Admin Billing | P1 | S | Admin billing overview/accounts load without error states. |
| ADMIN-MF-003 | Audit Logs | P1 | S | Audit log loading failure is hidden. |
| ADMIN-MF-004 | Feature Flags | P1 | S | Feature flag list/toggle failures leave stale state without explaining failure. |
| ADMIN-MF-005 | Ops | P1 | S | Ops command-center metrics/errors/storage calls lack error handling. |
| ADMIN-MF-006 | Product Analytics | P1 | S | Product analytics overview/funnels/retention calls lack error handling. |
| ADMIN-MF-007 | Admin Students | P1 | S | Admin students load failure marks the screen loaded with no error. |
| ADMIN-MF-008 | Fine Tuning | P1 | S | Fine-tuning list/cancel failures are hidden. |
| ORG-MF-001 | Org Admin | P1 | S | Org member/branding load failures are swallowed. |

## Feature gaps
| ID | Screen | Severity | Effort | One-line |
|---|---|---|---|---|
| OUTCOME-GAP-001 | Outcome Council | P2 | M | Outcome council lacks evidence-driven invalidation from roadmap/project/passport changes. |
| REPLAY-GAP-001 | Learning Replay | P2 | M | Learning Replay is generated only from current load context and is not kept in sync with later activity. |
| CERT-GAP-001 | Certificates | P2 | M | Certificate issue/revoke permissions are backend-only and not reflected in account nav/actions. |
| PROOF-GAP-001 | Proof-of-Learning | P2 | M | Proof exports are report permission-gated but the learner route does not preflight permission. |
| CREATOR-GAP-001 | Creator Studio | P1 | M | Content creation submits only a goal string, so template/content metadata is not captured. |
| INST-GAP-001 | Institution | P1 | M | Institution assignment is still a coarse roadmap assignment and does not support richer class workflows. |
| WORKFLOW-GAP-001 | Workflows | P1 | M | Backend records workflow runs, but the client does not load or show run history. |
| REPORT-GAP-001 | Reports | P2 | M | Reports service still returns placeholder/future metrics. |
| PUSH-GAP-001 | Notifications | P2 | M | Push subscription and notification fanout are placeholders. |

## Enhancements
| ID | Screen | Severity | Effort | One-line |
|---|---|---|---|---|
| AI-ENH-001 | AI provider chain | P2 | M | Mock AI provider can produce fallback output unless strict provider configuration is enforced. |
| PRACTICE-ENH-001 | Practice/Projects | P2 | M | Code execution/review providers include mock/future behavior. |
| BILL-ENH-001 | Billing | P2 | S | UI labels should make mock payment mode explicit or hide purchase CTAs. |
| PROFILE-ENH-001 | Profile | P2 | S | Profile updates do not refresh the auth header/sidebar identity state. |
| ADMIN-ENH-001 | Admin AI Ops | P2 | S | Admin AI Ops copy explicitly says there is no real AI routed yet. |

## Learn

### CORE-BUG-001 P1 — App initializer clears local session on `/auth/me` 403
**Type:** bug
**Evidence:** `client/src/app/app.config.ts:42` registers `APP_INITIALIZER`; `client/src/app/app.config.ts:47-52` catches `auth.loadCurrentUser()` errors and calls `auth.clearSession()` when `err.status === 401 || err.status === 403`.
**Failure/limitation:** A temporary/backend-side 403 while bootstrapping logs the learner out locally instead of showing a recoverable unauthorized state.
**Recommended change:** Treat bootstrap 403 separately from expired credentials, surface a session/permission error, and only clear stored auth on confirmed invalid credentials.
**Effort:** S (hours)

### CORE-BUG-002 P1 — Offline sync bypasses auth refresh and normal error handling
**Type:** bug
**Evidence:** `client/src/app/core/services/sync-queue.service.ts:85-90` sends queued requests with raw `fetch` and a stored access token; `client/src/app/app.config.ts:36-39` registers Angular HTTP auth/error/refresh interceptors only for `HttpClient`.
**Failure/limitation:** Queued offline work can fail after token expiry without refresh retry, central error mapping, or the same unauthorized behavior as online requests.
**Recommended change:** Execute queued work through an authenticated sync API/Angular HTTP path, or implement refresh/retry/error mapping in the queue before marking entries failed.
**Effort:** M (a day)

### CORE-BUG-003 P1 — Dashboard links to a non-existent courses route
**Type:** bug
**Evidence:** `client/src/app/features/dashboard/dashboard.component.ts:123` links to `['/app/courses']`; `client/src/app/app.routes.ts:210` defines the course screen as `path: 'course-builder'`.
**Failure/limitation:** Learners clicking the dashboard course entry hit a dead/redirected route instead of Course Builder.
**Recommended change:** Change dashboard navigation to `/app/course-builder` or add a compatibility route for `/app/courses`.
**Effort:** S (hours)

### CORE-MF-001 P1 — GET failures require inline handling, but many screens miss it
**Type:** missing-fix
**Evidence:** `client/src/app/core/interceptors/error.interceptor.ts:26-28` only shows global toasts for non-GET failures because "GET errors are handled inline by views."
**Failure/limitation:** Any GET screen that does not implement its own error state fails silently by design.
**Recommended change:** Add a shared GET error-state helper or enforce inline load-error handling for every screen-level GET.
**Effort:** M (a day)

### DASH-MF-001 P1 — Dashboard secondary cards silently fail
**Type:** missing-fix
**Evidence:** `client/src/app/features/dashboard/dashboard.component.ts:532-537` swallows next action, career, passport, daily plan, mistakes, and courses errors with `error: () => undefined`; `client/src/app/features/dashboard/dashboard.component.ts:540` also swallows intelligence overview failure.
**Failure/limitation:** Dashboard panels can look empty or stale while the underlying API is failing, giving no clue that learning state did not load.
**Recommended change:** Add per-card error/empty states, retry actions, and telemetry for failed dashboard dependencies.
**Effort:** M (a day)

### DASH-BUG-001 P1 — Roadmap updates refresh only part of the dashboard dependency graph
**Type:** bug
**Evidence:** `client/src/app/features/dashboard/dashboard.component.ts:459-474` refreshes roadmap, next action, daily plan, and intelligence after week progress; `client/src/app/features/dashboard/dashboard.component.ts:532-537` shows other dependent surfaces loaded separately and not refreshed by the mutation.
**Failure/limitation:** Completing learning work can update the roadmap card while passport/career/mistake/course summaries remain stale until a full reload.
**Recommended change:** Centralize learning-state invalidation so roadmap/task/quiz/project mutations refresh all dependent dashboard widgets consistently.
**Effort:** M (a day)

### HIST-MF-001 P1 — Asta history blank tabs hide load/search errors
**Type:** missing-fix
**Evidence:** `client/src/app/features/asta-os/asta-os-history.component.ts:156-161` search errors only set `searching` false; `client/src/app/features/asta-os/asta-os-history.component.ts:188-192` session-list errors only set `loading` false.
**Failure/limitation:** The History tab can render empty content after an API failure, matching the reported "history tabs were there but content was not occurring" symptom.
**Recommended change:** Store and display history load/search error states, preserve the last successful list, and provide retry.
**Effort:** S (hours)

### AGENT-BUG-001 P1 — Agent screen navigation drops unsaved chat sessions
**Type:** bug
**Evidence:** `client/src/app/features/agent-workspace/agent-workspace.component.ts:255-265` resets `activeSessionId`, `messages`, `input`, and streaming state whenever route data changes.
**Failure/limitation:** Moving between Mentor Room, Career Coach, Doubt Solver, Study Notes, or another agent-backed page destroys the current unsaved conversation context.
**Recommended change:** Persist draft sessions by persona/agent route or prompt before discarding an in-progress chat.
**Effort:** M (a day)

### SOCKET-BUG-001 P1 — Concurrent AI sends can be rejected across screens
**Type:** bug
**Evidence:** `client/src/app/core/services/socket.service.ts:12` keeps a single shared socket instance; `server/src/sockets/events.gateway.ts:97-103` rejects a second `agent.send` while `data.streaming` is true.
**Failure/limitation:** If the user starts a stream in one AI screen/tab and sends another prompt elsewhere before it finishes, the second prompt can fail instead of queueing or opening an independent stream.
**Recommended change:** Key socket streams by client-side request/session, or queue concurrent sends per socket with visible pending/error state.
**Effort:** M (a day)

### AGENT-MF-001 P2 — Agent feedback errors are not surfaced
**Type:** missing-fix
**Evidence:** `client/src/app/features/ai-tutor/tutor-workspace.component.ts:638-639` only handles feedback success; `client/src/app/features/agent-workspace/agent-workspace.component.ts:372-373` also omits a feedback error path.
**Failure/limitation:** Learners can click helpful/unhelpful and receive no indication when the feedback was not stored.
**Recommended change:** Add error handlers, optimistic rollback or retry, and disabled state while feedback is in flight.
**Effort:** S (hours)

### TUTOR-MF-001 P1 — AI Tutor history failures are swallowed
**Type:** missing-fix
**Evidence:** `client/src/app/features/ai-tutor/tutor-workspace.component.ts:397-402` sets `historyLoading` false on error without storing or rendering an error message.
**Failure/limitation:** Tutor history can appear as an empty tab even though sessions failed to load.
**Recommended change:** Add a visible history error state with retry and keep prior sessions when refresh fails.
**Effort:** S (hours)

### AGENT-BUG-002 P1 — AI Tutor regenerate drops later turns without branch recovery
**Type:** bug
**Evidence:** `client/src/app/features/ai-tutor/tutor-workspace.component.ts:603` notes later turns are dropped during regenerate; `client/src/app/features/ai-tutor/tutor-workspace.component.ts:609` resends the edited text to the existing session.
**Failure/limitation:** Editing an earlier message can silently remove later context in the UI, while the backend session history may not match the user's perceived branch.
**Recommended change:** Implement explicit conversation branching, or confirm truncation and persist the truncated branch server-side before streaming a regenerated answer.
**Effort:** M (a day)

### ROAD-BUG-001 P1 — Roadmap task completion does not update progress percentage
**Type:** bug
**Evidence:** `server/src/modules/roadmap/roadmap.service.ts:190-200` task updates only `completedTasks`; `server/src/modules/roadmap/roadmap.service.ts:659-663` computes progress from `completedWeeks / totalWeeks`.
**Failure/limitation:** Learners can complete individual tasks and still see no roadmap percentage movement until an entire week is marked complete.
**Recommended change:** Include task completion in progress calculation or expose separate task/week progress so UI copy is accurate.
**Effort:** M (a day)

### ROAD-BUG-002 P1 — Roadmap changes do not invalidate already generated Today plans
**Type:** bug
**Evidence:** `server/src/modules/daily-plan/daily-plan.service.ts:50-55` returns an existing daily plan for the same day; `server/src/modules/daily-plan/daily-plan.service.ts:176-186` derives plan tasks from the current roadmap only at generation time.
**Failure/limitation:** When the AI updates a roadmap after the learner says something is already learned, Today can continue showing the old tasks.
**Recommended change:** Add dependency invalidation/versioning between roadmap changes and daily plan records, then refresh Today after roadmap mutations.
**Effort:** M (a day)

### TODAY-MF-001 P1 — Today streak/history errors are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/today/today.component.ts:292-294` handles daily-plan secondary stream errors by only clearing local loading flags.
**Failure/limitation:** Today can show missing streak/history/supporting data as if the learner simply has no activity.
**Recommended change:** Add explicit error/empty states for each Today dependency and retry failed sections independently.
**Effort:** M (a day)

### Study Spaces — no issues found

### SIM-MF-001 P2 — Simulation completion does not refresh dependent learning screens
**Type:** missing-fix
**Evidence:** `client/src/app/features/simulations/simulation-detail.component.ts:150` updates only the local simulation after finish; `server/src/modules/simulations/simulations.service.ts:105-108` marks finished and records `simulation_finished`.
**Failure/limitation:** Completing simulation work can update the simulation record while Today, Roadmap, Passport, and Dashboard remain stale until manual reload.
**Recommended change:** Emit/consume a learning-progress invalidation event after simulation completion and refresh dependent client stores.
**Effort:** M (a day)

### VISUAL-MF-001 P2 — Visual Studio uses mock image-provider behavior
**Type:** missing-fix
**Evidence:** `client/src/app/app.routes.ts:198` exposes `visuals`; `server/src/modules/visuals/visuals.module.ts:18-19` wires `MockImageProvider`; `server/src/modules/visuals/providers/image-provider.ts:28-29` documents the mock URL behavior.
**Failure/limitation:** Visual Studio can appear to generate visual assets while returning placeholder/mock image URLs rather than production image output.
**Recommended change:** Gate the screen behind provider readiness, show mock-mode copy, or integrate the production image provider.
**Effort:** M (a day)

### VISUAL-BUG-001 P1 — Generated visual content bypasses Angular sanitization
**Type:** bug
**Evidence:** `client/src/app/features/visuals/visual-renderer.component.ts:232` uses `bypassSecurityTrustHtml` for visual content; `client/src/app/features/visuals/visual-renderer.component.ts:235` uses `bypassSecurityTrustUrl` for image URLs.
**Failure/limitation:** If generated or stored visual content is ever unsafe, the renderer explicitly trusts it before display.
**Recommended change:** Sanitize SVG/HTML through a strict allowlist and validate image URLs/data URIs server-side before rendering.
**Effort:** M (a day)

### VISUAL-MF-002 P2 — Visual provider-status failures are ignored
**Type:** missing-fix
**Evidence:** `client/src/app/features/visuals/visuals-list.component.ts:188` calls `this.api.status().subscribe({ next: ... })` without an error handler.
**Failure/limitation:** The screen cannot tell users whether image-generation/provider status failed to load.
**Recommended change:** Add provider-status error handling and show an unknown/mock/live provider state.
**Effort:** S (hours)

### VOICE-BUG-001 P1 — Failed voice turn leaves optimistic transcript behind
**Type:** bug
**Evidence:** `client/src/app/features/voice/voice-room.component.ts:407-411` appends the user turn before the API call; `client/src/app/features/voice/voice-room.component.ts:429` only sets idle and toasts on API error.
**Failure/limitation:** A failed voice request can leave a transcript turn that was never saved or answered by the server.
**Recommended change:** Roll back the optimistic user turn on failure or mark it failed with retry.
**Effort:** S (hours)

### VOICE-MF-002 P1 — Voice session list/detail errors render as blank states
**Type:** missing-fix
**Evidence:** `client/src/app/features/voice/voice-room.component.ts:320-322` only clears loading on list error; `client/src/app/features/voice/voice-room.component.ts:327-330` clears the active session on detail error.
**Failure/limitation:** Voice Room can show no sessions or "session not found" style UI with no load error/retry.
**Recommended change:** Add explicit list/detail load-error states and preserve last-known session data where possible.
**Effort:** S (hours)

### RES-MF-001 P1 — Resource loads collapse failures into empty content
**Type:** missing-fix
**Evidence:** `client/src/app/features/resources/resources.component.ts:282-286` only clears `loadingForYou` on personalized resource failure; `client/src/app/features/resources/resources.component.ts:299-301` sets catalog to `[]` on failure.
**Failure/limitation:** Resources can look genuinely empty when recommendations or catalog calls failed.
**Recommended change:** Preserve last-known data, display per-section failure states, and add retry controls.
**Effort:** S (hours)

### KNOW-MF-001 P2 — Knowledge Q&A history persistence failures are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/knowledge-hub/knowledge-hub.component.ts:476` swallows `saveTurnToServer` errors; `client/src/app/features/knowledge-hub/knowledge-hub.component.ts:484` swallows `clearQa` errors.
**Failure/limitation:** A learner can believe their Knowledge chat history was saved or cleared while the server operation failed.
**Recommended change:** Surface sync failure state, retry queued turns, and confirm history clear only after server success.
**Effort:** S (hours)

### KNOW-BUG-001 P1 — Knowledge document scope IDs are cast without validation
**Type:** bug
**Evidence:** `server/src/modules/rag/dto/knowledge.dto.ts:54-59` accepts optional `documentIds`; `server/src/modules/rag/vector/keyword-vector-store.ts:37-39` maps those IDs directly to `new Types.ObjectId(id)`.
**Failure/limitation:** Malformed document IDs in a scoped Knowledge ask can produce server errors instead of a controlled 400.
**Recommended change:** Validate every document ID before retrieval and reject malformed scoped asks with a clear bad-request response.
**Effort:** S (hours)

### QUIZ-MF-001 P1 — Quiz documents, attempts and history errors are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/quiz-studio/quiz-studio.component.ts:533` loads documents without an error handler; `client/src/app/features/quiz-studio/quiz-studio.component.ts:558` swallows attempts error; `client/src/app/features/quiz-studio/quiz-studio.component.ts:589-591` only stops the history spinner on failure.
**Failure/limitation:** Quizzes can show no docs, no attempts, or empty history without telling the learner that loading failed.
**Recommended change:** Add section-specific error messages and retries for documents, attempts, and history.
**Effort:** S (hours)

### PROJ-MF-001 P1 — Project list/stats/task mutations miss error handling
**Type:** missing-fix
**Evidence:** `client/src/app/features/project-studio/project-studio.component.ts:424` project list load has no error handler; `client/src/app/features/project-studio/project-studio.component.ts:425` swallows stats error; `client/src/app/features/project-studio/project-studio.component.ts:431` subscribes to task creation without error handling.
**Failure/limitation:** Project Studio can silently fail to load, update, or mutate tasks while the UI remains stale.
**Recommended change:** Add load/mutation error states, optimistic rollback, and dependent progress invalidation for project work.
**Effort:** S (hours)

### COURSE-MF-001 P1 — Course Builder generated flows do not invalidate dependent screens
**Type:** missing-fix
**Evidence:** `client/src/app/features/course-builder/course-detail.component.ts:357` navigates to generated flow detail after creation; `client/src/app/app.routes.ts:150` exposes Flow Studio separately.
**Failure/limitation:** A generated course flow can appear in Flow Studio only after navigation/reload, while Today/Roadmap/Dashboard dependencies remain unaware.
**Recommended change:** Publish a course/flow creation event and refresh dependent course, flow, roadmap, and Today state.
**Effort:** M (a day)

### FLOW-MF-001 P1 — Flow node completion does not refresh dependent learner surfaces
**Type:** missing-fix
**Evidence:** `client/src/app/features/flows/flow-detail.component.ts:666-683` updates only the current flow after `updateNode`; `server/src/modules/flows/flows.service.ts:251-253` records `node_completed` when a node is mastered.
**Failure/limitation:** Flow progress can change while Dashboard, Today, Skill Passport, and Outcome screens continue showing stale evidence/progress until reload.
**Recommended change:** Emit a client learning-progress invalidation after node updates and refresh dependent stores/screens.
**Effort:** M (a day)

### COHORT-BUG-001 P1 — Cohorts nav does not match backend permissions
**Type:** bug
**Evidence:** `client/src/app/core/constants/nav.ts:85` shows Cohorts in Learn nav; `server/src/modules/cohort/cohort.controller.ts:50` requires `Permission.CohortView`; `server/src/modules/cohort/cohort.controller.ts:58` requires `Permission.CohortCreate`.
**Failure/limitation:** Learners without cohort permissions can open a sidebar item that immediately fails with unauthorized/forbidden API responses.
**Recommended change:** Add nav/route permission metadata for Cohorts and hide or disable the screen when permission is absent.
**Effort:** S (hours)

### LIVE-BUG-001 P1 — Live Sessions nav does not match backend permissions
**Type:** bug
**Evidence:** `client/src/app/core/constants/nav.ts:86` shows Live Sessions in Learn nav; `server/src/modules/live-session/live-session.controller.ts:47` requires `Permission.CohortView`; `server/src/modules/live-session/live-session.controller.ts:55` requires `Permission.CohortCreate`.
**Failure/limitation:** Learners can navigate to Live Sessions but the list/create APIs can reject them as unauthorized.
**Recommended change:** Align sidebar/route access with live-session permissions and render a request-access state when blocked.
**Effort:** S (hours)

### PEER-BUG-001 P1 — Peer Room messages do not update from other participants in real time
**Type:** bug
**Evidence:** `client/src/app/features/peer-rooms/peer-room-detail.component.ts:119-123` loads a room once on route param change; `client/src/app/features/peer-rooms/peer-room-detail.component.ts:132` updates messages only from the send-message response.
**Failure/limitation:** In a collaborative room, learners do not see messages sent by peers until they reload or re-enter the room.
**Recommended change:** Add socket/polling updates for room messages and presence, with reconnect and error states.
**Effort:** M (a day)

### COMM-BUG-001 P1 — Community nav does not match backend org-view guard
**Type:** bug
**Evidence:** `client/src/app/core/constants/nav.ts:88` shows Community in Learn nav; `server/src/modules/community/community.controller.ts:34` guards the controller with `Permission.OrgView`.
**Failure/limitation:** Users without org-view permission can enter Community from the sidebar and then see failing/empty feeds.
**Recommended change:** Add permission-aware nav visibility or a non-org fallback community state.
**Effort:** M (a day)

### VOICE-MF-001 P2 — Voice Room is backed by mock voice provider behavior
**Type:** missing-fix
**Evidence:** `client/src/app/core/constants/nav.ts:89` shows Voice Room in Learn nav; `server/src/modules/voice/voice.module.ts:25` provides `MockVoiceProvider`; `server/src/modules/voice/voice.provider.ts:30-31` returns a placeholder synthesized URL.
**Failure/limitation:** Voice practice can appear production-ready while transcription/synthesis quality is placeholder behavior.
**Recommended change:** Show mock-provider state or wire a production provider before presenting the flow as complete.
**Effort:** M (a day)

### REPLAY-GAP-001 P2 — Learning Replay is not kept in sync after activity changes
**Type:** missing-functionality
**Evidence:** `client/src/app/features/replay/replay.component.ts:95` generates replay in the constructor; `client/src/app/features/replay/replay.component.ts:96-98` regenerates only on explicit screen action/API response.
**Failure/limitation:** Replay can be generated from stale context and not update after roadmap, quiz, project, or Today mutations.
**Recommended change:** Add replay invalidation keyed to learning-event versions and refresh when dependent activity changes.
**Effort:** M (a day)

### Mentor Room — no issues found

### Progress — no issues found

### Skill Twin — no issues found

### MISTAKE-MF-001 P1 — Mistakes due queue failures are not marked as load errors
**Type:** missing-fix
**Evidence:** `client/src/app/features/mistakes/mistakes.component.ts:392-394` marks list/stats errors as `loadError`, but the due queue error path only calls `done`.
**Failure/limitation:** The review-due count/list can silently disappear while the rest of Mistakes looks successfully loaded.
**Recommended change:** Treat due queue failure as a section error, preserve existing due items, and allow retry.
**Effort:** S (hours)

### MISTAKE-MF-002 P2 — Repair action toggle failures are swallowed
**Type:** missing-fix
**Evidence:** `client/src/app/features/mistakes/mistakes.component.ts:553` calls `toggleAction` with `error: () => undefined`.
**Failure/limitation:** Learners can tick a repair action and receive no indication when the server did not store it.
**Recommended change:** Add error toast/rollback and disable action toggles while saving.
**Effort:** S (hours)

### WORKFLOW-MF-001 P1 — Workflow graph loading failures collapse to disabled/empty state
**Type:** missing-fix
**Evidence:** `client/src/app/features/workflows/workflows.component.ts:110-115` sets enabled false on status failure and loads graphs without an error handler.
**Failure/limitation:** Workflows can look disabled or empty even when status/graph APIs failed.
**Recommended change:** Add distinct "disabled by feature flag" versus "failed to load workflow status/graphs" states.
**Effort:** S (hours)

### WORKFLOW-GAP-001 P1 — Workflow run history is recorded but not shown
**Type:** missing-functionality
**Evidence:** `server/src/modules/agent-graph/agent-graph.controller.ts:35-47` exposes run list/detail endpoints; `client/src/app/features/workflows/workflows.component.ts:103-106` only stores graphs/result/running state.
**Failure/limitation:** Users cannot review previous workflow runs even though the backend persists them.
**Recommended change:** Add run history loading, empty/error states, and detail replay for prior graph runs.
**Effort:** M (a day)

### Mentor Council — no issues found

## Outcome

### CAREER-MF-001 P1 — Career Readiness role failures are converted to empty data
**Type:** missing-fix
**Evidence:** `client/src/app/features/career-readiness/career-readiness.component.ts:210` handles role load failure by assigning `{}`.
**Failure/limitation:** The screen can look like no career roles are configured when the API actually failed.
**Recommended change:** Add an error state, retry, and last-known role cache instead of replacing failed data with an empty object.
**Effort:** S (hours)

### OUTCOME-GAP-001 P2 — Outcome Council lacks dependency invalidation from learning evidence
**Type:** missing-functionality
**Evidence:** `client/src/app/features/outcome-council/outcome-council.component.ts:119-121` loads the latest result once; `client/src/app/features/outcome-council/outcome-council.component.ts:127-129` refreshes only after explicit recommend action.
**Failure/limitation:** Outcome guidance can become stale after roadmap, project, quiz, or passport evidence changes.
**Recommended change:** Add a shared evidence/progress invalidation event that refreshes Outcome Council and all outcome summary widgets.
**Effort:** M (a day)

### INTERVIEW-MF-001 P1 — Interview OS load failures are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/interview/interview.component.ts:366-368` loads interview types, archetypes, and sessions without error handling; `client/src/app/features/interview/interview.component.ts:414` refreshes lists without error handling.
**Failure/limitation:** Interview OS can show empty type/session selectors with no explanation when APIs fail.
**Recommended change:** Add per-section error states and retry for types, archetypes, sessions, and post-mutation refreshes.
**Effort:** S (hours)

### APP-MF-001 P1 — Applications list failure only clears loading
**Type:** missing-fix
**Evidence:** `client/src/app/features/applications/applications.component.ts:273` sets `loading` false on list error without storing a screen error.
**Failure/limitation:** The applications tracker can look empty instead of failed.
**Recommended change:** Render a list error state, preserve last-known applications, and add retry.
**Effort:** S (hours)

### PORT-BUG-001 P2 — Public portfolio load errors are shown as unpublished/missing
**Type:** bug
**Evidence:** `client/src/app/features/portfolio/public-portfolio.component.ts:25-26` shows "This portfolio is not published" for `loadError`; `client/src/app/features/portfolio/public-portfolio.component.ts:110-112` sets `loadError` for any API error.
**Failure/limitation:** A temporary API/network failure can tell visitors the portfolio is unpublished or the link is wrong.
**Recommended change:** Distinguish 404/unpublished from transport/server errors and render a retry state for the latter.
**Effort:** S (hours)

### PORT-MF-001 P2 — Portfolio public-setting save has no busy/rollback treatment
**Type:** missing-fix
**Evidence:** `client/src/app/features/portfolio/portfolio.component.ts:182` patches public settings and only toasts on error.
**Failure/limitation:** Users toggling portfolio privacy options get no disabled state, rollback, or last-good indication when the save fails.
**Recommended change:** Add per-toggle saving state, revert failed changes, and preserve last-known public settings.
**Effort:** S (hours)

### PASSPORT-BUG-001 P1 — Skill Passport evidence removal can throw cast errors
**Type:** bug
**Evidence:** `server/src/modules/skill-passport/skill-passport.service.ts:516-517` deletes evidence with `new Types.ObjectId(id)`; `server/src/modules/skill-passport/skill-passport.controller.ts:83-84` accepts the raw `:id` parameter.
**Failure/limitation:** Malformed evidence URLs can produce server errors instead of a controlled validation response.
**Recommended change:** Validate evidence IDs before casting and return 400 for malformed identifiers.
**Effort:** S (hours)

### PROOF-GAP-001 P2 — Proof-of-Learning route does not preflight reports permission
**Type:** missing-functionality
**Evidence:** `client/src/app/core/constants/nav.ts:110` lists Proof-of-Learning; `client/src/app/app.routes.ts:396` routes `reports`; `server/src/modules/reports/reports.controller.ts:14` requires `Permission.ReportsView`.
**Failure/limitation:** Learners can open the proof/report route but report APIs can fail as forbidden.
**Recommended change:** Add permission-aware route/nav checks or a request-access state before calling reports APIs.
**Effort:** M (a day)

### Skill Passport — no issues found beyond PASSPORT-BUG-001

### RESUME-MF-001 P2 — Resume PDF export has no rejection handler
**Type:** missing-fix
**Evidence:** `client/src/app/features/resume/resume.component.ts:175-176` calls `downloadPdf(...).then(...)` without a `.catch`.
**Failure/limitation:** Failed PDF generation/download gives no toast or recovery path.
**Recommended change:** Add rejection handling and a fallback to Markdown export when PDF generation fails.
**Effort:** S (hours)

## Ecosystem

### MENTOR-MF-001 P1 — Mentor marketplace load failures render as empty/partial screens
**Type:** missing-fix
**Evidence:** `client/src/app/features/mentor-marketplace/mentors.component.ts:170` only clears loading on mentor list error; `client/src/app/features/mentor-marketplace/mentors.component.ts:177` only clears sessions loading; `client/src/app/features/mentor-marketplace/mentors.component.ts:181` converts profile error to `null`.
**Failure/limitation:** Mentor discovery, bookings, or profile setup can appear empty instead of failed.
**Recommended change:** Add visible error states and retries for discovery, sessions, and mentor profile loading.
**Effort:** S (hours)

### MENTOR-BUG-001 P1 — Hidden mentor profiles can still appear in discovery
**Type:** bug
**Evidence:** `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:60-65` lists mentors without filtering visibility; `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:86-91` stores `visible` on mentor profile update.
**Failure/limitation:** Mentors who set their profile invisible can still be shown to learners.
**Recommended change:** Filter marketplace discovery to visible profiles unless the requester has mentor/admin access.
**Effort:** M (a day)

### MENTOR-BUG-002 P1 — Mentor session request lacks duplicate/self-booking checks
**Type:** bug
**Evidence:** `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:103-119` creates a pending mentor session directly from requester and mentor IDs.
**Failure/limitation:** A user can create duplicate pending bookings or request a session with themselves when IDs line up.
**Recommended change:** Validate requester/mentor identity, prevent duplicates for the same slot/topic, and return a clear conflict message.
**Effort:** S (hours)

### MARKET-BUG-001 P1 — Marketplace template use does not create a copied asset
**Type:** bug
**Evidence:** `client/src/app/features/marketplace/marketplace.component.ts:110-112` calls `useTemplate` and routes from the response; `server/src/modules/marketplace/marketplace.service.ts:120-136` increments usage and returns `route/content` metadata.
**Failure/limitation:** Clicking "use" can navigate the user without creating a real project/roadmap/template instance to continue editing.
**Recommended change:** Implement template cloning per asset type and return the created asset route/id.
**Effort:** M (a day)

### CREATOR-MF-001 P1 — Creator Studio load failures are swallowed
**Type:** missing-fix
**Evidence:** `client/src/app/features/creator-studio/creator-studio.component.ts:112-113` subscribes to mine and pending lists with empty error handlers.
**Failure/limitation:** Creator Studio can show empty submitted/pending content when the API failed.
**Recommended change:** Add visible load errors, retry, and preserve previous creator lists.
**Effort:** S (hours)

### CREATOR-GAP-001 P1 — Creator Studio create submits only a goal string
**Type:** missing-functionality
**Evidence:** `client/src/app/features/creator-studio/creator-studio.component.ts:118` creates content using `{ goal: this.goal.trim() }`.
**Failure/limitation:** Creators cannot submit structured content metadata, target audience, tags, pricing, assets, or review notes from the primary screen.
**Recommended change:** Add a proper content submission model and form, then validate it server-side before review.
**Effort:** M (a day)

### INST-BUG-001 P1 — Institution nav does not match backend role guard
**Type:** bug
**Evidence:** `client/src/app/core/constants/nav.ts:120` shows Institution in Ecosystem nav; `server/src/modules/institution/institution.controller.ts:16` restricts the controller to `Role.Admin` and `Role.Mentor`.
**Failure/limitation:** Learners can navigate to Institution and hit unauthorized backend calls.
**Recommended change:** Hide/disable Institution unless the user has an allowed role, or add a learner-safe institution route.
**Effort:** S (hours)

### INST-GAP-001 P1 — Institution assignment is still a coarse roadmap assignment workflow
**Type:** missing-functionality
**Evidence:** `server/src/modules/institution/institution.service.ts:149-164` assigns a roadmap to selected learners; `server/src/modules/institution/institution.service.ts:43` and `server/src/modules/institution/institution.service.ts:76-97` use limited sampling/max learner behavior for institution analytics.
**Failure/limitation:** Institution workflows do not yet cover richer class/module assignment, due dates, differentiated learning, or robust cohort analytics.
**Recommended change:** Model assignments/classes explicitly and add complete analytics pagination instead of sampled snapshots.
**Effort:** M (a day)

## Account

### CERT-GAP-001 P2 — Certificate permissions are backend-only
**Type:** missing-functionality
**Evidence:** `client/src/app/core/constants/nav.ts:126` shows Certificates; `server/src/modules/certificates/certificates.controller.ts:29` requires `Permission.CertificateIssue`; `server/src/modules/certificates/certificates.controller.ts:42` also requires `Permission.CertificateIssue` for revoke.
**Failure/limitation:** Users can reach certificate screens without clear affordance differences between viewing, issuing, and revoking capabilities.
**Recommended change:** Add permission-aware action visibility and explicit request-access messaging for issue/revoke operations.
**Effort:** M (a day)

### CERT-BUG-001 P2 — Certificate revoke reuses issue permission
**Type:** bug
**Evidence:** `server/src/modules/certificates/certificates.controller.ts:41-44` exposes revoke; `server/src/modules/certificates/certificates.controller.ts:42` protects it with `Permission.CertificateIssue`.
**Failure/limitation:** A user allowed to issue certificates is also allowed to revoke them unless backend roles happen to separate it elsewhere.
**Recommended change:** Add `CertificateRevoke` permission or an explicit admin-only revoke guard and reflect it in the UI.
**Effort:** S (hours)

### CERT-BUG-002 P2 — Public certificate verify errors appear as invalid certificates
**Type:** bug
**Evidence:** `client/src/app/features/certificates/cert-verify.component.ts:50` says the certificate is invalid/revoked/missing; `client/src/app/features/certificates/cert-verify.component.ts:117-122` sets the same invalid state on API error.
**Failure/limitation:** A network or server failure can tell a visitor that a valid certificate is invalid or revoked.
**Recommended change:** Split invalid/revoked responses from transport/server errors and show retry for verification failures.
**Effort:** S (hours)

### BILL-MF-001 P1 — Billing data-loading failures are swallowed
**Type:** missing-fix
**Evidence:** `client/src/app/features/billing/billing.component.ts:293-297` loads plans, subscription, usage, transactions, and entitlements without local error handlers.
**Failure/limitation:** Billing can show missing plans or account data as if the account has no billing activity.
**Recommended change:** Add section-level billing errors, retry, and last-known subscription/entitlement display.
**Effort:** S (hours)

### BILL-BUG-001 P1 — Billing purchase actions use a mock payment provider
**Type:** bug
**Evidence:** `server/src/modules/billing/billing.module.ts:48` registers a payment provider; `server/src/modules/billing/providers/mock-payment.provider.ts:12-13` creates mock checkout sessions; `server/src/modules/billing/providers/mock-payment.provider.ts:23` creates mock portal URLs.
**Failure/limitation:** Users can initiate checkout/change/cancel flows that look real while the backend is not connected to a production payment provider.
**Recommended change:** Gate billing CTAs behind provider configuration or integrate the real provider before exposing production purchase actions.
**Effort:** M (a day)

### BILL-ENH-001 P2 — Billing UI should label mock payment mode
**Type:** enhancement
**Evidence:** `client/src/app/features/billing/billing.component.ts:10` describes checkout/session management; `client/src/app/features/billing/billing.component.ts:332` calls checkout for plan changes while backend mock provider is active.
**Failure/limitation:** Users cannot tell whether checkout is a sandbox, mock, or real billing operation.
**Recommended change:** Show environment/provider status and disable or relabel purchase CTAs in mock mode.
**Effort:** S (hours)

### OFFLINE-MF-001 P1 — Offline copy promises drafting/sync beyond implemented queue semantics
**Type:** missing-fix
**Evidence:** `client/src/app/features/platform/offline.component.ts:34` says "Draft quiz / project / notes (synced later)"; `client/src/app/core/services/offline.service.ts:30-57` is centered on snapshot/cache status rather than full draft conflict handling.
**Failure/limitation:** Learners can expect offline quiz/project/note authoring to sync later even though the visible queue does not prove those workflows are supported end to end.
**Recommended change:** Narrow the copy to implemented offline capabilities or add full draft models, conflict resolution, and replay status per supported workflow.
**Effort:** M (a day)

### INTEG-BUG-001 P1 — Calendar feed uses query-token URL outside normal auth flow
**Type:** bug
**Evidence:** `client/src/app/core/services/integration.service.ts:54-56` builds a calendar URL with a `token` query parameter; `server/src/modules/integrations/integrations.controller.ts:108` exposes `calendar.ics`.
**Failure/limitation:** Feed tokens can be copied/leaked through URLs and do not benefit from the normal interceptor/session controls.
**Recommended change:** Use revocable feed tokens with explicit rotation/expiry UI, or proxy downloads through authenticated requests.
**Effort:** M (a day)

### INTEG-MF-001 P1 — Integration load/connect/disconnect failures are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/platform/integrations.component.ts:115` lists integrations without an error handler; `client/src/app/features/platform/integrations.component.ts:126` and `client/src/app/features/platform/integrations.component.ts:205` only clear busy on connect/disconnect errors.
**Failure/limitation:** Integrations can appear empty or unchanged after failed connector operations without telling the user what happened.
**Recommended change:** Add screen-level load error and operation-level error toasts for every connector action.
**Effort:** S (hours)

### DEV-BUG-001 P1 — Developer nav does not match backend org-manage guard
**Type:** bug
**Evidence:** `client/src/app/core/constants/nav.ts:130` shows Developer in Account nav; `client/src/app/app.routes.ts:444` exposes `developer`; `server/src/modules/developer/developer.controller.ts:63` requires `Permission.OrgManage`.
**Failure/limitation:** Users without org-manage permission can open Developer and then receive forbidden API failures.
**Recommended change:** Add permission-aware nav/route guards or render a request-access state before API calls.
**Effort:** S (hours)

### DEV-BUG-002 P1 — Developer identifiers are cast without validation
**Type:** bug
**Evidence:** `server/src/modules/developer/developer.service.ts:47-60` creates API keys for an org; `server/src/modules/developer/developer.service.ts:76` revokes by raw key id; `server/src/modules/developer/developer.service.ts:107-117` and `server/src/modules/developer/developer.service.ts:131-153` manage webhooks by raw IDs.
**Failure/limitation:** Malformed API-key or webhook IDs can throw server errors instead of returning controlled validation responses.
**Recommended change:** Validate all route IDs with `Types.ObjectId.isValid` or a ParseObjectId pipe before casting/queries.
**Effort:** S (hours)

### DATA-MF-001 P1 — Data export job loading failures are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/platform/data-governance.component.ts:87` subscribes to export jobs without an error handler; `server/src/modules/data-governance/data-governance.service.ts:69-78` returns generated file URLs for exports.
**Failure/limitation:** The data screen can show no export jobs or stale job status without indicating a failed load.
**Recommended change:** Add export-job error state, retry, and clear status for file expiration/download failure.
**Effort:** S (hours)

### PRIV-BUG-001 P1 — Privacy destructive actions do not invalidate dependent screens
**Type:** bug
**Evidence:** `server/src/modules/privacy/privacy.controller.ts:20` exposes make private; `server/src/modules/privacy/privacy.controller.ts:25-27` exposes reset Skill Twin; `server/src/modules/privacy/privacy.controller.ts:30-32` exposes clear applications.
**Failure/limitation:** After privacy actions, Roadmap/Today/Dashboard/Portfolio/Applications can remain stale until a reload.
**Recommended change:** Add client-side invalidation after each privacy action and server-side domain events for destructive data changes.
**Effort:** M (a day)

### PRIV-MF-001 P1 — Privacy settings load failures are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/privacy/privacy.component.ts:77-78` loads settings and only clears `loading` on error.
**Failure/limitation:** The Data & Privacy screen can show incomplete public/data counts without indicating the settings request failed.
**Recommended change:** Store a load error, show retry, and preserve last-known privacy settings if refresh fails.
**Effort:** S (hours)

### SECURITY-MF-001 P1 — Security sessions load errors are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/platform/security.component.ts:91` subscribes to session loading without an error handler.
**Failure/limitation:** Security can show no active sessions when the sessions API failed.
**Recommended change:** Add load error UI, retry, and a warning when session state is unavailable.
**Effort:** S (hours)

### SEC-BUG-001 P1 — Session revoke IDs are not validated before ObjectId cast
**Type:** bug
**Evidence:** `server/src/modules/sessions/sessions.service.ts:75-76` revokes a session with `_id: new Types.ObjectId(sessionId)`.
**Failure/limitation:** A malformed session ID can produce a server exception instead of a controlled bad-request response.
**Recommended change:** Validate session IDs before casting and return a clear 400/404.
**Effort:** S (hours)

### NOTIF-MF-001 P2 — Notification read-state mutations have no rollback
**Type:** missing-fix
**Evidence:** `client/src/app/features/notifications/notifications.component.ts:154-156` marks a notification read locally before calling the service; `client/src/app/core/services/notification.service.ts:37-50` marks read/all-read without error handlers.
**Failure/limitation:** If the server read operation fails, the page and bell can show notifications as read even though the backend still counts them unread.
**Recommended change:** Add error handling/rollback for mark-read and mark-all-read operations.
**Effort:** S (hours)

### PROFILE-ENH-001 P2 — Profile updates do not refresh global auth identity state
**Type:** enhancement
**Evidence:** `client/src/app/features/profile/profile.component.ts:459-465` updates the profile and patches only the local form/display state.
**Failure/limitation:** Header/sidebar identity details can remain stale after profile edits until a full user reload.
**Recommended change:** Refresh or patch the global auth/current-user store after successful profile update.
**Effort:** S (hours)

## Admin

### ADMIN-BUG-001 P1 — Admin nav is broader than backend admin/permission guards
**Type:** bug
**Evidence:** `client/src/app/core/constants/nav.ts:143` starts the Admin nav group; `server/src/modules/admin/admin.controller.ts:10-11` restricts admin endpoints to `Role.Admin`; `server/src/modules/tenancy/platform.controller.ts:18` requires `Permission.PlatformManage`.
**Failure/limitation:** Non-admin users can be offered admin/platform screens that fail with unauthorized/forbidden responses during navigation or data load.
**Recommended change:** Add role/permission metadata to admin nav items and enforce matching client route guards.
**Effort:** S (hours)

### ADMIN-MF-001 P1 — Admin screens swallow load failures
**Type:** missing-fix
**Evidence:** `client/src/app/features/admin/admin-analytics.component.ts:185` loads analytics without error handling; `client/src/app/features/admin/admin-analytics.component.ts:186` swallows provider errors; `client/src/app/features/founder/founder-dashboard.component.ts:194` loads founder metrics without an error handler.
**Failure/limitation:** Admin dashboards can display empty or stale operational data with no indication that the API failed.
**Recommended change:** Add explicit error states, retries, and last-known timestamps for admin dashboards.
**Effort:** S (hours)

### ADMIN-MF-002 P1 — Admin Billing overview/accounts load without error states
**Type:** missing-fix
**Evidence:** `client/src/app/features/admin/admin-billing.component.ts:96-97` subscribes to overview and accounts without error handlers.
**Failure/limitation:** Admin Billing can show blank revenue/account panels when the billing admin APIs fail.
**Recommended change:** Add loading/error/empty states for overview and accounts independently.
**Effort:** S (hours)

### ADMIN-MF-003 P1 — Audit log loading failure is hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/admin/audit-logs.component.ts:106` loads audit logs without an error handler.
**Failure/limitation:** The audit trail can look empty even though compliance log retrieval failed.
**Recommended change:** Add audit-log load error, retry, and last-refreshed timestamp.
**Effort:** S (hours)

### ADMIN-MF-004 P1 — Feature flag failures leave stale state unexplained
**Type:** missing-fix
**Evidence:** `client/src/app/features/admin/feature-flags.component.ts:84` lists flags without an error handler; `client/src/app/features/admin/feature-flags.component.ts:97` clears busy on toggle error without a toast.
**Failure/limitation:** Admins can think a kill switch stayed unchanged by choice rather than because the update failed.
**Recommended change:** Add load error, toggle error toast, and optimistic rollback for flag updates.
**Effort:** S (hours)

### ADMIN-MF-005 P1 — Ops command-center calls lack error handling
**Type:** missing-fix
**Evidence:** `client/src/app/features/admin/ops.component.ts:148-157` loads metrics, errors, realtime, and storage without error handlers; `client/src/app/features/admin/ops.component.ts:164` also loads failed jobs without an error handler.
**Failure/limitation:** Operational health panels can remain empty/stale during incidents.
**Recommended change:** Add per-panel error states and retry controls so ops failures are visible.
**Effort:** S (hours)

### ADMIN-MF-006 P1 — Product analytics calls lack error handling
**Type:** missing-fix
**Evidence:** `client/src/app/features/admin/product-analytics.component.ts:144-146` loads overview, funnels, and retention without error handlers.
**Failure/limitation:** Product analytics can show empty charts as if there is no activity.
**Recommended change:** Add explicit analytics load errors and preserve the last successful snapshot.
**Effort:** S (hours)

### ADMIN-MF-007 P1 — Admin Students failure marks the page loaded
**Type:** missing-fix
**Evidence:** `client/src/app/features/admin/admin-students.component.ts:294-296` sets `loaded` true on students load error without storing an error.
**Failure/limitation:** Admin Students can render an empty roster as if there are no students.
**Recommended change:** Add an error signal and retry state for the roster load.
**Effort:** S (hours)

### ADMIN-MF-008 P1 — Fine-tuning list/cancel failures are hidden
**Type:** missing-fix
**Evidence:** `client/src/app/features/admin/fine-tuning.component.ts:121` lists jobs without an error handler; `client/src/app/features/admin/fine-tuning.component.ts:142` cancels without an error handler.
**Failure/limitation:** Fine-tuning jobs can fail to load or cancel with no admin-visible explanation.
**Recommended change:** Add job-list error state and cancel failure toast/rollback.
**Effort:** S (hours)

### ORG-MF-001 P1 — Org member and branding load failures are swallowed
**Type:** missing-fix
**Evidence:** `client/src/app/features/org/org-admin.component.ts:186` swallows org member load errors; `client/src/app/features/org/org-branding.component.ts:84` loads branding without an error handler.
**Failure/limitation:** Org Admin can show an empty member list or default branding when permission/API calls failed.
**Recommended change:** Add org member/branding error states and permission-aware request-access messaging.
**Effort:** S (hours)

### AI-ENH-001 P2 — AI provider chain can fall back to mock output
**Type:** improvisation
**Evidence:** `server/src/modules/ai/gateway/provider-chain.ts:10-17` defines provider-chain behavior; `server/src/modules/ai/gateway/provider-chain.ts:115` and `server/src/modules/ai/gateway/provider-chain.ts:145` include fallback/error handling paths.
**Failure/limitation:** Production-looking AI flows can return mock/fallback output if provider configuration is incomplete.
**Recommended change:** Enforce environment-specific provider policies, expose provider health in admin, and block learner flows when no real provider is configured.
**Effort:** M (a day)

### ADMIN-ENH-001 P2 — Admin AI Ops states that real AI routing is absent
**Type:** enhancement
**Evidence:** `client/src/app/features/admin/ai-ops.component.ts:79` displays "No real AI is routed yet."
**Failure/limitation:** AI operations appears as an admin surface before provider routing is fully wired.
**Recommended change:** Either complete provider routing/telemetry or mark the screen as setup-only with disabled operational controls.
**Effort:** S (hours)

### PRACTICE-ENH-001 P2 — Practice execution/review still includes mock/future provider behavior
**Type:** improvisation
**Evidence:** `server/src/modules/practice/providers/mock-execution.provider.ts:19-20` returns mock execution results; `server/src/modules/projects/services/project-review.generator.ts:29` notes future AI review behavior.
**Failure/limitation:** Learners can receive practice/project feedback that looks authoritative while it is placeholder behavior.
**Recommended change:** Surface provider mode, separate mock feedback from real review, and wire production execution/review providers.
**Effort:** M (a day)

### REPORT-GAP-001 P2 — Reports metrics are still placeholder/future behavior
**Type:** missing-functionality
**Evidence:** `server/src/modules/reports/services/reports.service.ts:52` marks future report behavior.
**Failure/limitation:** Admin/proof reports can appear complete while relying on incomplete aggregation logic.
**Recommended change:** Implement real report aggregation and document any remaining unavailable metrics in the UI.
**Effort:** M (a day)

### PUSH-GAP-001 P2 — Push notification persistence/fanout is placeholder-level
**Type:** missing-functionality
**Evidence:** `server/src/modules/push/schemas/push-subscription.schema.ts:7` defines push subscription storage; `server/src/modules/notifications/schemas/notification.schema.ts:8` defines notification persistence without a proven delivery workflow here.
**Failure/limitation:** Notifications can be stored without reliable push fanout, retry, or delivery status for users.
**Recommended change:** Implement delivery workers, retry/dead-letter handling, and visible notification delivery state.
**Effort:** M (a day)

### Admin Roadmaps — no issues found
