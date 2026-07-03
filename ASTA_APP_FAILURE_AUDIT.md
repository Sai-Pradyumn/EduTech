# Asta App Failure Case Audit

Date: 2026-07-03

Scope: code audit of the user-reported issues around history, session naming, Asta chat behavior, app-wide AI updates, unauthorized crashes, and the sidebar sections from Ecosystem onward. This file is an issue inventory, not a fix patch.

Verification note: `npm run build:server` and `npm run build:client` could not actually execute in this shell because `node.exe` is not on PATH. PowerShell resolved `npm.ps1`, but that shim failed at `C:\Users\SAI\AppData\Roaming\npm\npm.ps1:24`. Treat build verification as blocked until Node is available.

## Severity legend

- P0: can log the user out, crash a workflow, corrupt or lose live state, or block core learning.
- P1: confirmed product behavior mismatch or incomplete user-facing workflow.
- P2: edge case, silent failure, confusing copy, or operational risk.

## Resolution log — 2026-07-03 (branch `feat/full-revamp`)

A first fix pass landed the systemic P0 crashes + the confirmed quick-win correctness
bugs. Builds/tests verified green (server 162 unit tests + lint 0 errors, client build).

**Fixed**
- **P0 expired token → logout** — a refresh-and-retry HTTP interceptor now rotates the
  access token via the refresh token and retries the original request once; concurrent
  401s share one de-duplicated refresh; only a failed refresh clears the session.
  (`core/interceptors/refresh.interceptor.ts`, `AuthService.refreshAccessToken`.)
- **P0 sidebar exposes permission-gated screens** — the shell now gates Institution
  (admin/mentor) and Developer (org-manage) out of the student sidebar by
  permission/platform-admin. _(Client route guards + explicit forbidden states are
  still worth adding as defense-in-depth.)_
- **P0 Asta stream error bypasses REST fallback** — a terminal `{type:'error'}` socket
  event now routes to a non-streaming REST retry across all three chat surfaces (Asta
  OS, classic AI Tutor, shared Agent Workspace); AI Tutor + Agent Workspace had no
  fallback at all before.
- **P0 Asta OS tab/history race** — closing the active tab mid-stream is blocked, and
  loading a history session persists the current tab and opens the session in its own
  tab (or switches to it) instead of clobbering the live tab.
- **P1 session naming** — titled from the first user message immediately (not only after
  the assistant reply) with deterministic cleanup (strips imperatives + trailing
  "…to the roadmap screen").
- **P1 dashboard course-resume route** — `/app/courses/:id` → `/app/course-builder/:id`.
- **P2 certificate copy** — copies the full shareable verification URL, not the bare id.

_(The build-verification blocker noted below is environment-specific — Node was
available in this pass, so server/client builds + tests actually ran and are green.)_

## Resolution log #2 — large builds (server 192 tests + lint 0, client build green)

**Large build #1 — central Asta updates (DONE)**
- **App-wide invalidation bus** — a chat command now returns an `invalidate` receipt
  (server `common/domain-keys.ts`; client `DomainBusService`) and every open dependent
  screen refreshes: Today reloads on a direct plan edit but **regenerates** on an
  upstream roadmap/flow/mistake change; the dashboard refreshes next-move/plan/reviews/
  courses (its week-toggle cascades too); roadmap details reloads. Fixes P1 *"dependent
  screens don't update after one domain changes."*
- **Write-from-chat tools** — `roadmap.create`, `course.create`, `flows.create`,
  `mistakes.log` now build/record **real entities** from natural language (fixes the
  headline P1 where Asta only replied with a plan, never persisted one).
- **Safe multi-write** — a compound message ("do X; then Y") runs one command per clause
  (explicit connectors only, distinct command once, capped at 4), with per-command
  confirmation + Undo as the receipt.

**Large build #2 — Mentor Sessions workflow (DONE, except real payment)**
- **Lifecycle state machine** — requested→accepted→completed (or →cancelled); terminal
  states frozen; accept/complete mentor-only, either party cancels.
- **Request guards** — no self-requests; one open request per student↔mentor pair.
- **Org visibility** — profiles stamp their org; the browse list hides your own profile
  and shows org-only mentors solely to same-org viewers (was leaking to everyone).
- **Scheduling + notes** — mentor proposes a slot on accept (`scheduledAt`, shown to
  both); mentor notes are now editable from the UI (was display-only). Visible
  error/empty states on Browse + Sessions.
- _Deferred:_ real payment capture (needs the payment-provider wiring; the workflow is
  otherwise complete).

**Still open (tracked)** — roadmap task→percentage model, Marketplace clone, Creator
Studio type-specific templates, Institution real assignments + sampled-vs-total,
Integrations calendar authenticated export, Data export URL/job semantics, Security
current-device accuracy, Profile name↔auth sync, mentor payment capture, and
standardizing loading/error/empty states across the remaining account/ecosystem screens.

## Highest priority findings

### P0 - Expired access tokens cause logout instead of refresh

Symptoms:
- User can navigate with a stale token, then any protected API call returns 401 and the app redirects to login.
- This matches the reported "status unauthorized" crashes while switching screens.

Evidence:
- Route guard only checks that an access token string exists: `client/src/app/core/guards/auth.guard.ts:6-10`.
- 401 on any non-auth request clears the session and navigates to `/login`: `client/src/app/core/interceptors/error.interceptor.ts:21-23`.
- Refresh token is stored but never used by the frontend: `client/src/app/core/services/auth.service.ts:20-23`, `client/src/app/core/services/auth.service.ts:77-83`.
- Backend has a refresh endpoint that is not wired into Angular retry logic: `server/src/modules/auth/auth.controller.ts:119-121`.

Failure cases:
- Access token expires while the user is in the app.
- Laptop wakes from sleep, first GET call returns 401, whole app logs out.
- A long Asta/chat session outlives the access token.
- User sees unauthorized in console during route changes because each page fires protected GET requests on load.

Recommended fix:
- Add a refresh-and-retry HTTP interceptor with request de-duplication.
- If refresh fails, then clear session and redirect.
- Make the route guard check a validated/restored user state, not only token presence.

### P0 - Student sidebar exposes permission-gated screens

Symptoms:
- Screens appear available from the sidebar but backend rejects the user with 403/401-like errors.

Evidence:
- Student nav always includes Institution and Developer: `client/src/app/core/constants/nav.ts:115-133`.
- Institution controller is admin/mentor only: `server/src/modules/institution/institution.controller.ts:16`.
- Developer controller requires `OrgManage`: `server/src/modules/developer/developer.controller.ts:62-64`.
- Developer component calls all protected endpoints on init with no visible forbidden state: `client/src/app/features/platform/developer.component.ts:136-146`.

Failure cases:
- Normal student opens `/app/institution`, gets forbidden/error.
- Normal student opens `/app/developer`, multiple forbidden calls fire.
- Console looks like unauthorized app instability even though the real issue is visibility/permissions.

Recommended fix:
- Gate sidebar items by role/permission/org context.
- Add client-side route guards for role/permission-sensitive screens.
- Add explicit "You do not have access" states instead of silent blanks.

### P0 - Asta stream error events bypass REST fallback

Symptoms:
- Chatbot "not working properly" or returns failure even when REST fallback could have answered.

Evidence:
- Socket service completes normally when it receives `{ type: 'error' }`: `client/src/app/core/services/socket.service.ts:62-69`.
- Asta OS only invokes REST fallback on Observable error, not on stream error event: `client/src/app/features/asta-os/asta-os.component.ts:515-519`, `client/src/app/features/asta-os/asta-os.component.ts:933-934`.
- Backend socket emits terminal error events for Unauthorized socket, busy socket, long messages, and orchestrator failure: `server/src/sockets/events.gateway.ts:97-105`, `server/src/sockets/events.gateway.ts:138-149`, `server/src/sockets/events.gateway.ts:168`.

Failure cases:
- Unauthorized socket returns an error event, Asta marks the turn failed, no REST fallback.
- Socket says "Still answering your previous message", UI fails the turn rather than retrying/queuing.
- Connection loss is modeled as an error event and completes the Observable, so fallback is inconsistent.

Recommended fix:
- Treat terminal socket error events as Observable errors when fallback is appropriate, or explicitly call REST fallback from `case 'error'`.
- Separate user-actionable errors like "message too long" from transport/auth errors.

### P0 - Asta OS tab/history race can lose or misplace live responses

Symptoms:
- User reported chatbot result appearing in another tab / next tab.

Evidence:
- Switching and creating tabs are disabled while busy, but closing a tab is not disabled: `client/src/app/features/asta-os/asta-os.component.ts:146-153`.
- `closeTab()` does not check `busy()`: `client/src/app/features/asta-os/asta-os.component.ts:576-590`.
- Loading a session from history does not check `busy()` and does not persist the active tab before replacing `turns`: `client/src/app/features/asta-os/asta-os.component.ts:619-643`.
- The stream callback mutates the original `asta` turn object while `turns` may now point at a different tab/session: `client/src/app/features/asta-os/asta-os.component.ts:515-519`, `client/src/app/features/asta-os/asta-os.component.ts:904-934`.

Failure cases:
- User sends a prompt, opens history, selects another session before the stream finishes. The live answer can be orphaned or invisible.
- User closes the active tab while a response streams. The backend completes, but the UI has moved to another tab.
- Current live tab content can be lost because `loadSession()` replaces `turns` without `persistActiveTab()`.

Recommended fix:
- Disable close/history-load while busy, or bind each stream to a stable tab id and write results back to that tab only.
- Persist active tab before loading a history session.
- Add tests for send -> load history during stream and send -> close active tab.

## History and session naming

### P1 - History panels can silently show empty content

Evidence:
- Asta OS history loads sessions and hides errors by only clearing loading state: `client/src/app/features/asta-os/asta-os-history.component.ts:188-193`.
- Asta OS search hides errors the same way: `client/src/app/features/asta-os/asta-os-history.component.ts:154-167`.
- Legacy tutor history also hides list errors by only clearing `historyLoading`: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:393-402`.
- `getMessages()` returns an empty array for invalid session IDs instead of a visible not-found error: `server/src/modules/agents/core/agent-session.service.ts:206-213`.

Failure cases:
- 401/403/network issue looks like "no history" instead of an error.
- Bad session id opens a blank chat.
- A session with only a failed user message can appear but contain no assistant answer.

Recommended fix:
- Add explicit history error states and retry actions.
- Return 404/403 for invalid or inaccessible session IDs.
- Preserve partial failed sessions visibly with status.

### P1 - Session names are not correct/semantic

Evidence:
- New sessions default to "New session": `server/src/modules/agents/schemas/agent-session.schema.ts:16-17`.
- Session title is set only after assistant message is saved: `server/src/modules/agents/core/agent-session.service.ts:253-277`.
- Title is only the first user message truncated to 60 chars: `server/src/modules/agents/core/agent-session.service.ts:284-290`.
- Asta OS tab title is only the first user turn truncated to 26 chars: `client/src/app/features/asta-os/asta-os.component.ts:612-616`.

Failure cases:
- If agent fails before assistant message, session stays "New session".
- "Add system design roadmap to roadmap screen" becomes a poor title even if the actual useful title should be "System Design Roadmap".
- Long prompts, attachments, or commands create unreadable duplicate titles.

Recommended fix:
- Generate session titles immediately from first user message with deterministic cleanup.
- Later upgrade to LLM/heuristic semantic titles after first assistant response.
- Add a backend endpoint for manual/automatic retitle and update all history panels.

## AI as central update layer

### P1 - Asta cannot update "everything" from natural language

Symptoms:
- Pasted transcript shows Asta generated a System Design roadmap in chat, but when asked to add it to the roadmap screen, it only replied with suggestions. It did not create a roadmap entity.

Evidence:
- Agent tools registered for LLM use are read-only only: `server/src/modules/agents/core/agent-tools.ts:7-8`, `server/src/modules/agents/core/tool-augmentation.service.ts:23-24`.
- Write operations happen through regex chat commands, not general agent tool calls: `server/src/modules/agents/core/chat-command-registry.service.ts:77-101`.
- First matching command wins, so one message can do only one write: `server/src/modules/agents/core/chat-command-registry.service.ts:72-81`.
- Roadmap chat commands cover mark complete, reopen, refocus, advance, and restore; they do not create a new parallel roadmap from a generated plan: `server/src/modules/roadmap/roadmap-chat-commands.ts:30-139`.

Failure cases:
- "I learned X already, update everything" updates at most one recognized domain.
- "Add this new roadmap" does not create a roadmap unless it matches existing generation flow.
- Agent text can claim or imply next steps but no domain write occurred.

Recommended fix:
- Add an explicit central "state mutation planner" for Asta with typed commands, preview, confirmation, execution, and post-commit refresh events.
- Add write tools for roadmap creation/update, daily plan refresh, course progress, mistakes, profile skill state, notes, and dashboard invalidation.
- Add command result receipts so UI can show exactly what changed.

### P1 - Dependent screens do not update after one domain changes

Evidence:
- Daily plan `getToday()` returns the already persisted plan for the date instead of rebuilding it after roadmap changes: `server/src/modules/daily-plan/daily-plan.service.ts:50-55`.
- Daily plan regeneration only happens on explicit generate/recalculate: `server/src/modules/daily-plan/daily-plan.service.ts:346-347`, `client/src/app/features/today/today.component.ts:314-318`.
- Daily plan generation reads roadmap state only when generating: `server/src/modules/daily-plan/daily-plan.service.ts:74-87`, `server/src/modules/daily-plan/daily-plan.service.ts:176-186`.
- Roadmap week completion emits a progression event, but the handler only creates a notification: `server/src/modules/roadmap/roadmap.service.ts:209-219`, `server/src/modules/progression/progression.service.ts:47-63`.
- Dashboard loads dependent slices once and ignores most GET errors: `client/src/app/features/dashboard/dashboard.component.ts:523-541`.
- Dashboard week toggle refreshes roadmap and intelligence only, not Today/next action/readiness/course/reviews: `client/src/app/features/dashboard/dashboard.component.ts:459-474`.

Failure cases:
- Asta marks roadmap week complete, but Today still shows that week as the next task.
- Dashboard "next move" remains stale after chat command.
- Daily plan item completion does not update the original roadmap/flow/mistake unless a separate command does it.

Recommended fix:
- Introduce domain events for roadmap updated, daily plan invalidated, course progress changed, profile skill changed, etc.
- Invalidate/regenerate Today when roadmap/current-week changes.
- Push an app-wide refresh event through socket or client state store so visible screens reload relevant slices.

### P2 - Roadmap task completion does not affect roadmap percentage

Evidence:
- `computeProgress()` uses completed weeks divided by total weeks only: `server/src/modules/roadmap/roadmap.service.ts:659-663`.
- `completedTasks` are stored but not part of percentage: `server/src/modules/roadmap/roadmap.service.ts:190-200`.

Failure cases:
- User completes every task in a week but progress percentage does not move.
- Today/roadmap/dashboard may disagree about "done" vs "progress".

Recommended fix:
- Define a consistent progress model: week-only, task-weighted, or both, and reflect it consistently in all UI.

## Chatbot/Asta assistant issues

### P1 - Legacy tutor workspace has no REST fallback

Evidence:
- Tutor workspace streams through `agent.stream(...)`: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:471-486`.
- Stream error only marks the assistant failed; it does not call `agent.send()` fallback: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:657`.

Failure cases:
- Socket auth/connectivity issue breaks tutor chat even though REST endpoint is available.
- User sees a failed assistant message with no recovery except manual retry.

Recommended fix:
- Reuse Asta OS fallback logic after fixing terminal error handling.

### P2 - Asta OS history session load can overwrite current unsaved tab

Evidence:
- `loadSession()` directly replaces `this.turns` and `this.sessionId`: `client/src/app/features/asta-os/asta-os.component.ts:619-643`.
- It does not call `persistActiveTab()` first.

Failure cases:
- User has a local tab with turns, opens history, selects a session, and the previous tab's live turns are lost from the tab list.

Recommended fix:
- Persist active tab before replacing it or open selected history in a new tab.

## Ecosystem screens

### P1 - Mentors and Mentor Sessions are a partial workflow

Evidence:
- `/app/mentor-sessions` reuses `MentorsComponent` and infers tab from current URL in the constructor: `client/src/app/features/mentor-marketplace/mentors.component.ts:171-172`.
- Mentor list returns every profile; `visibility` is saved but not used as a list filter: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:60-65`, `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:86-91`.
- Request session has no self-request prevention, duplicate prevention, slot validation, or payment/schedule handling: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:103-119`.
- Backend supports mentor notes, but the component only displays notes and has no add-notes UI: `client/src/app/core/services/mentor-marketplace.service.ts:49`, `client/src/app/features/mentor-marketplace/mentors.component.ts:83`.
- Status update has no strict state machine; mentors can set status directly: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:152-175`.
- List/session GET errors only stop loading with no visible error: `client/src/app/features/mentor-marketplace/mentors.component.ts:170-177`.

Failure cases:
- Org-only mentor profiles leak into public list.
- Student requests the same mentor repeatedly.
- Session can jump from requested to completed without acceptance.
- Mentor cannot add completion notes from the advertised UI.

Recommended fix:
- Add visibility/org filters, duplicate/self checks, state transition validation, schedule/payment model, and notes UI.

### P1 - Marketplace "Use template" does not clone anything

Evidence:
- Backend `use()` increments usage and returns content/route only: `server/src/modules/marketplace/marketplace.service.ts:120-136`.
- Client navigates to the route and does not pass or create the returned content: `client/src/app/features/marketplace/marketplace.component.ts:111-112`.

Failure cases:
- User clicks Use on a roadmap/course/quiz template, lands on a generic page, and no asset exists.
- Usage count increases even if the user abandons the flow.

Recommended fix:
- Implement type-specific clone endpoints or pass a template id into creation screens and materialize the asset.

### P1 - Creator Studio creates thin, non-type-specific templates

Evidence:
- Create form stores only `{ goal }` as content regardless of template type: `client/src/app/features/creator-studio/creator-studio.component.ts:115-119`.
- Admin pending queue only loads once in constructor if `auth.user()` is already admin: `client/src/app/features/creator-studio/creator-studio.component.ts:105-113`.
- GET errors for mine/pending are swallowed: `client/src/app/features/creator-studio/creator-studio.component.ts:112-113`.

Failure cases:
- "Course" template has no course modules.
- "Quiz" template has no questions.
- Admin queue can appear empty if user state loads after component construction.

Recommended fix:
- Add schema/content builders per template type.
- Load admin queue reactively when user role becomes admin.
- Show load errors.

### P1 - Institution screen is not available to students and has misleading data behavior

Evidence:
- Sidebar exposes Institution to students: `client/src/app/core/constants/nav.ts:120`.
- Backend restricts Institution to Admin/Mentor: `server/src/modules/institution/institution.controller.ts:16`.
- Overview processes at most 40 students but reports totals from processed outcomes, not all cohort members: `server/src/modules/institution/institution.service.ts:43`, `server/src/modules/institution/institution.service.ts:76-97`.
- Assign flow/template only posts a cohort announcement; it does not assign a real asset: `server/src/modules/institution/institution.service.ts:149-164`.
- Missing readiness data is converted to readiness 0 and at-risk true: `server/src/modules/institution/institution.service.ts:176-204`.

Failure cases:
- Student sees unauthorized.
- Large institution totals are undercounted.
- "Assign" appears successful but no flow/template is actually assigned.
- Data outage makes learners look at-risk.

Recommended fix:
- Hide Institution for students.
- Separate "processed sample" from "total enrolled".
- Implement real assignment records.
- Represent missing readiness as "insufficient data" instead of risk.

## Account/platform screens

### P1 - Developer screen can throw invalid ObjectId when org context is missing

Evidence:
- Developer controller passes `org.organizationId ?? ''`: `server/src/modules/developer/developer.controller.ts:77-97`.
- Developer service constructs `new Types.ObjectId(orgId)`: `server/src/modules/developer/developer.service.ts:36-60`.

Failure cases:
- User has permission but no active org context; backend can throw an invalid ObjectId/cast error.

Recommended fix:
- Validate org context at controller boundary and return a clean 400/403.

### P1 - Integrations calendar download likely 401s and uses generic events

Evidence:
- Calendar URL is a direct anchor to API base: `client/src/app/core/services/integration.service.ts:54-56`.
- Angular auth interceptor does not attach bearer tokens to plain anchor navigation.
- Calendar endpoint is not marked public in controller: `server/src/modules/integrations/integrations.controller.ts:108-114`.
- Calendar events are generic "Asta study block - day N" instead of user plan data: `server/src/modules/integrations/integrations.controller.ts:108-121`, `server/src/modules/integrations/integrations.service.ts:123-131`.

Failure cases:
- User clicks calendar export and gets unauthorized/download failure.
- Exported calendar does not reflect Today, roadmap, or actual schedule.

Recommended fix:
- Use a signed download token or fetch blob through authenticated HttpClient.
- Generate events from Daily Plan / roadmap schedule.

### P1 - Data export is marked ready immediately and download URL is origin-fragile

Evidence:
- Export job is created with `status: 'ready'` immediately: `server/src/modules/data-governance/data-governance.service.ts:69-78`.
- UI shows "Export ready" immediately: `client/src/app/features/platform/data-governance.component.ts:105-113`.
- `apiUrl()` rewrites `/api` to `/api`, not to `environment.apiBaseUrl`: `client/src/app/features/platform/data-governance.component.ts:90-92`.

Failure cases:
- If frontend and API origins differ, download link points to frontend origin.
- User sees async-job UI but there is no real generated file artifact.

Recommended fix:
- Either make export explicitly synchronous or implement real job processing.
- Use API base URL or signed download URL.

### P2 - Security current device can be wrong

Evidence:
- Sessions list marks the most recent session as current, not the token's actual session: `server/src/modules/sessions/sessions.service.ts:57-68`.

Failure cases:
- User revokes the wrong device.
- Multi-device users see "current" move based on lastSeen ordering.

Recommended fix:
- Store session id/jti in token and match it to the session row.

### P2 - Billing has mock/default behavior and lifecycle gaps

Evidence:
- Billing UI says mock checkout/test mode: `client/src/app/features/billing/billing.component.ts:10`, `client/src/app/features/billing/billing.component.ts:184`.
- Free subscription `startedAt` falls back to `new Date()` on every call when no subscription exists: `server/src/modules/billing/services/billing.service.ts:82-94`.
- Cancel sets `cancelAtPeriodEnd` and `status = 'canceled'`, but no scheduled downgrade job is shown here: `server/src/modules/billing/services/billing.service.ts:234-247`.
- Mock payment provider activates instantly: `server/src/modules/billing/providers/mock-payment.provider.ts:12-40`.

Failure cases:
- Free plan start date changes every reload.
- Cancel copy says period-end behavior but entitlement downgrade may not happen automatically.
- In local/dev, upgrades look successful without a real payment provider.

Recommended fix:
- Persist a free subscription row or expose no start date for free users.
- Add scheduled period-end downgrade enforcement.
- Make mock/live state highly visible.

### P2 - Offline & Sync is mostly local snapshot plumbing

Evidence:
- Offline service stores read-only payload snapshots in IndexedDB: `client/src/app/core/services/offline.service.ts:30-57`.
- Offline toggle is only found on roadmap detail in current search: `client/src/app/features/roadmap/roadmap-details.component.ts:81`.
- Offline page copy says use the toggle on roadmap, flow, or notes pages: `client/src/app/features/platform/offline.component.ts:58`.
- Sync queue uses raw fetch with the current access token only; no refresh path: `client/src/app/core/services/sync-queue.service.ts:82-98`.

Failure cases:
- User expects flows/notes offline toggles but cannot find them.
- Queued mutations fail after token expiry and are eventually dropped after retries.
- Saved payload exists, but the app route/assets still need enough PWA support to render offline.

Recommended fix:
- Add offline toggles to promised screens or adjust copy.
- Use refresh-aware authenticated send for sync queue.
- Add offline render paths for saved resources.

### P2 - Profile name update does not update auth user display

Evidence:
- Profile save updates only student profile service: `client/src/app/features/profile/profile.component.ts:454-467`.
- Student profile update updates `StudentProfile`, not the `User` name: `server/src/modules/student-profile/student-profile.service.ts:86-99`.
- Profile form falls back to `auth.user()?.name`: `client/src/app/features/profile/profile.component.ts:425-444`.

Failure cases:
- User changes full name, profile saves, but header/sidebar/auth-derived name remains old until a session reload or separate user update.

Recommended fix:
- Decide whether fullName and user.name are separate fields. If same, update both and refresh auth user signal.

### P2 - Certificates copy action copies only ID, not a full verification URL

Evidence:
- Verify link is `/certificate/verify/:id`, but copy writes only the verification id: `client/src/app/features/certificates/certificates.component.ts:59-60`, `client/src/app/features/certificates/certificates.component.ts:117-120`.

Failure case:
- User shares an ID without the verification URL.

Recommended fix:
- Copy full absolute verification URL.

## General silent-error pattern

Screens with swallowed or weak GET error handling:
- Asta OS history list/search: `client/src/app/features/asta-os/asta-os-history.component.ts:154-167`, `client/src/app/features/asta-os/asta-os-history.component.ts:188-193`.
- Legacy tutor history list: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:393-402`.
- Dashboard dependent panels: `client/src/app/features/dashboard/dashboard.component.ts:523-541`.
- Mentors list/sessions/profile: `client/src/app/features/mentor-marketplace/mentors.component.ts:170-181`.
- Creator Studio mine/pending: `client/src/app/features/creator-studio/creator-studio.component.ts:112-113`.
- Developer events/keys/webhooks/deliveries: `client/src/app/features/platform/developer.component.ts:136-146`.
- Privacy settings load: `client/src/app/features/privacy/privacy.component.ts:78`.
- Integrations list: `client/src/app/features/platform/integrations.component.ts:112-116`.

Failure cases:
- Empty cards/tabs appear as "no data" instead of "failed to load".
- Users report "content inside was not occurring".
- Console has 401/403/network errors but UI gives no explanation.

Recommended fix:
- Standardize `loading/error/empty` states for every data surface.
- Show forbidden, unauthenticated, offline, and server-down separately.
- Stop swallowing GET errors on account/platform pages.

## Mock/provider configuration risks

These are not all bugs, but they explain "mock data being thrown" if live providers are not configured.

Evidence:
- AI provider chain always has mock fallback; mock provider returns an offline demo placeholder for text: `server/src/modules/ai/providers/mock-ai.provider.ts:10-39`.
- Structured generation can use `mockFactory()` outputs: `server/src/modules/ai/providers/mock-ai.provider.ts:56-61`.
- Payment provider defaults to mock when live payment is not enabled: `server/src/modules/billing/billing.module.ts:28-67`.
- Voice provider defaults to mock unless realtime voice and OpenAI key are configured: `server/src/modules/voice/voice.module.ts:25-52`.

Failure cases:
- Asta replies with offline placeholder if no live LLM responds.
- Roadmaps/courses/flows may be deterministic fallback output, not real model output.
- Billing upgrades can look real in mock mode.
- Voice room remains browser/mock mode.

Recommended fix:
- Add a visible environment/provider status indicator for admins and possibly users.
- Add seeded/mock labels where data is deterministic fallback.
- Add smoke test that fails staging/prod if AI/payment providers are accidentally mock.

## Concrete navigation bug

### P1 - Dashboard course resume link targets a missing route

Evidence:
- Dashboard links to `/app/courses/:id`: `client/src/app/features/dashboard/dashboard.component.ts:123`.
- Router defines `/app/course-builder` and `/app/course-builder/:id`: `client/src/app/app.routes.ts:210-217`.

Failure case:
- Clicking Continue course from dashboard can navigate to a missing route.

Recommended fix:
- Change dashboard link to `['/app/course-builder', cc.id]`.

## Suggested issue backlog

1. Implement refresh-token retry flow and socket token refresh handling.
2. Permission-gate sidebar and routes for Institution, Developer, and other org/admin-only pages.
3. Fix Asta stream error fallback and tab/history race cases.
4. Add semantic/session title generation and error-visible history panels.
5. Add central Asta write orchestration with typed mutations, preview/confirm, execution receipts, and app-wide invalidation.
6. Add domain propagation: roadmap updates should refresh/invalidate Today, dashboard next action, learning intelligence, and any visible dependent surfaces.
7. Complete Marketplace clone and Creator Studio type-specific template content.
8. Complete Mentor Sessions workflow: notes UI, status transitions, scheduling/payment/duplicates.
9. Complete Institution assignments and correct sampled-vs-total reporting.
10. Fix Integrations calendar authenticated export and real plan events.
11. Fix Data export URL/job semantics.
12. Fix Dashboard course link.
13. Add consistent loading/error/empty states across Ecosystem and Account screens.
14. Add automated tests for auth expiry, forbidden screens, Asta stream fallback, history loading, roadmap-to-today propagation, and marketplace clone.

## QA scenarios to reproduce after fixes

1. Log in, manually expire the access token, navigate between `/app/marketplace`, `/app/developer`, `/app/institution`, and `/app/today`; verify refresh or clean forbidden states.
2. Open Asta OS, send a prompt, attempt to close tab/load history mid-stream; verify result remains attached to the original tab or action is disabled.
3. Ask Asta: "I already learned week 2, update everything"; verify roadmap, Today, dashboard next action, and intelligence all update or show a receipt explaining what did not change.
4. Ask Asta to create a new System Design roadmap; verify a real roadmap record exists and appears in roadmap list/history.
5. Click Marketplace "Use" for each template type and verify a real asset is created.
6. Use Institution assign flow/template and verify learners receive an actual assigned item, not only an announcement.
7. Download calendar export from Integrations while authenticated; verify no 401 and events match the learner's actual plan.
8. Request data export from a separately hosted frontend; verify download URL points to the API and returns the export.
9. Open every Ecosystem and Account route as student, mentor, admin, and org manager; verify sidebar visibility and backend authorization agree.

## Second pass - expanded line-by-line static audit

User follow-up: the first file was only 495 lines and not deep enough for the requested "go through each and every line by line" audit. This addendum expands the inventory from a shallow issue summary into a file-by-file and screen-by-screen failure list.

Important limitation:
- I still could not run Angular/Nest builds in this shell because `node.exe` is not on PATH.
- Therefore this second pass is a static source audit, not a compiled/runtime proof.
- Items marked "estimated" are credible failure cases from source flow, but still need runtime reproduction.
- Items marked "confirmed from source" directly follow from code line references.

### Source inventory checked in the second pass

- `client/src/app/app.routes.ts`: 583 lines.
- `client/src/app/core/constants/nav.ts`: student and workspace sidebar route map.
- `client/src/app/core/interceptors/error.interceptor.ts`: global auth failure behavior.
- `client/src/app/core/interceptors/auth-token.interceptor.ts`: access-token injection.
- `client/src/app/core/guards/auth.guard.ts`: route auth gate.
- `client/src/app/core/services/auth.service.ts`: token storage and session restoration.
- `client/src/app/core/services/socket.service.ts`: streaming socket event conversion.
- `client/src/app/core/services/voice-command-router.service.ts`: voice-to-route command routing.
- `client/src/app/layout/shell.component.ts`: shell-level feature flag and entitlement loading.
- `client/src/app/features/asta-os/asta-os.component.ts`: 906 lines.
- `client/src/app/features/ai-tutor/tutor-workspace.component.ts`: 619 lines.
- `client/src/app/features/agent-workspace/agent-workspace.component.ts`: shared Mentor Room, Doubt Solver, Career Coach, Study Notes screen.
- `client/src/app/features/asta-os/asta-os-history.component.ts`: session history UI.
- `client/src/app/features/dashboard/dashboard.component.ts`: 514 lines.
- `client/src/app/features/today/today.component.ts`: 388 lines.
- `client/src/app/features/roadmap/roadmap-details.component.ts`: 842 lines.
- `client/src/app/features/flows/flow-detail.component.ts`: 733 lines.
- `client/src/app/features/knowledge-hub/knowledge-hub.component.ts`: 764 lines.
- `client/src/app/features/quiz-studio/quiz-studio.component.ts`: 755 lines.
- `client/src/app/features/project-studio/project-studio.component.ts`: 572 lines.
- `client/src/app/features/course-builder/course-detail.component.ts`: line-level subscription and action flow scanned.
- `client/src/app/features/spaces/space-detail.component.ts`: line-level subscription and action flow scanned.
- `client/src/app/features/visuals/visuals-list.component.ts`: status/list/generate flow scanned.
- `client/src/app/features/visuals/visual-detail.component.ts`: regenerate/delete/export flow scanned.
- `client/src/app/features/simulations/simulation-detail.component.ts`: respond/finish/retry/repair flow scanned.
- `client/src/app/features/voice/voice-room.component.ts`: session list, rename, delete, turn, derived asset creation scanned.
- `client/src/app/features/workflows/workflows.component.ts`: workflow status and run flow scanned.
- `client/src/app/features/mistakes/mistakes.component.ts`: 596 lines.
- `client/src/app/features/skill-twin/skill-twin.component.ts`: 337 lines.
- `client/src/app/features/mentor-council/mentor-council.component.ts`: council generation flow scanned.
- `client/src/app/features/replay/replay.component.ts`: replay generation flow scanned.
- `client/src/app/features/skill-passport/skill-passport.component.ts`: 337 lines.
- `client/src/app/features/career-readiness/career-readiness.component.ts`: readiness analysis flow scanned.
- `client/src/app/features/outcome-council/outcome-council.component.ts`: outcome council flow scanned.
- `client/src/app/features/portfolio/portfolio.component.ts`: publish/generate/profile flow scanned.
- `client/src/app/features/interview/interview.component.ts`: 381 lines.
- `client/src/app/features/resume/resume.component.ts`: resume generation/save flow scanned.
- `client/src/app/features/applications/applications.component.ts`: 381 lines.
- `client/src/app/features/mentor-marketplace/mentors.component.ts`: 196 lines.
- `client/src/app/features/marketplace/marketplace.component.ts`: 110 lines.
- `client/src/app/features/creator-studio/creator-studio.component.ts`: 121 lines.
- `client/src/app/features/institution/institution.component.ts`: 179 lines.
- `client/src/app/features/certificates/certificates.component.ts`: 115 lines.
- `client/src/app/features/billing/billing.component.ts`: 448 lines.
- `client/src/app/features/platform/offline.component.ts`: 149 lines.
- `client/src/app/features/platform/integrations.component.ts`: 229 lines.
- `client/src/app/features/platform/developer.component.ts`: 207 lines.
- `client/src/app/features/platform/security.component.ts`: 108 lines.
- `client/src/app/features/platform/data-governance.component.ts`: 118 lines.
- `client/src/app/features/privacy/privacy.component.ts`: 99 lines.
- `client/src/app/features/profile/profile.component.ts`: 446 lines.
- `server/src/modules/agents/agent-orchestrator.service.ts`: 327 lines.
- `server/src/modules/agents/core/agent-session.service.ts`: 288 lines.
- `server/src/modules/agents/core/chat-command-registry.service.ts`: 102 lines.
- `server/src/modules/agents/core/context-engine.service.ts`: 455 lines.
- `server/src/modules/agents/core/agent-tools.ts`: 64 lines.
- `server/src/modules/agents/core/tool-augmentation.service.ts`: 86 lines.
- `server/src/modules/roadmap/roadmap.service.ts`: 627 lines.
- `server/src/modules/roadmap/roadmap-chat-commands.ts`: 139 lines.
- `server/src/modules/daily-plan/daily-plan.service.ts`: 465 lines.
- `server/src/modules/progression/progression.service.ts`: 63 lines.
- `server/src/modules/learning-intelligence/learning-intelligence.service.ts`: 457 lines.
- `server/src/modules/flows/flows.service.ts`: 565 lines.
- `server/src/modules/projects/services/projects.service.ts`: 449 lines.
- `server/src/modules/course-builder/course-builder.service.ts`: 296 lines.
- `server/src/modules/assessment/services/assessment.service.ts`: 492 lines.
- `server/src/modules/skill-passport/skill-passport.service.ts`: 496 lines.
- `server/src/modules/community/services/community.service.ts`: 476 lines.
- `server/src/modules/cohort/services/cohort.service.ts`: 361 lines.
- `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts`: 210 lines.
- `server/src/modules/marketplace/marketplace.service.ts`: 174 lines.
- `server/src/modules/institution/institution.service.ts`: 198 lines.
- `server/src/modules/developer/developer.service.ts`: 223 lines.
- `server/src/modules/integrations/integrations.service.ts`: 455 lines.
- `server/src/modules/data-governance/data-governance.service.ts`: 135 lines.
- `server/src/modules/sessions/sessions.service.ts`: 86 lines.
- `server/src/modules/billing/services/billing.service.ts`: 397 lines.
- `server/src/modules/privacy/privacy.service.ts`: 91 lines.
- `server/src/modules/student-profile/student-profile.service.ts`: 93 lines.
- `server/src/modules/voice/voice.service.ts`: scanned for mock/live voice behavior.
- `server/src/modules/visuals/visuals.module.ts`: scanned for image provider fallback.
- `server/src/modules/practice/practice.service.ts`: scanned for code execution fallback.

### Global static scan results

- Confirmed from source: many screen loads use `subscribe` with `error: () => undefined` or no user-visible error.
- Confirmed from source: several screens intentionally rely on mock/fallback providers.
- Confirmed from source: sidebar route availability is not aligned with backend authorization.
- Confirmed from source: Asta can update a roadmap through chat commands, but there is no app-wide mutation bus that refreshes every dependent surface.
- Confirmed from source: several navigation commands and screen buttons route correctly, but dependent state is not reloaded after cross-domain mutations.
- Estimated: some screens will appear "blank" rather than broken because failed secondary calls are swallowed.
- Estimated: unauthorized console noise while moving screens is a mix of expired-token handling and visible links to forbidden screens.

### Second-pass top priority issues

#### P0-A - Token refresh is still the first systemic crash suspect

Evidence already listed:
- `client/src/app/core/guards/auth.guard.ts:6-10`.
- `client/src/app/core/interceptors/error.interceptor.ts:21-23`.
- `client/src/app/core/services/auth.service.ts:20-23`.
- `client/src/app/core/services/auth.service.ts:77-83`.
- `server/src/modules/auth/auth.controller.ts:119-121`.

Additional failure cases:
- A user keeps Asta OS open for a long session, token expires, then switches to Today.
- Today loads protected plan endpoint and returns 401.
- Error interceptor clears session.
- The route switch looks like a screen crash, even though it is auth expiry.
- A WebSocket may receive a terminal unauthorized event, but the frontend does not refresh/reconnect.
- Multiple parallel page calls after wake-from-sleep can all fail and all trigger logout behavior.

Fix expectation:
- A refresh-token retry interceptor must be installed before the global 401 logout behavior.
- It should queue parallel requests while refresh is in flight.
- It should retry the original request once.
- It should clear session only after refresh fails.
- Socket connect/auth errors should reuse the same token freshness policy.

#### P0-B - Sidebar permission visibility is still not aligned with backend guards

Confirmed from source:
- Student nav always includes `Institution`: `client/src/app/core/constants/nav.ts:120`.
- Student nav always includes `Developer`: `client/src/app/core/constants/nav.ts:130`.
- Backend Institution controller is role-gated to admin/mentor: `server/src/modules/institution/institution.controller.ts:16`.
- Backend Developer controller requires `Permission.OrgManage`: `server/src/modules/developer/developer.controller.ts:63`.
- Developer screen loads protected endpoints immediately: `client/src/app/features/platform/developer.component.ts:136-146`.

Additional failure cases:
- Normal student opens Institution from sidebar and receives forbidden.
- Normal student opens Developer from sidebar and triggers multiple forbidden API calls.
- Feature-flag calls in shell are swallowed, so the sidebar may not visibly communicate permission state.
- If the global 401/403 behavior is too broad, forbidden looks like unauthorized app instability.

Fix expectation:
- Sidebar items need role/permission predicates.
- Routes need client guards matching server guards.
- Forbidden screens need an explicit "not available for your role" state.

#### P0-C - Asta stream terminal errors still bypass proper fallback in all chat surfaces

Confirmed from source:
- Socket service completes on `type: 'error'`: `client/src/app/core/services/socket.service.ts:62-69`.
- Asta OS fallback only runs on Observable `error`: `client/src/app/features/asta-os/asta-os.component.ts:515-519`.
- Asta OS `case 'error'` fails the assistant message: `client/src/app/features/asta-os/asta-os.component.ts:933-934`.
- AI Tutor stream `case 'error'` fails the assistant message: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:657-661`.
- Generic agent workspace stream `case 'error'` fails the assistant message: `client/src/app/features/agent-workspace/agent-workspace.component.ts:369-373`.
- Backend socket emits terminal error payloads: `server/src/sockets/events.gateway.ts:97-105`, `server/src/sockets/events.gateway.ts:138-149`, `server/src/sockets/events.gateway.ts:168`.

Screens affected:
- Asta OS.
- Classic AI Tutor.
- Mentor Room.
- Doubt Solver.
- Career Coach.
- Study Notes.

Failure cases:
- Unauthorized socket returns error event, not Observable error.
- Busy socket returns error event and the user gets a failed answer instead of queued retry.
- Long message returns error event and the UI shows only a generic failure.
- Backend orchestrator failure returns error event and no REST fallback is attempted.

Fix expectation:
- Convert transport/auth/orchestrator terminal stream errors into a fallback path.
- Keep validation errors like "message too long" as user-facing non-fallback errors.
- Add a common helper so Asta OS, AI Tutor, and Agent Workspace behave consistently.

#### P0-D - Central Asta updates are not central enough yet

Confirmed from source:
- Agent tools are read-only/supportive, not write orchestration: `server/src/modules/agents/core/agent-tools.ts:7-8`.
- Tool augmentation says tools are advisory context, not mutations: `server/src/modules/agents/core/tool-augmentation.service.ts:23-24`.
- Command registry takes the first matching command: `server/src/modules/agents/core/chat-command-registry.service.ts:72-81`.
- Roadmap chat commands can update roadmap only: `server/src/modules/roadmap/roadmap-chat-commands.ts:30-139`.
- Daily plan has its own command set, but dependencies are not globally reconciled.
- Context cache invalidates only the AI context snapshot: `server/src/modules/agents/core/context-engine.service.ts:166-177`.
- Dashboard and Today do not subscribe to a domain-level invalidation event after Asta mutations.

Failure cases:
- User says "I already learned this, update it".
- Roadmap progress/content changes.
- Today plan remains old unless manually recalculated.
- Dashboard next action remains old until reload.
- Learning Intelligence may remain old until its own endpoint recomputes.
- Skill Twin may remain old until manual refresh.
- Resume/Portfolio/Passport evidence remains old unless specific domain events are produced.

Fix expectation:
- Add a central Asta mutation pipeline with typed operations.
- Every operation should return affected domains, e.g. `roadmap`, `dailyPlan`, `dashboard`, `intelligence`, `skillTwin`, `ledger`.
- Backend should emit domain events after writes.
- Frontend should have an app-wide invalidation service that open screens can subscribe to.
- Asta response should include a receipt showing what was updated and what still needs confirmation.

### Route and sidebar coverage map

The router defines these student routes in `client/src/app/app.routes.ts`.

- `/app/dashboard`: `DashboardComponent`.
- `/app/tutor`: `TutorWorkspaceComponent`.
- `/app/mentor-room`: `AgentWorkspaceComponent` with `agentType: mentor`.
- `/app/doubt-solver`: `AgentWorkspaceComponent` with `agentType: doubt_solver`.
- `/app/career-coach`: `AgentWorkspaceComponent` with `agentType: career`.
- `/app/content-studio`: `AgentWorkspaceComponent` with `agentType: content_creator`.
- `/app/voice-room`: `VoiceRoomComponent`.
- `/app/workflows`: `WorkflowsComponent`.
- `/app/roadmap`: `RoadmapListComponent`.
- `/app/roadmap/generate`: `RoadmapGenerateComponent`.
- `/app/roadmap/:id`: `RoadmapDetailsComponent`.
- `/app/flows`: `FlowsListComponent`.
- `/app/flows/new`: `FlowsListComponent`.
- `/app/flows/:id`: `FlowDetailComponent`.
- `/app/today`: `TodayComponent`.
- `/app/spaces`: `SpacesListComponent`.
- `/app/spaces/:id`: `SpaceDetailComponent`.
- `/app/simulations`: `SimulationsListComponent`.
- `/app/simulations/:id`: `SimulationDetailComponent`.
- `/app/visuals`: `VisualsListComponent`.
- `/app/visuals/:id`: `VisualDetailComponent`.
- `/app/course-builder`: `CourseListComponent`.
- `/app/course-builder/:id`: `CourseDetailComponent`.
- `/app/peer-rooms`: `PeerRoomsListComponent`.
- `/app/peer-rooms/:id`: `PeerRoomDetailComponent`.
- `/app/knowledge`: `KnowledgeHubComponent`.
- `/app/resources`: `ResourcesComponent`.
- `/app/quizzes`: `QuizStudioComponent`.
- `/app/projects`: `ProjectStudioComponent`.
- `/app/progress`: `IntelligenceCockpitComponent`.
- `/app/mistakes`: `MistakesComponent`.
- `/app/skill-twin`: `SkillTwinComponent`.
- `/app/mentor-council`: `MentorCouncilComponent`.
- `/app/ledger`: `LedgerComponent`.
- `/app/skill-passport`: `SkillPassportComponent`.
- `/app/skill-passport/public-preview`: `PublicPassportComponent`.
- `/app/career-readiness`: `CareerReadinessComponent`.
- `/app/outcome-council`: `OutcomeCouncilComponent`.
- `/app/portfolio`: `PortfolioComponent`.
- `/app/interview`: `InterviewComponent`.
- `/app/interview/sessions/:id`: `InterviewComponent`.
- `/app/resume`: `ResumeComponent`.
- `/app/applications`: `ApplicationsComponent`.
- `/app/mentors`: `MentorsComponent`.
- `/app/mentor-sessions`: `MentorsComponent`.
- `/app/marketplace`: `MarketplaceComponent`.
- `/app/creator-studio`: `CreatorStudioComponent`.
- `/app/institution`: `InstitutionComponent`.
- `/app/replay`: `ReplayComponent`.
- `/app/cohorts`: `CohortsComponent`.
- `/app/live-sessions`: `LiveSessionsComponent`.
- `/app/community`: `CommunityComponent`.
- `/app/reports`: `ReportsComponent`.
- `/app/certificates`: `CertificatesComponent`.
- `/app/billing`: `BillingComponent`.
- `/app/offline`: `OfflineComponent`.
- `/app/security`: `SecurityComponent`.
- `/app/data`: `DataGovernanceComponent`.
- `/app/developer`: `DeveloperComponent`.
- `/app/integrations`: `IntegrationsComponent`.
- `/app/privacy`: `PrivacyComponent`.
- `/app/notifications`: `NotificationsComponent`.
- `/app/profile`: `ProfileComponent`.

Route mismatches found:
- Dashboard has a stale course route to `/app/courses/:id`: `client/src/app/features/dashboard/dashboard.component.ts:123`.
- Router only defines `/app/course-builder` and `/app/course-builder/:id`: `client/src/app/app.routes.ts:210-217`.
- Voice command routes for `doubt-solver`, `content-studio`, `progress`, `career-coach`, and `mentor-room` are valid in current router.
- Ecosystem and Account routes are present, but permissions and feature completeness differ heavily by screen.

### Screen-by-screen failure inventory - Learn group

#### Dashboard

Files:
- `client/src/app/features/dashboard/dashboard.component.ts`.
- `server/src/modules/roadmap/roadmap.service.ts`.
- `server/src/modules/daily-plan/daily-plan.service.ts`.
- `server/src/modules/learning-intelligence/learning-intelligence.service.ts`.

Confirmed issues:
- Stale course route: `client/src/app/features/dashboard/dashboard.component.ts:123`.
- Dashboard loads profile and active roadmap with forkJoin: `client/src/app/features/dashboard/dashboard.component.ts:526`.
- Daily plan, intelligence, active course, and project stats errors are swallowed or secondary: `client/src/app/features/dashboard/dashboard.component.ts:532-540`.
- Week complete updates only local roadmap and dashboard intelligence: `client/src/app/features/dashboard/dashboard.component.ts:466-474`.
- No app-wide refresh after Asta roadmap mutation.

Failure cases:
- Course CTA navigates to a missing route.
- Dashboard shows old Today item after Asta updates roadmap.
- Dashboard shows old weak topic after Asta updates learning progress elsewhere.
- Secondary panels silently disappear if their endpoints fail.
- A stale token during dashboard load logs user out.

Fix/test needs:
- Fix course URL.
- Add explicit error states for secondary panels.
- Subscribe to central learning-domain invalidation.
- Test dashboard after roadmap update, daily plan recalc, quiz submit, project submit.

#### Today

Files:
- `client/src/app/features/today/today.component.ts`.
- `server/src/modules/daily-plan/daily-plan.service.ts`.

Confirmed issues:
- Today loads the existing plan for the current date if present: `server/src/modules/daily-plan/daily-plan.service.ts:50-55`.
- Recalculation is explicit: `server/src/modules/daily-plan/daily-plan.service.ts:346-347`.
- Roadmap signal is read during generation only: `server/src/modules/daily-plan/daily-plan.service.ts:74-87`, `server/src/modules/daily-plan/daily-plan.service.ts:176-186`.
- Streak/history errors are swallowed: `client/src/app/features/today/today.component.ts:292-294`.
- Recalculate failure shows a toast, but there is no automatic recalculation after roadmap mutation: `client/src/app/features/today/today.component.ts:314-318`.

Failure cases:
- Asta updates roadmap, but Today keeps old item list.
- Carry-over may preserve tasks that are no longer relevant after roadmap replan.
- Streak/history panel can silently be missing.
- Browser timezone issues can create date boundary confusion if server/client pass no IANA zone consistently.

Fix/test needs:
- Invalidate daily plan on roadmap content/progress mutation or mark plan "needs recalculation".
- Add a visible "plan may be stale" state after Asta changes dependencies.
- Test India timezone date boundary and sleep/wake token expiry.

#### AI Tutor

Files:
- `client/src/app/features/ai-tutor/tutor-workspace.component.ts`.
- `server/src/modules/agents/core/agent-session.service.ts`.
- `server/src/modules/agents/agent-orchestrator.service.ts`.

Confirmed issues:
- History loading errors are swallowed into loading false: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:397-402`.
- Stream terminal event errors fail the assistant message: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:657-661`.
- There is no REST fallback in the classic tutor stream path.
- Feedback send has no error handler: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:603`.
- Regenerate/edit resend drops later messages locally before verifying backend state: `client/src/app/features/ai-tutor/tutor-workspace.component.ts:550-573`.

Failure cases:
- History tab appears but content does not occur because sessions call failed silently.
- Stream error shows failed assistant message instead of trying REST fallback.
- Editing and resending can make local view diverge from stored session history.
- Session title stays generic until assistant save logic runs.

Fix/test needs:
- Visible history load errors.
- Shared stream fallback helper.
- Persist branch/regenerate semantics or reload session after resend.
- Semantic session naming from first user intent and/or assistant summary.

#### Mentor Room, Doubt Solver, Career Coach, Study Notes

Files:
- `client/src/app/features/agent-workspace/agent-workspace.component.ts`.
- `client/src/app/app.routes.ts:90-108`.

Confirmed issues:
- All four screens share one component and one stream behavior.
- Route data reset clears messages and session on route data change: `client/src/app/features/agent-workspace/agent-workspace.component.ts:255-265`.
- Stream terminal event errors fail assistant message: `client/src/app/features/agent-workspace/agent-workspace.component.ts:369-373`.
- There is no visible history browser in this generic workspace.
- Feedback send has no error handler: `client/src/app/features/agent-workspace/agent-workspace.component.ts:337`.

Failure cases:
- Changing from Mentor Room to Career Coach drops local conversation.
- Stream errors appear as failed answer with no fallback.
- User cannot recover previous generic agent sessions from that screen.
- A central "update my app" command may be routed as text answer only, depending on command registry match.

Fix/test needs:
- Decide whether generic workspaces need persistent session history.
- Use the same naming/history/fallback rules as Asta OS.
- Add route-specific command capability receipts.

#### Roadmap

Files:
- `client/src/app/features/roadmap/roadmap-details.component.ts`.
- `server/src/modules/roadmap/roadmap.service.ts`.
- `server/src/modules/roadmap/roadmap-chat-commands.ts`.

Confirmed issues:
- Roadmap progress is computed from completed weeks only: `server/src/modules/roadmap/roadmap.service.ts:659-663`.
- Task completion is stored but does not move progress percentage: `server/src/modules/roadmap/roadmap.service.ts:190-200`, `server/src/modules/roadmap/roadmap.service.ts:659-663`.
- Week completion emits a progression event: `server/src/modules/roadmap/roadmap.service.ts:209-219`.
- Task completion does not appear to emit the same progression event.
- Roadmap versions snapshot content but not progress, intentionally.

Failure cases:
- User marks all tasks in a week but progress still reads 0% until the week is completed.
- Asta updates a roadmap week and old daily plan remains active.
- Restoring a version can preserve progress against surviving tasks, but dependent screens do not know to reload.
- Central Asta commands can update roadmap but not necessarily create all matching downstream artifacts.

Fix/test needs:
- Decide whether task completion should affect progress or show separate task progress.
- Emit events for task progress if dependent surfaces care.
- Invalidate Today, Dashboard, Intelligence, Skill Twin after roadmap writes.

#### Flow Studio

Files:
- `client/src/app/features/flows/flows-list.component.ts`.
- `client/src/app/features/flows/flow-detail.component.ts`.
- `server/src/modules/flows/flows.service.ts`.

Confirmed issues:
- Flow list load has explicit load error, but generation errors only toast: `client/src/app/features/flows/flows-list.component.ts:307-339`.
- Flow detail load has loadError: `client/src/app/features/flows/flow-detail.component.ts:421-427`.
- Node position save errors toast but the local drag may already look applied: `client/src/app/features/flows/flow-detail.component.ts:622-624`.
- Node notes save error toasts after local field interaction: `client/src/app/features/flows/flow-detail.component.ts:691-693`.
- Visual generation from a flow node is a dependent artifact but does not notify other screens: `client/src/app/features/flows/flow-detail.component.ts:726-732`.
- Recalculate has a toast but no central invalidation: `client/src/app/features/flows/flow-detail.component.ts:743-749`.

Failure cases:
- User drags a node, save fails, screen still appears changed until reload.
- User marks flow repair complete, Progress/Mistakes/Dashboard may not refresh.
- Asta adds a flow repair node, Today plan will not automatically include it unless recalculated.

Fix/test needs:
- Revert local node position on save failure or mark unsynced.
- Emit/consume flow mutation events.
- Add tests for flow repair to Today/Progress updates.

#### Visual Studio

Files:
- `client/src/app/features/visuals/visuals-list.component.ts`.
- `client/src/app/features/visuals/visual-detail.component.ts`.
- `server/src/modules/visuals/visuals.module.ts`.
- `server/src/modules/visuals/providers/image-provider.ts`.

Confirmed issues:
- Image provider is mock by default: `server/src/modules/visuals/visuals.module.ts:18-19`, `server/src/modules/visuals/providers/image-provider.ts:28-29`.
- Visual status call has no error handler in list constructor: `client/src/app/features/visuals/visuals-list.component.ts:188`.
- List load has loadError: `client/src/app/features/visuals/visuals-list.component.ts:198-200`.
- Generate updates local list but dependent screens do not receive an event: `client/src/app/features/visuals/visuals-list.component.ts:211-218`.

Failure cases:
- UI may imply image generation is real, but provider is mock/offline.
- Status call failure silently leaves `imageLive` default.
- Visual generated from flow/course/space exists but source screen may not update if navigated back.

Fix/test needs:
- Show provider state clearly.
- Add generated-artifact invalidation.
- Verify image provider setup in production config.

#### Study Spaces

Files:
- `client/src/app/features/spaces/spaces-list.component.ts`.
- `client/src/app/features/spaces/space-detail.component.ts`.

Confirmed issues:
- Space list has explicit loadError: `client/src/app/features/spaces/spaces-list.component.ts:117-120`.
- Detail load has explicit loadError: `client/src/app/features/spaces/space-detail.component.ts:155-159`.
- Source removal uses two-step confirm, but no loading/busy per source after final click: `client/src/app/features/spaces/space-detail.component.ts:180-188`.
- Derived artifacts flow/quiz/visual navigate away, but no central invalidation: `client/src/app/features/spaces/space-detail.component.ts:202-210`.
- Audio overview generation only updates local space: `client/src/app/features/spaces/space-detail.component.ts:195-197`.

Failure cases:
- User creates quiz from a space, Quiz Studio may not auto-select or refresh unless route query is handled.
- User creates visual from a space, Visual Studio must reload by route.
- Removing a source can fail after UI confirm with no local rollback issue if source was not pre-removed.

Fix/test needs:
- Add generated asset receipt and invalidation.
- Test query-parameter handoff to Quiz Studio/Visual Detail.

#### Simulations

Files:
- `client/src/app/features/simulations/simulations-list.component.ts`.
- `client/src/app/features/simulations/simulation-detail.component.ts`.
- `server/src/modules/simulations/simulation-coach.ts`.

Confirmed issues:
- Simulation list load has explicit loadError: `client/src/app/features/simulations/simulations-list.component.ts:216`.
- Start error toasts: `client/src/app/features/simulations/simulations-list.component.ts:222-224`.
- Detail respond/finish/retry/repair errors are handled with toasts: `client/src/app/features/simulations/simulation-detail.component.ts:143-159`.
- Simulation coach includes "Mock interview" deterministic copy: `server/src/modules/simulations/simulation-coach.ts:24`.

Failure cases:
- Simulation completion may produce skill/readiness updates but open Dashboard/Skill Passport/Readiness does not refresh automatically.
- Repair flow creation returns warning if no active flow, but Today is not recalculated after a repair exists.

Fix/test needs:
- Emit progression events on simulation finish.
- Add central invalidation for readiness, passport, mistakes, and dashboard.

#### Knowledge Hub

Files:
- `client/src/app/features/knowledge-hub/knowledge-hub.component.ts`.
- `client/src/app/features/knowledge-hub/components/knowledge-shard.component.ts`.
- `server/src/modules/rag/services/knowledge.service.ts`.

Confirmed issues:
- Knowledge component is large and multi-state, high risk for partial stale state.
- Shard component shows failed ingestion and retry/delete actions: `client/src/app/features/knowledge-hub/components/knowledge-shard.component.ts:76`.
- Server knowledge summary/audio/tagging have deterministic fallback behavior in RAG services.
- Agent context retrieval uses documents per turn, but cached profile/roadmap context is separate.

Failure cases:
- Document upload succeeds but downstream embeddings/fallback produce low-quality answers.
- User asks Asta to remember/update from a document; other screens do not know knowledge changed.
- History/search may appear empty if document list call fails.

Fix/test needs:
- Add visible provider/fallback labels for AI generated summaries/audio.
- Emit knowledge changed event to agent context invalidation.
- Test failed ingestion retry and Asta grounding.

#### Resources

Files:
- `client/src/app/features/resources/resources.component.ts`.

Confirmed issues:
- For You load error only clears loading: `client/src/app/features/resources/resources.component.ts:282-284`.
- Library load has no error handler: `client/src/app/features/resources/resources.component.ts:286`.
- Catalog error sets empty list and loading false: `client/src/app/features/resources/resources.component.ts:299-301`.
- Library refresh after progress update can run without error handler: `client/src/app/features/resources/resources.component.ts:325`.

Failure cases:
- Catalog failure looks like no resources.
- Library failure silently hides saved resources.
- Asta-updated roadmap/topic does not automatically refresh recommendations.

Fix/test needs:
- Separate empty from error states.
- Refresh recommendations after roadmap/skill twin changes.

#### Quizzes

Files:
- `client/src/app/features/quiz-studio/quiz-studio.component.ts`.
- `server/src/modules/assessment/services/assessment.service.ts`.

Confirmed issues:
- Knowledge docs list has no error handler: `client/src/app/features/quiz-studio/quiz-studio.component.ts:533`.
- Quiz list/stats failures set loadError: `client/src/app/features/quiz-studio/quiz-studio.component.ts:547-554`.
- Attempts load error is swallowed: `client/src/app/features/quiz-studio/quiz-studio.component.ts:558`.
- Attempt history load failure only stops spinner: `client/src/app/features/quiz-studio/quiz-studio.component.ts:589-591`.
- Submit errors are handled with toast: `client/src/app/features/quiz-studio/quiz-studio.component.ts:756-766`.

Failure cases:
- Attempts/history tab appears empty when endpoint failed.
- Query param from space/voice/course generated quiz may not refresh if component already loaded.
- Quiz completion should update mistakes/intelligence/passport but open screens do not refresh.

Fix/test needs:
- Visible attempts/history error.
- Test generated quiz deep link.
- Emit quiz graded event and consume across dashboard/intelligence/skill twin.

#### Projects

Files:
- `client/src/app/features/project-studio/project-studio.component.ts`.
- `server/src/modules/projects/services/projects.service.ts`.
- `server/src/modules/projects/services/project-review.generator.ts`.

Confirmed issues:
- Project stats load error swallowed: `client/src/app/features/project-studio/project-studio.component.ts:425`.
- Remove/move/toggle task calls often update local project but do not refresh stats: `client/src/app/features/project-studio/project-studio.component.ts:431`, `client/src/app/features/project-studio/project-studio.component.ts:499`, `client/src/app/features/project-studio/project-studio.component.ts:590`.
- Project review generator notes static code analysis as future: `server/src/modules/projects/services/project-review.generator.ts:29`.
- Case study has fallback behavior: `server/src/modules/projects/services/projects.service.ts:252-283`.

Failure cases:
- Stats panel is blank/stale if stats fail.
- AI review may sound authoritative but static code analysis is not real yet.
- Project submission should affect Skill Passport/Portfolio/Readiness but open screens remain stale.

Fix/test needs:
- Refresh stats after project mutations.
- Label review limitations.
- Emit project submitted/reviewed events.

#### Course Builder

Files:
- `client/src/app/features/course-builder/course-list.component.ts`.
- `client/src/app/features/course-builder/course-detail.component.ts`.
- `server/src/modules/course-builder/course-builder.service.ts`.

Confirmed issues:
- Course list load error is explicit: `client/src/app/features/course-builder/course-list.component.ts:125`.
- Course generation error toasts: `client/src/app/features/course-builder/course-list.component.ts:131-133`.
- Course detail load error explicit: `client/src/app/features/course-builder/course-detail.component.ts:270-276`.
- Lesson progress update error toasts, but local state may be optimistic depending on method body: `client/src/app/features/course-builder/course-detail.component.ts:315-328`.
- Generate flow navigates away and no central invalidation: `client/src/app/features/course-builder/course-detail.component.ts:357`.

Failure cases:
- Dashboard stale course route breaks resume.
- Generated quiz/visual/project/flow can exist but other screens not immediately refreshed.
- Course progress does not necessarily update Skill Twin/Dashboard until those screens reload.

Fix/test needs:
- Fix dashboard route.
- Add artifact created events.
- Test course progress to dashboard/skill twin.

#### Cohorts

Files:
- `client/src/app/features/cohorts/cohorts.component.ts`.
- `server/src/modules/cohort/services/cohort.service.ts`.

Confirmed issues:
- Mine/org cohort list errors have no visible handler: `client/src/app/features/cohorts/cohorts.component.ts:280-282`.
- Detail/leaderboard/org members calls have missing error handlers: `client/src/app/features/cohorts/cohorts.component.ts:309-326`.
- Add/remove member calls have no error handlers: `client/src/app/features/cohorts/cohorts.component.ts:374-380`.
- Peer leaderboard error sets peer null: `client/src/app/features/cohorts/cohorts.component.ts:316-321`.

Failure cases:
- Cohorts page looks empty if list calls fail.
- Leaderboard silently absent.
- Add/remove member failure gives no feedback.
- Students without org may see org-only controls depending on role state.

Fix/test needs:
- Add visible error states per panel.
- Guard org controls by role/org.
- Add member mutation toasts and rollback.

#### Live Sessions

Files:
- `client/src/app/features/live-sessions/live-sessions.component.ts`.

Confirmed issues:
- Mine list has no error handler: `client/src/app/features/live-sessions/live-sessions.component.ts:242`.
- Org sessions/cohorts list calls have no error handlers: `client/src/app/features/live-sessions/live-sessions.component.ts:244-245`.
- Detail load has no error handler: `client/src/app/features/live-sessions/live-sessions.component.ts:251`.
- Start action has no error handler: `client/src/app/features/live-sessions/live-sessions.component.ts:286`.
- End/join/delete errors are handled: `client/src/app/features/live-sessions/live-sessions.component.ts:291-310`, `client/src/app/features/live-sessions/live-sessions.component.ts:359-366`.

Failure cases:
- Page shows no sessions if list call fails.
- Start button may appear to do nothing on failure.
- Org-only data may fail silently for non-org users.

Fix/test needs:
- Add load errors for mine/org/detail.
- Add start error toast.
- Permission-gate org session creation.

#### Peer Rooms

Files:
- `client/src/app/features/peer-rooms/peer-rooms-list.component.ts`.
- `client/src/app/features/peer-rooms/peer-room-detail.component.ts`.

Confirmed issues:
- List/detail load errors are explicit: `client/src/app/features/peer-rooms/peer-rooms-list.component.ts:145`, `client/src/app/features/peer-rooms/peer-room-detail.component.ts:123`.
- Join/send/moderate/summarize/link/close have toasts: `client/src/app/features/peer-rooms/peer-room-detail.component.ts:127-155`.
- There is no visible live polling/socket behavior in the scanned component.

Failure cases:
- Room messages can be stale if another participant sends a message.
- Summary/moderation output may not propagate to Skill Twin/Knowledge.
- Shared flow creation navigates but Today is not recalculated.

Fix/test needs:
- Add real-time or polling refresh.
- Emit generated-flow events.
- Test non-member permissions.

#### Community

Files:
- `client/src/app/features/community/community.component.ts`.
- `server/src/modules/community/services/community.service.ts`.

Confirmed issues:
- Project list load has no error handler: `client/src/app/features/community/community.component.ts:285`.
- Reports load falls back to empty list on error: `client/src/app/features/community/community.component.ts:287`.
- Channel threads call has no error handler: `client/src/app/features/community/community.component.ts:315`.
- Reply upvote has no error handler: `client/src/app/features/community/community.component.ts:392`.
- Other create/delete/report actions have better toasts.

Failure cases:
- Reports tab looks empty when authorization or endpoint failed.
- Threads panel remains stale if channel request fails.
- Upvote reply can fail silently.
- Project picker may be empty due to API failure, not no projects.

Fix/test needs:
- Add per-panel error states.
- Show authorization state for moderator reports.
- Add optimistic rollback for votes.

#### Voice Room

Files:
- `client/src/app/features/voice/voice-room.component.ts`.
- `server/src/modules/voice/voice.module.ts`.
- `server/src/modules/voice/voice.provider.ts`.

Confirmed issues:
- Voice provider is mock by default: `server/src/modules/voice/voice.provider.ts:30-31`.
- Module comment says server STT/TTS provider mock default: `server/src/modules/voice/voice.module.ts:25`.
- Status call error not handled: `client/src/app/features/voice/voice-room.component.ts:306`.
- Session list error only clears loading: `client/src/app/features/voice/voice-room.component.ts:320-322`.
- Get session error clears selected session and loading: `client/src/app/features/voice/voice-room.component.ts:328-330`.
- Rename/delete/turn/summary/derived artifact errors mostly toast: `client/src/app/features/voice/voice-room.component.ts:363-462`.

Failure cases:
- "Voice not working" can be a provider reality issue, not UI issue.
- Session list can appear empty if endpoint failed.
- Audio playback error only sets state idle, not a toast, because `audio.onerror` is shared with ended: `client/src/app/features/voice/voice-room.component.ts:420`.
- Created flow/quiz/notes do not refresh dependent surfaces.

Fix/test needs:
- Show voice provider state.
- Add list load error.
- Add audio playback error feedback.
- Add derived artifact invalidation.

#### Workflows

Files:
- `client/src/app/features/workflows/workflows.component.ts`.

Confirmed issues:
- Workflow status error sets enabled false: `client/src/app/features/workflows/workflows.component.ts:110-115`.
- Graphs call after status has no error handler: `client/src/app/features/workflows/workflows.component.ts:113`.
- Run error has toast: `client/src/app/features/workflows/workflows.component.ts:124-131`.

Failure cases:
- Workflows appear disabled if status endpoint fails.
- Graph list can be empty without explanation.
- Workflow output may mutate backend data but no app-wide invalidation exists.

Fix/test needs:
- Separate "disabled by config" from "could not load".
- Add graph load error.
- Add mutation receipts for workflow runs.

#### Progress / Learning Intelligence

Files:
- `client/src/app/features/intelligence/intelligence-cockpit.component.ts`.
- `server/src/modules/learning-intelligence/learning-intelligence.service.ts`.

Confirmed issues:
- Learning intelligence computes from roadmap/quizzes/projects/mistakes, but open screens are not automatically invalidated.
- Dashboard calls intelligence separately and swallows secondary error.
- Voice command route `/app/progress` is valid.

Failure cases:
- Progress screen can lag after Asta updates roadmap, quiz, project, or mistakes.
- Dashboard intelligence can show old readiness until manual navigation/reload.
- If intelligence endpoint fails, dashboard can silently hide insight.

Fix/test needs:
- Add domain event consumption.
- Add visible stale/error states.
- Test each upstream mutation.

#### Skill Twin

Files:
- `client/src/app/features/skill-twin/skill-twin.component.ts`.
- `server/src/modules/skill-twin/skill-twin.service.ts`.

Confirmed issues:
- Load error is explicit: `client/src/app/features/skill-twin/skill-twin.component.ts:286-291`.
- Reset error toasts: `client/src/app/features/skill-twin/skill-twin.component.ts:327-329`.
- Refresh is manual and not subscribed to app-wide learning changes.

Failure cases:
- Skill Twin stale after Asta roadmap update.
- Skill Twin stale after quiz/project/mistake updates unless refreshed.
- Reset memory affects mistakes/skill twin but other open surfaces do not know.

Fix/test needs:
- Subscribe to central learning-state changes.
- Emit reset event and refresh dependent widgets.

#### Mistake OS

Files:
- `client/src/app/features/mistakes/mistakes.component.ts`.

Confirmed issues:
- Main list/stats failures set loadError: `client/src/app/features/mistakes/mistakes.component.ts:392-393`.
- Due list error only calls done, no visible due-list error: `client/src/app/features/mistakes/mistakes.component.ts:394`.
- `toggleAction` error is swallowed: `client/src/app/features/mistakes/mistakes.component.ts:553`.
- `refreshStats` has no error handler: `client/src/app/features/mistakes/mistakes.component.ts:594-595`.
- Bulk operations are handled with toasts: `client/src/app/features/mistakes/mistakes.component.ts:494-528`.

Failure cases:
- Due review section silently missing.
- Repair action checkbox silently fails.
- Stats can remain stale after updates.
- Repair flow/project creation should update flows/projects/today but no central invalidation exists.

Fix/test needs:
- Add due-list error.
- Add action toggle rollback/toast.
- Emit repair artifact events.

#### Mentor Council

Files:
- `client/src/app/features/mentor-council/mentor-council.component.ts`.

Confirmed issues:
- Convene and reconvene use loadError on failure: `client/src/app/features/mentor-council/mentor-council.component.ts:96-100`.
- Copy failure is handled: `client/src/app/features/mentor-council/mentor-council.component.ts:105-122`.
- Council output is generated/read-only, not a mutating central action.

Failure cases:
- Council advice can be based on stale cached context if context invalidation did not happen.
- It may not reflect Asta roadmap changes made moments earlier if caches/screen state are stale.

Fix/test needs:
- Invalidate agent context after every learning write.
- Include context timestamp in council results.

#### Learning Replay

Files:
- `client/src/app/features/replay/replay.component.ts`.

Confirmed issues:
- Replay generates on constructor and sets loadError on failure: `client/src/app/features/replay/replay.component.ts:95-98`.
- Regenerate uses same loading flag, not a separate busy state.

Failure cases:
- Opening Replay always triggers generation, which can be slow or fail.
- Replay can be stale if generated before recent Asta updates.
- Regenerate failure leaves user with generic load error.

Fix/test needs:
- Separate initial load from regenerate busy/error.
- Show generatedAt and source window already exists, but add source freshness validation.

### Screen-by-screen failure inventory - Outcome group

#### Skill Passport

Files:
- `client/src/app/features/skill-passport/skill-passport.component.ts`.
- `server/src/modules/skill-passport/skill-passport.service.ts`.

Confirmed issues:
- Load error explicit: `client/src/app/features/skill-passport/skill-passport.component.ts:280-282`.
- Recompute error toast: `client/src/app/features/skill-passport/skill-passport.component.ts:288-290`.
- Visibility/evidence mutation errors handled with toasts: `client/src/app/features/skill-passport/skill-passport.component.ts:297-331`.
- Recompute is manual and not triggered automatically by Asta/project/quiz events.

Failure cases:
- Passport stale after project review/quiz completion until recompute.
- Public settings update can fail leaving toggle visually uncertain if no rollback.
- Evidence add/remove does not automatically refresh Resume/Portfolio if those are open.

Fix/test needs:
- Auto recompute or mark stale after verified evidence events.
- Roll back toggles on failure.
- Emit evidence changed event.

#### Career Readiness

Files:
- `client/src/app/features/career-readiness/career-readiness.component.ts`.

Confirmed issues:
- Roles load error swallowed: `client/src/app/features/career-readiness/career-readiness.component.ts:210`.
- Readiness load error explicit: `client/src/app/features/career-readiness/career-readiness.component.ts:216-218`.
- Analyze and set target role errors toast: `client/src/app/features/career-readiness/career-readiness.component.ts:224-235`.

Failure cases:
- Target roles dropdown/list can appear empty because roles API failed.
- Readiness stale after roadmap/project/interview updates.
- Set target role may update readiness but not profile/dashboard context immediately.

Fix/test needs:
- Show role-load error.
- Invalidate readiness after project/interview/passport changes.
- Tie target role change to profile/context invalidation.

#### Outcome Council

Files:
- `client/src/app/features/outcome-council/outcome-council.component.ts`.

Confirmed issues:
- Latest load error explicit: `client/src/app/features/outcome-council/outcome-council.component.ts:119-121`.
- Recommend failure toast: `client/src/app/features/outcome-council/outcome-council.component.ts:127-129`.

Failure cases:
- Council can produce advice from stale readiness/passport data.
- Dismissed recommendations are local only if not persisted.

Fix/test needs:
- Include data freshness metadata.
- Persist dismissals if they affect user workflow.

#### Portfolio

Files:
- `client/src/app/features/portfolio/portfolio.component.ts`.

Confirmed issues:
- Load error explicit: `client/src/app/features/portfolio/portfolio.component.ts:166-168`.
- Add/remove link errors toast: `client/src/app/features/portfolio/portfolio.component.ts:151-162`.
- Save/generate/publish errors toast: `client/src/app/features/portfolio/portfolio.component.ts:178-191`.
- Public link copy assumes `publicProfile.username`: `client/src/app/features/portfolio/portfolio.component.ts:193-195`.

Failure cases:
- Portfolio stale after Skill Passport changes unless generated/refreshed.
- Copy link may fail or copy unusable link if username missing.
- Public settings toggle may fail without rollback.

Fix/test needs:
- Auto mark portfolio stale after passport/project evidence update.
- Validate username before link copy.
- Roll back failed toggles.

#### Interview OS

Files:
- `client/src/app/features/interview/interview.component.ts`.

Confirmed issues:
- Types/archetypes errors are swallowed: `client/src/app/features/interview/interview.component.ts:366-368` from earlier scan.
- Refresh list reloads types/sessions with no error handlers: `client/src/app/features/interview/interview.component.ts:414`.
- Session answer/skip/finish errors are handled with toasts in action methods.
- Mic blocked error is handled: `client/src/app/features/interview/interview.component.ts:301`.

Failure cases:
- Interview type list appears empty if metadata fails.
- Session history appears empty if sessions call fails.
- Completed interview should update readiness/passport but open screens do not refresh.

Fix/test needs:
- Add metadata/history error states.
- Emit interview completed event.
- Refresh Career Readiness/Skill Passport after finish.

#### Resume

Files:
- `client/src/app/features/resume/resume.component.ts`.

Confirmed issues:
- Load error explicit: `client/src/app/features/resume/resume.component.ts:118-120`.
- Generate/save errors toast: `client/src/app/features/resume/resume.component.ts:122-129`.
- Copy Markdown failure toast: `client/src/app/features/resume/resume.component.ts:141-143`.

Failure cases:
- Resume stale after Skill Passport/Project/Profile updates.
- Save overwrites summary buffer with no conflict detection.

Fix/test needs:
- Mark resume stale after evidence/profile changes.
- Reload before save or use updatedAt conflict check.

#### Applications

Files:
- `client/src/app/features/applications/applications.component.ts`.

Confirmed issues:
- Constructor list error only sets loading false: `client/src/app/features/applications/applications.component.ts:273`.
- Bulk update/delete errors handled: `client/src/app/features/applications/applications.component.ts:293-324`.
- Notes/update/remove errors handled with toasts: `client/src/app/features/applications/applications.component.ts:337-371`.
- Analyze/create errors handled with toasts: `client/src/app/features/applications/applications.component.ts:347-356`.

Failure cases:
- Empty applications screen can mean load failed, not no apps.
- Bulk operations partially fail via forkJoin and lose partial success information.
- Asta privacy clear applications affects this screen but it will not update if open.

Fix/test needs:
- Add loadError state.
- Handle partial bulk results.
- Subscribe to privacy/application deletion event.

#### Proof-of-Learning Ledger

Files:
- `client/src/app/features/ledger/ledger.component.ts`.

Confirmed issues:
- List/stats load errors set loadError: `client/src/app/features/ledger/ledger.component.ts:237-242`.
- Export CSV is client-side from filtered current entries only: `client/src/app/features/ledger/ledger.component.ts:207-230`.

Failure cases:
- Export may omit entries not loaded/filtered.
- Ledger stale after daily plan/project/quiz events if open.

Fix/test needs:
- Add server-side full export if required.
- Subscribe to proof event invalidation.

### Screen-by-screen failure inventory - Ecosystem group

#### Mentors

Files:
- `client/src/app/features/mentor-marketplace/mentors.component.ts`.
- `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
- `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts`.

Confirmed issues:
- Route tab detection is based on URL: `client/src/app/features/mentor-marketplace/mentors.component.ts:171-172`.
- Mentor list/profile/session errors are swallowed or weakly handled: `client/src/app/features/mentor-marketplace/mentors.component.ts:170-181`.
- Backend list returns all profiles with no visibility filter: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:60-65`.
- Profile visibility exists on save/update: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:86-91`.
- Request session creates directly with no duplicate/schedule/payment checks: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:103-119`.
- Session notes backend exists but UI only displays notes weakly or lacks full add-note flow.
- Mentor status update is direct: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:152-175`.

Failure cases:
- Hidden mentors can appear in marketplace.
- Student can request duplicate sessions.
- Student can request own mentor profile if they are also mentor unless guarded elsewhere.
- Scheduling/payment workflow is incomplete.
- Sessions tab can look empty because errors are swallowed.
- Backend notes cannot be fully managed from UI.

Fix/test needs:
- Filter by `visibility === public` for normal list.
- Prevent duplicate/self requests.
- Add schedule/payment lifecycle or honest "request only" copy.
- Add visible load errors.
- Complete notes UI.

#### Mentor Sessions

Files:
- Same component as Mentors: `client/src/app/features/mentor-marketplace/mentors.component.ts`.

Confirmed issues:
- Route `/app/mentor-sessions` loads same component.
- It depends on URL parsing to switch tab.
- Session load errors are not strongly visible.

Failure cases:
- Direct navigation can land on wrong tab if route parsing changes.
- Student sees no sessions with no explanation on API failure.
- Mentor status changes not reflected across another open session view.

Fix/test needs:
- Use route data instead of URL string parsing.
- Add explicit session load states.
- Add event refresh after status/note changes.

#### Marketplace

Files:
- `client/src/app/features/marketplace/marketplace.component.ts`.
- `server/src/modules/marketplace/marketplace.controller.ts`.
- `server/src/modules/marketplace/marketplace.service.ts`.

Confirmed issues:
- Use button calls `use` endpoint: `client/src/app/features/marketplace/marketplace.component.ts:111-112`.
- Backend `useTemplate` increments usage and returns route/content only: `server/src/modules/marketplace/marketplace.service.ts:120-136`.
- It does not create a real flow/course/roadmap/project artifact from the template.
- Pending templates are admin-only: `server/src/modules/marketplace/marketplace.controller.ts:35-36`.

Failure cases:
- User clicks "Use" and expects a template clone but only gets a route/content payload.
- Marketplace looks functional but does not instantiate assets.
- Usage counter can increment even when no usable asset was created.
- The target route may require the user to manually paste content.

Fix/test needs:
- Implement type-specific clone/create behavior.
- Increment usage only after successful asset creation.
- Navigate to created artifact ID.
- Add tests per template type.

#### Creator Studio

Files:
- `client/src/app/features/creator-studio/creator-studio.component.ts`.
- `server/src/modules/marketplace/marketplace.service.ts`.

Confirmed issues:
- Created template content is only `{ goal }`: `client/src/app/features/creator-studio/creator-studio.component.ts:115-119`.
- Pending list errors are swallowed: `client/src/app/features/creator-studio/creator-studio.component.ts:105-113`.
- There is no type-specific content schema builder.

Failure cases:
- Creator publishes course/flow/project-like template without required content fields.
- Admin sees pending list as empty if endpoint failed.
- Users later "Use" an incomplete template and get a half-baked route/content.

Fix/test needs:
- Add type-specific forms and validation.
- Add pending list error state.
- Connect Creator Studio output to Marketplace clone semantics.

#### Institution

Files:
- `client/src/app/features/institution/institution.component.ts`.
- `server/src/modules/institution/institution.controller.ts`.
- `server/src/modules/institution/institution.service.ts`.

Confirmed issues:
- Controller is role-gated to admin/mentor: `server/src/modules/institution/institution.controller.ts:16`.
- Student sidebar still exposes it: `client/src/app/core/constants/nav.ts:120`.
- `MAX_STUDENTS` sampling exists in service: `server/src/modules/institution/institution.service.ts:43`.
- Overview readiness and counts can be based on sampled records: `server/src/modules/institution/institution.service.ts:76-97`.
- Assign flow/template is an announcement foundation: `server/src/modules/institution/institution.service.ts:149-164`.
- Cohort org check exists: `server/src/modules/institution/institution.service.ts:173`.

Failure cases:
- Normal student gets forbidden from visible sidebar link.
- Institution dashboard totals may be sampled but appear authoritative.
- Assign flow/template does not create a learner assignment.
- Reports may show sampled estimates as full institutional truth.

Fix/test needs:
- Hide or guard Institution for students.
- Show sample size/total count.
- Implement real assignment records and learner notifications.
- Add student-facing assigned flow/template intake.

### Screen-by-screen failure inventory - Account group

#### Certificates

Files:
- `client/src/app/features/certificates/certificates.component.ts`.

Confirmed issues:
- Copy/share appears to use certificate ID/link only from current UI: `client/src/app/features/certificates/certificates.component.ts:59-60`, `client/src/app/features/certificates/certificates.component.ts:117-120`.
- Public verify route exists: `client/src/app/app.routes.ts:16-20`.

Failure cases:
- Copy action can fail silently if clipboard unavailable unless handled in method.
- Certificate list can be stale after course/passport changes.
- Verification page may not reflect revoked/expired state if backend lacks that status.

Fix/test needs:
- Add visible clipboard fallback.
- Refresh after certificate-producing events.
- Test invalid/revoked certificate IDs.

#### Billing

Files:
- `client/src/app/features/billing/billing.component.ts`.
- `client/src/app/features/billing/pricing.component.ts`.
- `server/src/modules/billing/billing.controller.ts`.
- `server/src/modules/billing/services/billing.service.ts`.
- `server/src/modules/billing/providers/mock-payment.provider.ts`.

Confirmed issues:
- Component comment says mock checkout: `client/src/app/features/billing/billing.component.ts:10`.
- Pricing copy says mock payment mode: `client/src/app/features/billing/pricing.component.ts:42`, `client/src/app/features/billing/pricing.component.ts:299`.
- Billing provider defaults to mock if live not enabled: `server/src/modules/billing/billing.module.ts:48-67`.
- Mock checkout activates immediately: `client/src/app/features/billing/billing.component.ts:332`.
- Subscription provider default can be mock: `server/src/modules/billing/services/billing.service.ts:82-94`.

Failure cases:
- User sees billing as real but payment is mock.
- Plan upgrades may look successful without real payment.
- Usage/entitlements may not refresh in sidebar immediately after plan change.
- Cancel/change-plan lifecycle may not match Stripe/Razorpay real flow.

Fix/test needs:
- Strong environment/provider banner.
- Refresh entitlements after plan change.
- Add live-provider integration tests.

#### Offline & Sync

Files:
- `client/src/app/features/platform/offline.component.ts`.
- `client/src/app/core/services/offline.service.ts`.
- `client/src/app/core/services/sync-queue.service.ts`.

Confirmed issues:
- Offline service primarily stores snapshots in IndexedDB: `client/src/app/core/services/offline.service.ts:30-57`.
- Offline copy implies broader support than actual tracked toggles.
- Search found only roadmap detail has offline toggle integration around `client/src/app/features/roadmap/roadmap-details.component.ts:81`.
- Sync queue process lacks broad refresh/invalidation after replay: `client/src/app/core/services/sync-queue.service.ts:82-98`.

Failure cases:
- User enables offline expecting Today/Flow/Notes but only limited snapshots exist.
- Sync replay can update backend but open screens stay stale.
- Failed sync items may not surface per-screen.

Fix/test needs:
- Document exact offline-supported entities in UI or implement promised entities.
- Add sync completion invalidation.
- Add conflict handling.

#### Integrations

Files:
- `client/src/app/features/platform/integrations.component.ts`.
- `client/src/app/core/services/integration.service.ts`.
- `server/src/modules/integrations/integrations.controller.ts`.
- `server/src/modules/integrations/integrations.service.ts`.
- `server/src/modules/integrations/google-calendar.service.ts`.

Confirmed issues:
- Direct calendar href pattern can bypass auth headers: `client/src/app/core/services/integration.service.ts:54-56`.
- Calendar endpoint exists at `server/src/modules/integrations/integrations.controller.ts:108-121`.
- Calendar export is generic: `server/src/modules/integrations/integrations.service.ts:123-131`.
- Integrations module is described as foundation: `server/src/modules/integrations/integrations.module.ts:13`.
- Google Calendar config errors are explicit in service: `server/src/modules/integrations/google-calendar.service.ts:45`.

Failure cases:
- Downloading `.ics` can 401 because browser anchor has no Authorization header.
- Calendar events may not match actual Today/live session/course schedule.
- Connect/sync/provider failures can be generic.
- LMS CSV import errors are backend-visible but UI may need row-level feedback.

Fix/test needs:
- Use authenticated fetch and blob download or signed URL.
- Generate calendar from real plan/session schedule.
- Add provider-specific connection states.
- Add CSV import preview/report.

#### Developer

Files:
- `client/src/app/features/platform/developer.component.ts`.
- `server/src/modules/developer/developer.controller.ts`.
- `server/src/modules/developer/developer.service.ts`.

Confirmed issues:
- Controller requires `Permission.OrgManage`: `server/src/modules/developer/developer.controller.ts:63`.
- Student sidebar exposes Developer: `client/src/app/core/constants/nav.ts:130`.
- Component loads events, API keys, webhooks, deliveries at init: `client/src/app/features/platform/developer.component.ts:136-146`.
- Controller passes `org.organizationId` into service: `server/src/modules/developer/developer.controller.ts:77-97`, `server/src/modules/developer/developer.controller.ts:115`.
- Service constructs ObjectId from `orgId`: `server/src/modules/developer/developer.service.ts:47-60`.
- If organizationId is not a Mongo ObjectId string, `new Types.ObjectId(orgId)` can throw.

Failure cases:
- Normal student sees Developer and triggers forbidden calls.
- OrgManage user with non-ObjectId organizationId can hit runtime CastError.
- Several panel errors can happen at once on init.
- Test webhook endpoint can fail after persisting delivery but UI may not clearly separate provider failure from app failure.

Fix/test needs:
- Hide/guard Developer.
- Validate org id and use actual organization document id.
- Add top-level forbidden/error state.
- Add per-panel loading/error.

#### Security

Files:
- `client/src/app/features/platform/security.component.ts`.
- `server/src/modules/sessions/sessions.service.ts`.

Confirmed issues:
- Session service derives current session heuristically: `server/src/modules/sessions/sessions.service.ts:57-68`.
- Revoke uses ObjectId conversion without explicit DTO validation: `server/src/modules/sessions/sessions.service.ts:75-76`.
- Logout-all clears refresh token hash in controller: `server/src/modules/sessions/sessions.controller.ts:35-38`.

Failure cases:
- Current device label can be wrong if session id is not tracked client-side.
- Revoking malformed session id can error.
- Logout-all might not immediately revoke access tokens already issued.

Fix/test needs:
- Store current session id on login.
- Validate session id path param.
- Add access-token denylist or short TTL plus refresh revocation explanation.

#### Your Data

Files:
- `client/src/app/features/platform/data-governance.component.ts`.
- `server/src/modules/data-governance/data-governance.controller.ts`.
- `server/src/modules/data-governance/data-governance.service.ts`.

Confirmed issues:
- Export job returns `fileUrl`: `server/src/modules/data-governance/data-governance.service.ts:69-78`.
- Frontend likely treats URL directly for download: `client/src/app/features/platform/data-governance.component.ts:90-92`, `client/src/app/features/platform/data-governance.component.ts:105-113`.
- Job lookup validates ObjectId: `server/src/modules/data-governance/data-governance.service.ts:39`.

Failure cases:
- Frontend hosted on different origin may try to download relative API file URL incorrectly.
- Export readiness may require polling but UI can show stale state.
- Delete request may be submitted but not reflected in app state/session.

Fix/test needs:
- Return absolute signed download URL or fetch via API service.
- Add polling/backoff for job status.
- Add account deletion lifecycle status.

#### Data & Privacy

Files:
- `client/src/app/features/privacy/privacy.component.ts`.
- `server/src/modules/privacy/privacy.controller.ts`.
- `server/src/modules/privacy/privacy.service.ts`.

Confirmed issues:
- Settings load error is swallowed: `client/src/app/features/privacy/privacy.component.ts:78`.
- Backend exposes clear actions: `server/src/modules/privacy/privacy.controller.ts:15-30`.
- Clear applications/reset skill twin/make private can affect other screens.

Failure cases:
- Privacy page appears with defaults when settings failed.
- Clearing applications does not update Applications screen if open.
- Resetting Skill Twin does not update Skill Twin/Mistakes/Dashboard if open.
- Make private does not refresh Portfolio/Passport public states if open.

Fix/test needs:
- Add settings load error.
- Emit app-wide privacy mutation events.
- Force refresh or navigation after destructive privacy operations.

#### Profile

Files:
- `client/src/app/features/profile/profile.component.ts`.
- `server/src/modules/student-profile/student-profile.service.ts`.

Confirmed issues:
- Profile save updates student profile: `client/src/app/features/profile/profile.component.ts:454-467`.
- Student profile service writes profile document: `server/src/modules/student-profile/student-profile.service.ts:86-99`.
- Auth user object may not be updated after profile save.

Failure cases:
- Header/user name can remain stale after profile update.
- Career goal change can leave roadmap/today/skill twin stale.
- Target role/profile changes can leave readiness stale.

Fix/test needs:
- Refresh auth user/profile context after save.
- If goal/role changes, mark roadmap/today/readiness/skill-twin stale.
- Add "apply goal change" flow rather than silent stale dependencies.

### More detailed backend failure inventory

#### Agent session naming and history

Confirmed from source:
- Default session title is generic/new chat in schema: `server/src/modules/agents/schemas/agent-session.schema.ts:16-17`.
- Title update depends on assistant save flow: `server/src/modules/agents/core/agent-session.service.ts:253-290`.
- Title derives from first user message slice, not a semantic summary.
- Invalid/missing message retrieval returns empty messages instead of a visible error: `server/src/modules/agents/core/agent-session.service.ts:206-213`.

Failure cases:
- History content tab exists but appears empty after load failure or bad session id.
- Multiple sessions are named from first few words only.
- User asks to name every session correctly, but current logic cannot infer a real task title.
- Stream failure before assistant save can leave session with generic title.

Fix/test needs:
- Generate title at session creation from first user message.
- Optionally refine title after assistant response using cheap AI/fallback title generator.
- Treat invalid session id as not found in UI rather than empty history.
- Add history load error states in all history surfaces.

#### Agent command registry

Confirmed from source:
- Registry iterates registered commands and runs the first match: `server/src/modules/agents/core/chat-command-registry.service.ts:72-81`.
- Command matching is text/intent based and can collide.
- Roadmap commands exist: `server/src/modules/roadmap/roadmap-chat-commands.ts:30-139`.

Failure cases:
- "I already learned this, update today also" may match one command and skip another.
- Asta may answer as tutor when user expected mutation if phrase does not match.
- Command result can update one domain without dependent domains.

Fix/test needs:
- Add command planner that can execute multiple typed mutations.
- Add confirmation for destructive/wide changes.
- Return mutation receipts.

#### Context engine caching

Confirmed from source:
- Context snapshot is cached per user: `server/src/modules/agents/core/context-engine.service.ts:183-214`.
- It invalidates on progression events: `server/src/modules/agents/core/context-engine.service.ts:170-177`.

Failure cases:
- Some writes do not emit progression events, so Asta uses stale context.
- Frontend screens do not consume context invalidation at all.
- Short TTL still allows stale answer immediately after write.

Fix/test needs:
- Emit events for every learning-domain write.
- Invalidate context directly in command handlers.
- Return current context version in Asta responses.

#### Roadmap service

Confirmed from source:
- `computeProgress` uses completed weeks only.
- Replan/regenerate/restore create versions and mutate roadmap content.
- Active roadmap singular behavior archives others on activation.

Failure cases:
- Asta creates/activates a roadmap and user expects Today/Dashboard to follow immediately.
- Task completion does not show progress percentage movement.
- Version restore can change daily study plan but Today remains from old plan.

Fix/test needs:
- Domain events for roadmap content changed, roadmap progress changed, active roadmap changed.
- Daily plan stale flag or auto recalc.

#### Daily plan service

Confirmed from source:
- `getToday` returns existing plan for date.
- `generate` collects active flow, mistakes, due reviews, roadmap.
- `recalculate` deletes/regenerates today's plan.
- Carry-over pulls unfinished items by source/title.

Failure cases:
- Old roadmap item persists after Asta replan.
- Old mistake/flow item persists after repair/resolution.
- Carry-over can resurrect stale tasks.

Fix/test needs:
- Add dependency hash to daily plan.
- If dependencies changed, show stale banner or recalculate automatically.

#### Progression service

Confirmed from source:
- Progression events exist for quiz graded, roadmap week completed, project submitted, flow repair completed.
- Service currently nudges/notifications, not full screen invalidation.

Failure cases:
- Events are not emitted for every domain mutation.
- Events do not reach Angular screens.
- Notifications do not update dashboard/today/skill twin state.

Fix/test needs:
- Add server event bus to frontend via SSE/socket or lightweight notification polling.
- Map each event to invalidated queries.

#### Marketplace backend

Confirmed from source:
- Use endpoint does not clone.
- Creator templates can be approved/published.

Failure cases:
- "Use template" is a half-baked workflow.
- Incomplete content payloads become published.

Fix/test needs:
- Type-specific template schema.
- Type-specific clone services.

#### Institution backend

Confirmed from source:
- Assignment is announcement-only foundation.
- Samples are used for calculations.

Failure cases:
- "Assign flow" does not create a real flow for students.
- Outcomes may be sampled but users think full report.

Fix/test needs:
- Real assignment schema.
- Real learner inbox/tasks.
- Sampling metadata.

#### Integrations backend

Confirmed from source:
- Module is foundation.
- Calendar export is generic.
- Webhook/manual/csv connectors exist but not full provider ecosystem.

Failure cases:
- User expects Google Calendar sync but credentials missing.
- `.ics` not authenticated.
- Sync errors show generic messages.

Fix/test needs:
- Provider status surface.
- Authenticated downloads.
- Row-level CSV reports.

#### Developer backend

Confirmed from source:
- ObjectId construction happens from orgId.
- Permissions require org manage.

Failure cases:
- Bad org id crashes endpoint.
- User sees forbidden from visible sidebar.

Fix/test needs:
- Validate org id.
- Use organization document id.
- Align nav with permission.

#### Billing backend

Confirmed from source:
- Mock provider default.
- Live provider depends on config.

Failure cases:
- Mock mode in production.
- Entitlements stale after plan change.

Fix/test needs:
- Fail closed if production billing not configured.
- Emit entitlement changed event.

### Silent error hotspots from static scan

These lines are especially relevant to "tabs were there but content inside was not occurring".

- `client/src/app/features/asta-os/asta-os-history.component.ts:154-167`: history list failure path can hide content.
- `client/src/app/features/asta-os/asta-os-history.component.ts:188-193`: session message failure handling is weak.
- `client/src/app/features/ai-tutor/tutor-workspace.component.ts:397-402`: tutor history errors only stop loading.
- `client/src/app/features/dashboard/dashboard.component.ts:532-540`: dependent dashboard calls swallow errors.
- `client/src/app/features/today/today.component.ts:292-294`: streak/history errors swallowed.
- `client/src/app/features/mentor-marketplace/mentors.component.ts:170-181`: mentor/session/profile load errors swallowed.
- `client/src/app/features/creator-studio/creator-studio.component.ts:105-113`: pending templates errors swallowed.
- `client/src/app/features/privacy/privacy.component.ts:78`: settings load error swallowed.
- `client/src/app/features/resources/resources.component.ts:282-286`: for-you/library errors swallowed.
- `client/src/app/features/resources/resources.component.ts:299-301`: catalog failure becomes empty list.
- `client/src/app/features/quiz-studio/quiz-studio.component.ts:533`: docs load has no error handler.
- `client/src/app/features/quiz-studio/quiz-studio.component.ts:558`: attempts load error swallowed.
- `client/src/app/features/project-studio/project-studio.component.ts:425`: project stats error swallowed.
- `client/src/app/features/community/community.component.ts:285`: project list error swallowed.
- `client/src/app/features/community/community.component.ts:287`: reports error becomes empty list.
- `client/src/app/features/community/community.component.ts:315`: threads load has no error handler.
- `client/src/app/features/community/community.component.ts:392`: reply upvote has no error handler.
- `client/src/app/features/cohorts/cohorts.component.ts:280-282`: cohort list errors missing.
- `client/src/app/features/cohorts/cohorts.component.ts:309-326`: detail/leaderboard/org member errors missing.
- `client/src/app/features/live-sessions/live-sessions.component.ts:242-251`: list/detail load errors missing.
- `client/src/app/features/live-sessions/live-sessions.component.ts:286`: start session error missing.
- `client/src/app/features/career-readiness/career-readiness.component.ts:210`: roles load error swallowed.
- `client/src/app/features/interview/interview.component.ts:414`: refresh list has no error handlers.
- `client/src/app/features/mistakes/mistakes.component.ts:394`: due list error hidden.
- `client/src/app/features/mistakes/mistakes.component.ts:553`: action toggle error hidden.
- `client/src/app/features/mistakes/mistakes.component.ts:594-595`: refresh stats has no error handler.
- `client/src/app/features/voice/voice-room.component.ts:306`: voice status error missing.
- `client/src/app/features/voice/voice-room.component.ts:320-322`: session list error only stops loading.
- `client/src/app/features/workflows/workflows.component.ts:113`: graph load error missing.
- `client/src/app/layout/shell.component.ts:257`: feature flags error swallowed.
- `client/src/app/layout/shell.component.ts:261`: entitlements error swallowed.

### Mock, fallback, and incomplete foundation hotspots

These lines explain why some features can feel unfinished even when screens open.

- `client/src/app/features/admin/ai-ops.component.ts:79`: "No real AI - every reply is a placeholder."
- `client/src/app/features/billing/billing.component.ts:10`: billing described as mock checkout.
- `client/src/app/features/billing/billing.component.ts:332`: mock provider activates immediately.
- `client/src/app/features/billing/pricing.component.ts:42`: mock payment mode copy.
- `client/src/app/features/billing/pricing.component.ts:299`: mock payment FAQ.
- `client/src/app/features/asta-os/practice/practice-problems.ts:6`: larger AI-generated practice bank is later increment.
- `server/src/modules/institution/institution.service.ts:149`: assignments are announcement foundation.
- `server/src/modules/integrations/integrations.controller.ts:42`: integrations foundation.
- `server/src/modules/integrations/integrations.module.ts:13`: foundation connectors.
- `server/src/modules/mentor/schemas/mentor-profile.schema.ts:36`: pricing/ratings placeholders.
- `server/src/modules/notifications/schemas/notification.schema.ts:8`: channel/BullMQ fan-out later.
- `server/src/modules/practice/practice.service.ts:157-168`: falls back to mock execution.
- `server/src/modules/practice/providers/mock-execution.provider.ts:19-20`: mock execution provider.
- `server/src/modules/projects/services/project-review.generator.ts:29`: static code analysis is future.
- `server/src/modules/push/schemas/push-subscription.schema.ts:7`: VAPID/web-push placeholder.
- `server/src/modules/reports/services/reports.service.ts:52`: PDF export and placement readiness future.
- `server/src/modules/visuals/visuals.module.ts:18-19`: mock illustrations default.
- `server/src/modules/visuals/providers/image-provider.ts:28-29`: mock image provider.
- `server/src/modules/voice/voice.module.ts:25`: voice provider mock default.
- `server/src/modules/voice/voice.provider.ts:17`: voice provider abstraction.
- `server/src/modules/voice/voice.provider.ts:30-31`: mock voice provider.

### ObjectId and validation hotspots

Confirmed safe/validated:
- Mentor request DTO validates `mentorId`: `server/src/modules/mentor-marketplace/dto/mentor-marketplace.dto.ts:33`.
- Data export job lookup validates ObjectId: `server/src/modules/data-governance/data-governance.service.ts:39`.

Confirmed risky or needs verification:
- Developer service constructs ObjectIds from `orgId` and endpoint ids: `server/src/modules/developer/developer.service.ts:47-60`, `server/src/modules/developer/developer.service.ts:76`, `server/src/modules/developer/developer.service.ts:107-117`, `server/src/modules/developer/developer.service.ts:131-153`.
- Sessions service constructs ObjectIds from `sessionId`: `server/src/modules/sessions/sessions.service.ts:75-76`.
- Marketplace update constructs ObjectId from `id`: `server/src/modules/marketplace/marketplace.service.ts:145-146`.
- Mentor marketplace constructs ObjectId from session ids in notes: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts:198`.
- Billing uses user id ObjectId repeatedly; likely safe because auth user id is internal, but still depends on auth payload validity.
- Student profile uses user id ObjectId repeatedly; likely safe because auth user id is internal.

Failure cases:
- Malformed route id can produce 500 instead of 400 if no pipe/DTO validation catches it.
- Organization ID mismatch can produce runtime cast error.
- Some errors appear in console as server errors rather than clean user-facing messages.

Fix/test needs:
- Add `ParseObjectIdPipe` or DTO `@IsMongoId` consistently for route ids.
- Return 400 for malformed ids.
- Add tests for invalid id on every route with `:id`.

### Cross-screen state propagation map

When Asta or the user mutates `roadmap`:
- Must refresh Roadmap.
- Must refresh Today or mark stale.
- Must refresh Dashboard active roadmap and next action.
- Must refresh Learning Intelligence.
- Must refresh Skill Twin.
- Must invalidate Agent Context.
- Should refresh Resources recommendations.
- Should refresh Mentor Council/Outcome Council context.

When user completes a `daily plan` item:
- Must refresh Today.
- Must refresh Dashboard today strip.
- Must refresh Ledger if plan completed proof created.
- Should refresh streak/history.
- Should refresh Skill Twin if daily activity matters.

When user submits or grades a `quiz`:
- Must refresh Quiz Studio attempts/history.
- Must refresh Mistakes.
- Must refresh Learning Intelligence.
- Must refresh Skill Passport if evidence created.
- Must refresh Dashboard weak topics.
- Must invalidate Agent Context.

When user submits/reviews a `project`:
- Must refresh Project Studio list/stats.
- Must refresh Skill Passport.
- Must refresh Portfolio.
- Must refresh Resume if generated from evidence.
- Must refresh Career Readiness.
- Must refresh Dashboard project panel.
- Must invalidate Agent Context.

When user repairs a `mistake`:
- Must refresh Mistake OS.
- Must refresh Flow Studio if repair flow node created.
- Must refresh Project Studio if repair project created.
- Must refresh Today if repair task should be scheduled.
- Must refresh Learning Intelligence.
- Must invalidate Agent Context.

When user creates a `flow` from space/course/voice/peer room:
- Must refresh Flow Studio.
- Must refresh Today if active flow changed.
- Must refresh Dashboard next action.
- Must invalidate Agent Context.

When user creates a `quiz` from space/course/voice:
- Must refresh Quiz Studio.
- Must select or deep-link the new quiz.
- Must not leave old quiz list cached.

When user creates a `visual` from flow/course/space:
- Must refresh Visual Studio.
- Must deep-link to created visual.
- Must preserve source link.

When user changes `profile goal` or `target role`:
- Must refresh Profile.
- Must refresh Roadmap recommendation state.
- Must refresh Today stale state.
- Must refresh Career Readiness.
- Must refresh Skill Twin.
- Must invalidate Agent Context.

When user changes `billing plan`:
- Must refresh Billing.
- Must refresh entitlements in Shell.
- Must refresh feature gating on routes.

When user changes `privacy/public settings`:
- Must refresh Passport/Portfolio public previews.
- Must refresh Applications if cleared.
- Must refresh Skill Twin/Mistakes if reset.
- Must invalidate public routes.

### Expected central Asta update design

The app needs a central operation model, not isolated chat commands.

Suggested operation shape:
- `operationId`.
- `intent`.
- `requiresConfirmation`.
- `domain`.
- `action`.
- `input`.
- `affectedQueries`.
- `affectedScreens`.
- `createdEntities`.
- `updatedEntities`.
- `failedEntities`.
- `receiptText`.

Required operation categories:
- `roadmap.updateProgress`.
- `roadmap.replan`.
- `roadmap.regenerateWeek`.
- `roadmap.activate`.
- `dailyPlan.recalculate`.
- `dailyPlan.addItem`.
- `dailyPlan.carryOver`.
- `flow.create`.
- `flow.addRepairNode`.
- `quiz.create`.
- `quiz.start`.
- `project.create`.
- `mistake.resolve`.
- `mistake.createRepair`.
- `profile.updateGoal`.
- `career.setTargetRole`.
- `passport.recompute`.
- `portfolio.regenerate`.
- `resume.regenerate`.
- `marketplace.cloneTemplate`.
- `institution.assignFlow`.
- `privacy.makePrivate`.

Required frontend invalidation API:
- `invalidate('roadmap')`.
- `invalidate('today')`.
- `invalidate('dashboard')`.
- `invalidate('intelligence')`.
- `invalidate('skillTwin')`.
- `invalidate('mistakes')`.
- `invalidate('quiz')`.
- `invalidate('projects')`.
- `invalidate('passport')`.
- `invalidate('portfolio')`.
- `invalidate('resume')`.
- `invalidate('billing')`.
- `invalidate('entitlements')`.
- `invalidate('privacy')`.

Required Asta receipt examples:
- "Updated roadmap week 2 to completed."
- "Recalculated Today's plan from the new roadmap."
- "Dashboard and Skill Twin will refresh automatically."
- "Could not update Calendar because Google Calendar is not connected."
- "Needs confirmation before deleting old plan items."

### Regression test checklist by reported issue

#### Issue 1 - History tabs visible but content missing

Test cases:
- Load Asta history with valid sessions.
- Force sessions endpoint 500.
- Force messages endpoint 500.
- Open invalid session id.
- Open session with only user message and no assistant response.
- Open session with title missing.
- Open session while token expired.
- Open history after switching Asta OS tabs.
- Open AI Tutor history after stream failure.

Expected fixes:
- Visible error state.
- Retry button.
- Session title fallback.
- Empty session explanation.
- No silent blank content.

#### Issue 2 - Correct name for every session

Test cases:
- First message: "Explain Java inheritance with examples".
- First message: "I already learned Week 2, update roadmap".
- First message: "Create a system design roadmap".
- First message with attachment only.
- Stream fails before assistant final response.
- User renames manually if feature exists.

Expected fixes:
- Title generated immediately from user intent.
- Title refined after assistant response.
- Titles distinct for similar sessions.
- Failed sessions still get meaningful names.

#### Issue 3 - Asta update must update everything dependent

Test cases:
- Asta marks roadmap week learned.
- Asta replans roadmap.
- Asta creates new roadmap and activates it.
- Asta adds daily plan item.
- Asta resolves a mistake.
- Asta creates a project.
- Asta creates a quiz.
- Asta changes target role.

Expected fixes:
- Receipt lists updated domains.
- Today refreshes or marks stale.
- Dashboard refreshes.
- Learning Intelligence refreshes.
- Skill Twin refreshes.
- Agent context invalidates.
- Dependent screens open in other tabs update or show stale banner.

#### Issue 4 - Chat Asta assistant not working properly

Test cases:
- Socket unauthorized event.
- Socket busy event.
- Socket disconnected mid-stream before any tokens.
- Socket disconnected after partial content.
- Orchestrator throws.
- REST fallback succeeds.
- REST fallback fails.

Expected fixes:
- Proper fallback on transport/orchestrator errors.
- Proper validation message on user-fixable input errors.
- No indefinite busy spinner.
- Failed turn can retry.

#### Issue 5 - Ecosystem onward incomplete screens

Test cases:
- Student opens Mentors, Mentor Sessions, Marketplace, Creator Studio, Institution.
- Mentor opens same screens.
- Admin opens same screens.
- Org manager opens Institution and Developer.
- Use every Marketplace template type.
- Create/publish every Creator Studio template type.
- Assign flow/template from Institution.
- Request mentor session twice.
- Hide mentor profile and verify marketplace.

Expected fixes:
- Permission-aligned sidebar.
- Real clone/create flows.
- Real institution assignments.
- Mentor duplicate/self/schedule/payment checks.
- Visible errors.

#### Issue 6 - Unauthorized and other hidden failures while switching screens

Test cases:
- Expire access token then navigate across every sidebar route.
- Normal student clicks Institution.
- Normal student clicks Developer.
- Org member without OrgManage clicks Developer deep link.
- Network returns 500 on secondary panel calls.
- Feature flags endpoint fails.
- Entitlements endpoint fails.

Expected fixes:
- Refresh token retry.
- Clean forbidden screen.
- No app-wide crash/logout for recoverable secondary failures.
- No silent blank panels.

### Per-screen smoke and edge-case checklist

Use this checklist when fixing the issues.

- Dashboard: expired token.
- Dashboard: no roadmap.
- Dashboard: active roadmap.
- Dashboard: stale daily plan.
- Dashboard: secondary API failure.
- Dashboard: course resume link.
- Today: no plan.
- Today: existing plan.
- Today: roadmap changed after plan creation.
- Today: carry-over stale item.
- Today: streak failure.
- AI Tutor: history list failure.
- AI Tutor: message load failure.
- AI Tutor: stream error event.
- AI Tutor: Observable stream error.
- AI Tutor: edit and resend.
- Asta OS: tab switch while busy.
- Asta OS: load history while busy.
- Asta OS: close active tab.
- Asta OS: attachment upload fail.
- Asta OS: socket error fallback.
- Mentor Room: route switch from Career Coach.
- Doubt Solver: stream error.
- Career Coach: stale readiness context.
- Study Notes: content generation command.
- Roadmap: task complete only.
- Roadmap: week complete.
- Roadmap: restore version.
- Roadmap: regenerate week.
- Roadmap: replan remaining.
- Flow Studio: list failure.
- Flow Studio: node drag save failure.
- Flow Studio: execute node failure.
- Flow Studio: repair flow event.
- Visual Studio: status failure.
- Visual Studio: mock provider.
- Visual Studio: delete visual.
- Study Spaces: source add failure.
- Study Spaces: source remove failure.
- Study Spaces: create quiz.
- Study Spaces: create visual.
- Simulations: start failure.
- Simulations: finish updates readiness.
- Knowledge: document ingestion failure.
- Knowledge: summary fallback.
- Resources: catalog failure vs empty.
- Resources: library failure.
- Quizzes: attempts failure.
- Quizzes: history failure.
- Quizzes: submit updates mistakes.
- Projects: stats failure.
- Projects: AI review limitation.
- Projects: submit updates passport.
- Course Builder: dashboard link.
- Course Builder: lesson progress failure.
- Course Builder: generated artifact navigation.
- Cohorts: no org.
- Cohorts: leaderboard failure.
- Cohorts: member add failure.
- Live Sessions: mine list failure.
- Live Sessions: org list failure.
- Live Sessions: start failure.
- Peer Rooms: stale messages.
- Peer Rooms: non-member join.
- Community: reports authorization.
- Community: threads failure.
- Voice Room: mock provider.
- Voice Room: session list failure.
- Voice Room: audio playback failure.
- Workflows: status failure.
- Workflows: graph list failure.
- Progress: stale after quiz/project.
- Skill Twin: stale after roadmap/mistake.
- Mistakes: due list failure.
- Mistakes: toggle action failure.
- Mentor Council: stale context.
- Replay: generation failure.
- Skill Passport: recompute after project.
- Career Readiness: roles load failure.
- Outcome Council: stale readiness.
- Portfolio: missing username link.
- Interview: metadata failure.
- Resume: stale after passport.
- Applications: list load failure.
- Ledger: full export vs filtered export.
- Mentors: hidden profiles.
- Mentors: duplicate request.
- Mentor Sessions: wrong tab from URL.
- Marketplace: use template creates real asset.
- Creator Studio: type-specific content.
- Institution: student forbidden.
- Institution: assignment real.
- Institution: sampled totals visible.
- Certificates: invalid verify id.
- Billing: mock/live provider.
- Billing: entitlement refresh.
- Offline: supported entity clarity.
- Offline: sync completion refresh.
- Integrations: auth calendar download.
- Integrations: real calendar events.
- Developer: permission guard.
- Developer: invalid org id.
- Security: current session identification.
- Security: malformed revoke id.
- Your Data: cross-origin export URL.
- Your Data: export polling.
- Data & Privacy: settings load failure.
- Data & Privacy: destructive action propagation.
- Profile: auth user refresh.
- Profile: goal change propagation.

### Concrete issue backlog after second pass

1. Implement refresh-token retry and socket token refresh.
2. Add permission predicates to sidebar generation.
3. Add route guards for Institution, Developer, Reports, Org, Platform, Founder, and any org-only screen.
4. Add explicit forbidden states.
5. Normalize all stream terminal errors into shared fallback behavior.
6. Add REST fallback to AI Tutor and Agent Workspace.
7. Fix Asta OS tab/session race by binding stream to immutable tab/session ids.
8. Add visible history load errors.
9. Add semantic session titles.
10. Return 404/403 for invalid history session instead of empty messages.
11. Build central Asta mutation pipeline.
12. Add mutation receipts to Asta answers.
13. Add backend domain events for all learning writes.
14. Add frontend invalidation service.
15. Invalidate Today after roadmap/flow/mistake updates.
16. Invalidate Dashboard after roadmap/today/quiz/project updates.
17. Invalidate Learning Intelligence after roadmap/quiz/project/mistake updates.
18. Invalidate Skill Twin after all learning writes.
19. Invalidate Agent Context after all learning writes.
20. Add daily plan dependency hash and stale banner.
21. Fix dashboard `/app/courses` route.
22. Implement Marketplace template cloning.
23. Implement Creator Studio type-specific schemas.
24. Implement Institution real assignments.
25. Add sample-size labels to Institution reports.
26. Filter mentor marketplace by visibility.
27. Prevent duplicate/self mentor session requests.
28. Complete mentor notes/status/schedule/payment lifecycle.
29. Fix Developer org id ObjectId usage.
30. Add ParseObjectId validation to route params.
31. Use authenticated blob download for `.ics`.
32. Generate calendar export from real plan/session data.
33. Fix data export URL semantics.
34. Add privacy mutation propagation.
35. Add profile/auth refresh after profile save.
36. Add role-load error to Career Readiness.
37. Add loadError to Applications list.
38. Add errors for Cohorts list/detail/member mutations.
39. Add errors for Live Sessions list/detail/start.
40. Add due-list and action-toggle errors in Mistakes.
41. Add graph load error in Workflows.
42. Add voice provider/status/list error states.
43. Add billing mock/live production guard.
44. Refresh entitlements after billing change.
45. Clarify offline supported entities or implement promised ones.
46. Add generated-artifact invalidation from spaces/course/voice/peer/flow.
47. Add project stats refresh after task mutations.
48. Add quiz attempts/history error states.
49. Add resources empty-vs-error distinction.
50. Add public link validation for Portfolio.
51. Add session-id tracking for Security current device.
52. Add export-all endpoint for Ledger if filtered CSV is insufficient.
53. Add stale data timestamps to councils/replay/readiness.
54. Add E2E test that opens every sidebar route as student, mentor, admin, org manager.
55. Add E2E test for Asta "update everything I learned" scenario.

## File-level audit ledger

This ledger is added to make the static coverage explicit. It does not mean every file has a confirmed bug. It records which files/surfaces were traced and what failure class they can contribute to.

### Client core and routing files

File: `client/src/app/app.routes.ts`.
Status: checked.
Risk class: route mismatch, missing guards, permission mismatch.
Finding: student routes exist for all sidebar entries, but several routes rely on backend authorization only.
Action: add route guards for permission-sensitive routes.

File: `client/src/app/core/constants/nav.ts`.
Status: checked.
Risk class: sidebar visibility mismatch.
Finding: Institution and Developer are exposed in student nav without permission filtering.
Action: generate nav from role/org/permission/entitlement state.

File: `client/src/app/core/guards/auth.guard.ts`.
Status: checked.
Risk class: stale token accepted at navigation time.
Finding: guard checks token presence, not token freshness.
Action: add refresh/restore validation before entering protected routes.

File: `client/src/app/core/guards/onboarding.guard.ts`.
Status: checked.
Risk class: boot-time session/profile dependency.
Finding: depends on available auth/profile state during route activation.
Action: retest after refresh-token interceptor is added.

File: `client/src/app/core/guards/role.guard.ts`.
Status: checked.
Risk class: inconsistent role enforcement.
Finding: admin routes use role guard, but many student-shell org screens do not have matching client guards.
Action: extend guard usage to org/admin screens under `/app`.

File: `client/src/app/core/interceptors/auth-token.interceptor.ts`.
Status: checked.
Risk class: token attach only.
Finding: attaches access token but does not refresh it.
Action: coordinate with refresh retry interceptor.

File: `client/src/app/core/interceptors/error.interceptor.ts`.
Status: checked.
Risk class: global logout on 401.
Finding: clears session and navigates login before trying refresh.
Action: make this the final fallback, not first response.

File: `client/src/app/core/services/auth.service.ts`.
Status: checked.
Risk class: refresh token unused.
Finding: refresh token is stored but no refresh method is wired to HTTP retry.
Action: implement refresh, update tokens, retry original request.

File: `client/src/app/core/services/socket.service.ts`.
Status: checked.
Risk class: stream error modeling.
Finding: terminal socket error events complete the stream instead of throwing through fallback path.
Action: classify terminal events and surface fallback-worthy errors.

File: `client/src/app/core/services/voice-command-router.service.ts`.
Status: checked.
Risk class: command routing.
Finding: routes are valid, but commands only navigate/ask and do not mutate centrally.
Action: integrate central Asta operation receipts for mutation intents.

File: `client/src/app/layout/shell.component.ts`.
Status: checked.
Risk class: shell secondary data errors.
Finding: feature flags and entitlements errors are swallowed.
Action: add visible degraded state and permission-safe defaults.

### Client Asta and chat files

File: `client/src/app/features/asta-os/asta-os.component.ts`.
Status: checked.
Risk class: streaming, tabs, history, central updates.
Finding: stream fallback only runs on Observable error, not terminal event error.
Action: fix shared stream error handling and bind responses to immutable tab/session ids.

File: `client/src/app/features/asta-os/asta-os-history.component.ts`.
Status: checked.
Risk class: blank history content.
Finding: session list/message errors can result in blank content instead of clear error.
Action: add visible list and message load states.

File: `client/src/app/features/asta-os/asta-os-composer.component.ts`.
Status: checked.
Risk class: command entry.
Finding: slash/quick commands send text to same pipeline without operation preview.
Action: pair central commands with previews and receipts.

File: `client/src/app/features/asta-os/asta-os-tool-module.component.ts`.
Status: checked.
Risk class: tool panel silent errors.
Finding: many tool actions use swallowed errors or limited toasts.
Action: standardize error handling and affected-screen invalidation.

File: `client/src/app/features/asta-os/practice/asta-os-practice-panel.component.ts`.
Status: checked.
Risk class: mock execution and practice completeness.
Finding: practice bank/code execution depends on fallback provider behavior.
Action: label mock execution and test provider status.

File: `client/src/app/features/ai-tutor/tutor-workspace.component.ts`.
Status: checked.
Risk class: classic chatbot reliability.
Finding: terminal stream errors fail the assistant response without fallback.
Action: reuse Asta OS fallback policy.

File: `client/src/app/features/agent-workspace/agent-workspace.component.ts`.
Status: checked.
Risk class: Mentor Room/Doubt Solver/Career Coach/Study Notes.
Finding: route data reset clears local conversation and terminal stream errors fail response.
Action: add persistent sessions/history and stream fallback.

### Client Learn files

File: `client/src/app/features/dashboard/dashboard.component.ts`.
Status: checked.
Risk class: stale dependent panels.
Finding: secondary failures are swallowed and course route is stale.
Action: fix route, errors, and invalidation.

File: `client/src/app/features/today/today.component.ts`.
Status: checked.
Risk class: stale daily plan.
Finding: Today does not automatically rebuild after roadmap/flow/mistake changes.
Action: dependency hash or central stale banner.

File: `client/src/app/features/roadmap/roadmap-list.component.ts`.
Status: checked.
Risk class: active roadmap list state.
Finding: needs refresh after Asta creates/activates/archives a roadmap.
Action: subscribe to roadmap invalidation.

File: `client/src/app/features/roadmap/roadmap-generate.component.ts`.
Status: checked.
Risk class: new roadmap propagation.
Finding: generated roadmap affects Today/Dashboard/Skill Twin but no global refresh exists.
Action: emit active-roadmap changed event.

File: `client/src/app/features/roadmap/roadmap-details.component.ts`.
Status: checked.
Risk class: progress/version/offline state.
Finding: completion and replan actions update roadmap only.
Action: refresh dependent surfaces after roadmap writes.

File: `client/src/app/features/flows/flows-list.component.ts`.
Status: checked.
Risk class: generated flow list.
Finding: list/generate errors mostly handled, but central invalidation missing.
Action: refresh list after external flow creation.

File: `client/src/app/features/flows/flow-detail.component.ts`.
Status: checked.
Risk class: local optimistic state.
Finding: node drag/notes/status changes can appear local before save succeeds.
Action: add rollback or unsynced marker.

File: `client/src/app/features/visuals/visuals-list.component.ts`.
Status: checked.
Risk class: provider status.
Finding: provider status error not handled; mock provider common.
Action: show provider state and status errors.

File: `client/src/app/features/visuals/visual-detail.component.ts`.
Status: checked.
Risk class: generated asset lifecycle.
Finding: regenerate/delete handled locally but source screens are not invalidated.
Action: emit visual changed event.

File: `client/src/app/features/spaces/spaces-list.component.ts`.
Status: checked.
Risk class: generated spaces list.
Finding: list load error exists, but external changes need invalidation.
Action: refresh after Asta or derived artifact actions.

File: `client/src/app/features/spaces/space-detail.component.ts`.
Status: checked.
Risk class: source and derived artifact state.
Finding: creates flow/quiz/visual but does not refresh destination screens globally.
Action: use created artifact receipt and invalidation.

File: `client/src/app/features/simulations/simulations-list.component.ts`.
Status: checked.
Risk class: simulation start.
Finding: start errors toast; completion propagation is missing.
Action: emit simulation completed event.

File: `client/src/app/features/simulations/simulation-detail.component.ts`.
Status: checked.
Risk class: readiness/passport propagation.
Finding: finish/repair actions update current simulation only.
Action: refresh readiness, passport, flows after finish/repair.

File: `client/src/app/features/knowledge-hub/knowledge-hub.component.ts`.
Status: checked.
Risk class: large multi-state screen.
Finding: document/QA/summary actions can change context without refreshing agents.
Action: invalidate agent context after knowledge writes.

File: `client/src/app/features/knowledge-hub/components/knowledge-shard.component.ts`.
Status: checked.
Risk class: ingestion failures.
Finding: failed ingestion UI exists, but parent-level refresh and retry outcomes must be tested.
Action: add tests for failed ingestion retry/delete.

File: `client/src/app/features/resources/resources.component.ts`.
Status: checked.
Risk class: empty-vs-error confusion.
Finding: catalog/library/for-you failures can look like empty data.
Action: add distinct error panels.

File: `client/src/app/features/quiz-studio/quiz-studio.component.ts`.
Status: checked.
Risk class: attempts/history blank.
Finding: attempts and history failures are swallowed or weakly shown.
Action: add visible history errors and quiz event invalidation.

File: `client/src/app/features/project-studio/project-studio.component.ts`.
Status: checked.
Risk class: stats and evidence propagation.
Finding: stats failure swallowed and project events do not refresh passport/portfolio.
Action: refresh stats after mutations and emit evidence events.

File: `client/src/app/features/course-builder/course-list.component.ts`.
Status: checked.
Risk class: generated course state.
Finding: list/generate failures handled, but external course creation needs refresh.
Action: subscribe to course invalidation.

File: `client/src/app/features/course-builder/course-detail.component.ts`.
Status: checked.
Risk class: generated artifacts and progress.
Finding: generated flow/quiz/visual/project needs destination invalidation.
Action: add artifact receipt and stale-state refresh.

File: `client/src/app/features/cohorts/cohorts.component.ts`.
Status: checked.
Risk class: missing error handlers.
Finding: list/detail/member operations have several silent errors.
Action: add per-panel errors and mutation toasts.

File: `client/src/app/features/live-sessions/live-sessions.component.ts`.
Status: checked.
Risk class: org session loading.
Finding: mine/org/detail/start errors are weak or missing.
Action: add load and action errors.

File: `client/src/app/features/peer-rooms/peer-rooms-list.component.ts`.
Status: checked.
Risk class: room list and join.
Finding: errors mostly handled, but live updates absent from static pass.
Action: add polling/socket or refresh affordance.

File: `client/src/app/features/peer-rooms/peer-room-detail.component.ts`.
Status: checked.
Risk class: stale shared room.
Finding: message/send/moderation flows update current response only.
Action: real-time refresh and generated-flow invalidation.

File: `client/src/app/features/community/community.component.ts`.
Status: checked.
Risk class: moderator/report/thread blanks.
Finding: project list/reports/threads/upvote have weak or missing error handling.
Action: add panel errors and optimistic rollback.

File: `client/src/app/features/voice/voice-room.component.ts`.
Status: checked.
Risk class: voice provider/session list.
Finding: provider status and session list errors are weak; mock provider common.
Action: show provider status and add session load errors.

File: `client/src/app/features/workflows/workflows.component.ts`.
Status: checked.
Risk class: disabled-vs-failed confusion.
Finding: status failure sets enabled false and graph load has no error handler.
Action: distinguish disabled by config from load failure.

File: `client/src/app/features/intelligence/intelligence-cockpit.component.ts`.
Status: checked.
Risk class: stale intelligence.
Finding: depends on many learning domains but no central invalidation.
Action: refresh after roadmap/quiz/project/mistake events.

File: `client/src/app/features/skill-twin/skill-twin.component.ts`.
Status: checked.
Risk class: stale model.
Finding: manual refresh only after many upstream changes.
Action: subscribe to learning-state invalidation.

File: `client/src/app/features/mistakes/mistakes.component.ts`.
Status: checked.
Risk class: hidden due/action failures.
Finding: due list/action toggle/stat refresh errors are weak.
Action: add errors and rollback.

File: `client/src/app/features/mentor-council/mentor-council.component.ts`.
Status: checked.
Risk class: stale agent context.
Finding: generated advice can use stale context if invalidation did not fire.
Action: include context version/freshness.

File: `client/src/app/features/replay/replay.component.ts`.
Status: checked.
Risk class: regeneration.
Finding: generate on constructor and regenerate share loading/error path.
Action: split initial load and regenerate states.

### Client Outcome and Ecosystem files

File: `client/src/app/features/skill-passport/skill-passport.component.ts`.
Status: checked.
Risk class: stale evidence.
Finding: recompute is manual after evidence-producing events.
Action: auto mark stale or recompute after verified events.

File: `client/src/app/features/skill-passport/public-passport.component.ts`.
Status: checked.
Risk class: public visibility.
Finding: public view depends on privacy/public settings freshness.
Action: refresh after privacy/passport visibility changes.

File: `client/src/app/features/career-readiness/career-readiness.component.ts`.
Status: checked.
Risk class: missing role-load error.
Finding: roles error is swallowed.
Action: add role-load error and readiness invalidation.

File: `client/src/app/features/outcome-council/outcome-council.component.ts`.
Status: checked.
Risk class: stale readiness.
Finding: council depends on readiness/passport context freshness.
Action: include generatedAt and source freshness checks.

File: `client/src/app/features/portfolio/portfolio.component.ts`.
Status: checked.
Risk class: public link and stale portfolio.
Finding: generated portfolio can lag behind Skill Passport.
Action: mark stale after evidence changes and validate username before link copy.

File: `client/src/app/features/portfolio/public-portfolio.component.ts`.
Status: checked.
Risk class: public privacy.
Finding: public route depends on portfolio public settings.
Action: retest make-private and unpublish flows.

File: `client/src/app/features/interview/interview.component.ts`.
Status: checked.
Risk class: metadata/session history blank.
Finding: types/archetypes/session refresh errors are weak.
Action: add visible metadata/history errors.

File: `client/src/app/features/resume/resume.component.ts`.
Status: checked.
Risk class: stale generated content.
Finding: resume generation depends on evidence but no automatic stale marker exists.
Action: mark stale after profile/passport/project changes.

File: `client/src/app/features/applications/applications.component.ts`.
Status: checked.
Risk class: empty-vs-error confusion.
Finding: constructor list error only stops loading.
Action: add loadError and partial bulk handling.

File: `client/src/app/features/ledger/ledger.component.ts`.
Status: checked.
Risk class: filtered export.
Finding: CSV export uses current filtered in-memory entries.
Action: add server full export if required.

File: `client/src/app/features/mentor-marketplace/mentors.component.ts`.
Status: checked.
Risk class: history/session tabs and mentor workflow.
Finding: sessions/profile/list load errors are weak; URL decides tab.
Action: add route data tab selection and complete session lifecycle.

File: `client/src/app/features/marketplace/marketplace.component.ts`.
Status: checked.
Risk class: use-template incomplete.
Finding: "Use" does not clone/create assets.
Action: implement type-specific clone.

File: `client/src/app/features/creator-studio/creator-studio.component.ts`.
Status: checked.
Risk class: incomplete template content.
Finding: content payload is only a goal.
Action: add type-specific schema and validation.

File: `client/src/app/features/institution/institution.component.ts`.
Status: checked.
Risk class: permission and sampled data.
Finding: student nav exposes forbidden screen; assignments are foundation.
Action: guard/hide and implement real assignment records.

### Client Account files

File: `client/src/app/features/certificates/certificates.component.ts`.
Status: checked.
Risk class: verify/share edge cases.
Finding: copy/verify depends on current certificate id/link state.
Action: test invalid/revoked ids and clipboard failure.

File: `client/src/app/features/billing/billing.component.ts`.
Status: checked.
Risk class: mock/live payment confusion.
Finding: mock checkout is first-class in UI.
Action: show environment/provider and refresh entitlements.

File: `client/src/app/features/billing/pricing.component.ts`.
Status: checked.
Risk class: user expectation.
Finding: pricing copy mentions mock payment mode.
Action: ensure production does not expose mock checkout.

File: `client/src/app/features/platform/offline.component.ts`.
Status: checked.
Risk class: overpromised offline support.
Finding: offline support appears narrower than copy.
Action: clarify or implement promised entities.

File: `client/src/app/features/platform/integrations.component.ts`.
Status: checked.
Risk class: auth download and provider status.
Finding: direct calendar download can miss auth header.
Action: use authenticated blob or signed URL.

File: `client/src/app/features/platform/developer.component.ts`.
Status: checked.
Risk class: forbidden screen and ObjectId crash.
Finding: protected endpoint calls fire on init.
Action: guard screen and validate org id.

File: `client/src/app/features/platform/security.component.ts`.
Status: checked.
Risk class: session identity.
Finding: current device detection is heuristic.
Action: track current session id.

File: `client/src/app/features/platform/data-governance.component.ts`.
Status: checked.
Risk class: export URL/job polling.
Finding: download URL semantics can fail across origins.
Action: return absolute/signed URL or fetch blob.

File: `client/src/app/features/privacy/privacy.component.ts`.
Status: checked.
Risk class: silent settings and destructive propagation.
Finding: settings load error swallowed.
Action: add error state and broadcast destructive mutations.

File: `client/src/app/features/profile/profile.component.ts`.
Status: checked.
Risk class: stale auth/profile context.
Finding: profile save does not obviously refresh auth user and dependent goals.
Action: refresh auth/profile and mark goal-dependent domains stale.

### Server agent and learning files

File: `server/src/modules/agents/agent-orchestrator.service.ts`.
Status: checked.
Risk class: command orchestration.
Finding: command execution is not a multi-domain mutation planner.
Action: implement operation planner and receipts.

File: `server/src/modules/agents/core/agent-session.service.ts`.
Status: checked.
Risk class: session title/history.
Finding: title derives from first user message and after assistant save.
Action: semantic title at creation plus refinement.

File: `server/src/modules/agents/core/chat-command-registry.service.ts`.
Status: checked.
Risk class: first-match command collision.
Finding: only one command wins.
Action: support multi-step typed operations.

File: `server/src/modules/agents/core/context-engine.service.ts`.
Status: checked.
Risk class: stale context cache.
Finding: invalidates on selected progression events only.
Action: invalidate on every learning mutation.

File: `server/src/modules/agents/core/agent-tools.ts`.
Status: checked.
Risk class: read-only tools.
Finding: tools are not central app mutation tools.
Action: add explicit mutation tools with confirmation.

File: `server/src/modules/agents/core/tool-augmentation.service.ts`.
Status: checked.
Risk class: advisory-only tool use.
Finding: tool augmentation provides context, not write orchestration.
Action: separate read tools from mutation tools.

File: `server/src/modules/roadmap/roadmap.service.ts`.
Status: checked.
Risk class: progress and dependency invalidation.
Finding: progress percentage uses completed weeks only.
Action: emit roadmap content/progress/active events.

File: `server/src/modules/roadmap/roadmap-chat-commands.ts`.
Status: checked.
Risk class: limited chat mutation scope.
Finding: roadmap commands do not reconcile Today/Dashboard.
Action: return affected domains and run dependent recalculation where appropriate.

File: `server/src/modules/daily-plan/daily-plan.service.ts`.
Status: checked.
Risk class: stale persisted plan.
Finding: existing plan reused until explicit recalc.
Action: dependency hash and stale flag.

File: `server/src/modules/progression/progression.service.ts`.
Status: checked.
Risk class: notifications without UI invalidation.
Finding: event handling nudges but does not refresh Angular screens.
Action: expose domain invalidation event stream.

File: `server/src/modules/learning-intelligence/learning-intelligence.service.ts`.
Status: checked.
Risk class: stale derived analytics.
Finding: depends on many data sources.
Action: recompute or mark stale after upstream events.

File: `server/src/modules/flows/flows.service.ts`.
Status: checked.
Risk class: flow repair propagation.
Finding: flow changes should affect Today/Mistakes/Progress.
Action: emit flow changed and repair completed events.

File: `server/src/modules/projects/services/projects.service.ts`.
Status: checked.
Risk class: evidence propagation.
Finding: project submit/review should refresh passport/portfolio/readiness.
Action: emit project evidence events.

File: `server/src/modules/projects/services/project-review.generator.ts`.
Status: checked.
Risk class: AI review limitation.
Finding: static code analysis marked future.
Action: label limitations or implement analysis.

File: `server/src/modules/course-builder/course-builder.service.ts`.
Status: checked.
Risk class: generated artifacts.
Finding: course-generated quiz/flow/project need dependent refresh.
Action: emit artifact created events.

File: `server/src/modules/assessment/services/assessment.service.ts`.
Status: checked.
Risk class: quiz downstream updates.
Finding: quiz graded should update mistakes/intelligence/passport.
Action: verify events and frontend consumption.

File: `server/src/modules/skill-passport/skill-passport.service.ts`.
Status: checked.
Risk class: recompute timing.
Finding: derived passport can lag evidence.
Action: event-driven recompute or stale marker.

File: `server/src/modules/community/services/community.service.ts`.
Status: checked.
Risk class: moderation/report state.
Finding: frontend hides some failures.
Action: ensure clear response contracts for report permissions.

File: `server/src/modules/cohort/services/cohort.service.ts`.
Status: checked.
Risk class: org permissions and member operations.
Finding: frontend lacks many error handlers.
Action: add explicit error contracts and tests.

### Server Ecosystem and Account files

File: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Status: checked.
Risk class: route collision and role behavior.
Finding: marketplace profiles and sessions share controller paths.
Action: test all routes and auth roles.

File: `server/src/modules/mentor-marketplace/mentor-marketplace.service.ts`.
Status: checked.
Risk class: visibility, duplicate sessions, notes.
Finding: list all profiles and request sessions without duplicate/self checks.
Action: enforce marketplace visibility and request rules.

File: `server/src/modules/marketplace/marketplace.controller.ts`.
Status: checked.
Risk class: template lifecycle.
Finding: admin review exists but clone/use behavior incomplete.
Action: add type-specific create endpoints.

File: `server/src/modules/marketplace/marketplace.service.ts`.
Status: checked.
Risk class: no asset clone.
Finding: `useTemplate` increments and returns route/content.
Action: create actual assets before usage increment.

File: `server/src/modules/institution/institution.controller.ts`.
Status: checked.
Risk class: role-gated route exposed to students.
Finding: admin/mentor only.
Action: align frontend nav and route guard.

File: `server/src/modules/institution/institution.service.ts`.
Status: checked.
Risk class: assignment foundation and sampling.
Finding: assign is announcement-only and reports use sampled data.
Action: implement assignments and sample metadata.

File: `server/src/modules/developer/developer.controller.ts`.
Status: checked.
Risk class: OrgManage permission and org id.
Finding: passes organizationId to service.
Action: use validated organization document id.

File: `server/src/modules/developer/developer.service.ts`.
Status: checked.
Risk class: ObjectId construction.
Finding: casts orgId/id repeatedly.
Action: validate ids and handle non-ObjectId org identifiers.

File: `server/src/modules/integrations/integrations.controller.ts`.
Status: checked.
Risk class: calendar export auth.
Finding: `.ics` endpoint exists under authenticated integrations controller.
Action: use token-safe download.

File: `server/src/modules/integrations/integrations.service.ts`.
Status: checked.
Risk class: foundation connectors.
Finding: calendar/export/webhook behavior is generic/foundation.
Action: connect real learner schedule and provider states.

File: `server/src/modules/integrations/google-calendar.service.ts`.
Status: checked.
Risk class: provider config.
Finding: missing Google config throws explicit error.
Action: expose configuration state in UI.

File: `server/src/modules/data-governance/data-governance.controller.ts`.
Status: checked.
Risk class: export/delete lifecycle.
Finding: user/org export routes exist with different permissions.
Action: test all roles and polling.

File: `server/src/modules/data-governance/data-governance.service.ts`.
Status: checked.
Risk class: fileUrl portability.
Finding: returns `fileUrl` from job.
Action: signed absolute URL or authenticated blob.

File: `server/src/modules/privacy/privacy.controller.ts`.
Status: checked.
Risk class: destructive actions.
Finding: endpoints exist for export/private/reset/clear.
Action: broadcast mutations to app surfaces.

File: `server/src/modules/privacy/privacy.service.ts`.
Status: checked.
Risk class: data clearing propagation.
Finding: backend can change state used by multiple screens.
Action: invalidate affected frontend queries.

File: `server/src/modules/sessions/sessions.controller.ts`.
Status: checked.
Risk class: logout/session revocation.
Finding: logout-all clears refresh hash.
Action: handle already-issued access tokens clearly.

File: `server/src/modules/sessions/sessions.service.ts`.
Status: checked.
Risk class: malformed session ids and current session.
Finding: ObjectId cast and heuristic current session.
Action: validate id and track session id.

File: `server/src/modules/billing/billing.controller.ts`.
Status: checked.
Risk class: mock/live routes.
Finding: mock checkout endpoint exists.
Action: guard production access and test provider mode.

File: `server/src/modules/billing/services/billing.service.ts`.
Status: checked.
Risk class: entitlements and subscription state.
Finding: provider can default to mock.
Action: emit entitlement changed and fail closed in production.

File: `server/src/modules/billing/providers/mock-payment.provider.ts`.
Status: checked.
Risk class: fake payment success.
Finding: always verifies as paid.
Action: never use as production payment provider.

File: `server/src/modules/voice/voice.module.ts`.
Status: checked.
Risk class: mock voice provider.
Finding: mock is default provider.
Action: expose live/mock state and configure production provider.

File: `server/src/modules/voice/voice.provider.ts`.
Status: checked.
Risk class: voice capability expectation.
Finding: mock provider round-trips text/simple audio behavior.
Action: label demo mode clearly.

File: `server/src/modules/visuals/visuals.module.ts`.
Status: checked.
Risk class: mock image provider.
Finding: mock image provider default.
Action: expose provider status in Visual Studio.

File: `server/src/modules/visuals/providers/image-provider.ts`.
Status: checked.
Risk class: generated image expectation.
Finding: mock provider supplies deterministic data/illustration.
Action: configure real provider or label mock output.

File: `server/src/modules/practice/practice.service.ts`.
Status: checked.
Risk class: code execution fallback.
Finding: Piston fallback to mock execution exists.
Action: show execution provider per run.

File: `server/src/modules/practice/providers/mock-execution.provider.ts`.
Status: checked.
Risk class: non-real execution.
Finding: mock provider does not execute code.
Action: label results and avoid grading as real execution.

File: `server/src/modules/reports/services/reports.service.ts`.
Status: checked.
Risk class: incomplete enterprise reporting.
Finding: PDF export and placement-readiness scoring are future.
Action: either implement or hide/label incomplete report features.

File: `server/src/modules/push/schemas/push-subscription.schema.ts`.
Status: checked.
Risk class: push notification expectation.
Finding: VAPID/web-push sender is placeholder.
Action: do not promise push delivery until configured.

File: `server/src/modules/notifications/schemas/notification.schema.ts`.
Status: checked.
Risk class: notification fan-out.
Finding: multi-channel/BullMQ fan-out is later work.
Action: document current notification delivery behavior.

### Verification files and commands that remain blocked

Check: `npm run build:server`.
Status: blocked.
Reason: `node.exe` not on PATH in this shell.
Next action: fix PATH or run in a shell where Node is installed.

Check: `npm run build:client`.
Status: blocked.
Reason: `node.exe` not on PATH in this shell.
Next action: fix PATH or run in a shell where Node is installed.

Check: full browser walkthrough of every sidebar route.
Status: not completed in this pass.
Reason: build/dev server verification blocked by Node availability.
Next action: after Node works, run app and execute the per-screen smoke checklist above.

Check: server unit/integration tests.
Status: not completed in this pass.
Reason: same Node runtime blocker.
Next action: run server tests after PATH fix.

Check: frontend unit/E2E tests.
Status: not completed in this pass.
Reason: same Node runtime blocker.
Next action: run Angular tests and Playwright/Cypress route matrix after PATH fix.

## Third pass - endpoint contract and 5k expansion

Purpose:
- Push the audit to the deeper line-by-line level requested.
- Convert screen findings into API contracts that can become issue tickets.
- Make every important backend route testable from a QA perspective.
- Make every frontend service dependency visible.
- Make downstream refresh expectations explicit.

Reading rule for this section:
- `Endpoint` is the backend route found in controller source.
- `Primary screen` is the most likely frontend surface.
- `Risk` is the failure class to test.
- `Refresh contract` is what should update after success.
- `Negative test` is the minimum failure/edge case to cover.

### Backend endpoint contract matrix - auth and shell

Endpoint: `POST /auth/register`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: Register.
Risk: validation and OTP creation failure can leave loading stuck.
Refresh contract: auth state remains logged out until verification.
Negative test: duplicate email, disallowed domain, weak password.

Endpoint: `POST /auth/verify-otp`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: OTP verify.
Risk: expired OTP and wrong OTP must not create partial session.
Refresh contract: auth tokens, user, org context, onboarding state.
Negative test: wrong code, expired code, repeated attempts.

Endpoint: `POST /auth/resend-otp`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: OTP verify.
Risk: rate-limit and missing email handling.
Refresh contract: resend timer only.
Negative test: resend too often, unknown email.

Endpoint: `GET /auth/signup-config`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: Register.
Risk: config load error currently may be ignored.
Refresh contract: allowed domain UI.
Negative test: endpoint fails, register still clearly explains rules.

Endpoint: `POST /auth/login`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: Login.
Risk: bad credentials, unverified account, session tracking.
Refresh contract: auth user, tokens, org context, shell entitlements.
Negative test: wrong password, stale refresh token, revoked user.

Endpoint: `GET /auth/google/config`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: Google sign-in.
Risk: missing config silently hides provider.
Refresh contract: Google button state.
Negative test: provider not configured.

Endpoint: `POST /auth/google`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: Google sign-in.
Risk: invalid credential and domain restriction.
Refresh contract: auth user, tokens, onboarding.
Negative test: invalid token, disallowed domain.

Endpoint: `POST /auth/refresh`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: every protected screen.
Risk: frontend does not call it before logout.
Refresh contract: new access token and retried original request.
Negative test: expired refresh token, concurrent 401 requests.

Endpoint: `POST /auth/logout`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: shell/profile.
Risk: logout request failure should still clear local state safely.
Refresh contract: local auth cleared.
Negative test: server down during logout.

Endpoint: `GET /auth/me`.
Controller: `server/src/modules/auth/auth.controller.ts`.
Primary screen: shell/profile boot.
Risk: stale token causes redirect storm.
Refresh contract: current user and shell state.
Negative test: expired access token should refresh first.

Endpoint: `GET /feature-flags`.
Controller: `server/src/modules/feature-flags/feature-flags.controller.ts`.
Primary screen: shell.
Risk: failure swallowed.
Refresh contract: feature visibility and navigation.
Negative test: 500 response must not silently expose disabled features.

Endpoint: `GET /entitlements/me`.
Controller: `server/src/modules/entitlements/entitlements.controller.ts`.
Primary screen: shell/billing.
Risk: failure swallowed, plan-gated features may show wrong state.
Refresh contract: feature gates, billing cards, sidebar.
Negative test: 401/403/500 and mock subscription.

Endpoint: `POST /entitlements/check`.
Controller: `server/src/modules/entitlements/entitlements.controller.ts`.
Primary screen: gated feature actions.
Risk: action may run before entitlement is known.
Refresh contract: no broad refresh, but action should receive allow/deny.
Negative test: insufficient plan.

Endpoint: `POST /entitlements/consume`.
Controller: `server/src/modules/entitlements/entitlements.controller.ts`.
Primary screen: AI/action quota consumers.
Risk: quota consumption must be atomic.
Refresh contract: usage meter, billing page, shell entitlement state.
Negative test: over-quota parallel requests.

Endpoint: `GET /organizations/context`.
Controller: `server/src/modules/tenancy/organizations.controller.ts`.
Primary screen: shell/org-aware screens.
Risk: org context failure can break Developer/Institution visibility.
Refresh contract: workspace nav and org guards.
Negative test: user with no org, user with malformed org id.

Endpoint: `GET /organizations/mine`.
Controller: `server/src/modules/tenancy/organizations.controller.ts`.
Primary screen: organization/workspace nav.
Risk: org nav may be stale.
Refresh contract: workspace nav.
Negative test: org membership removed while logged in.

Endpoint: `GET /notifications`.
Controller: `server/src/modules/notifications/notifications.controller.ts`.
Primary screen: shell/notifications.
Risk: notification failure should not break shell.
Refresh contract: unread count.
Negative test: endpoint fails and shell remains usable.

Endpoint: `POST /notifications/:id/read`.
Controller: `server/src/modules/notifications/notifications.controller.ts`.
Primary screen: notifications.
Risk: optimistic read can diverge.
Refresh contract: notification list and unread count.
Negative test: invalid id, unauthorized id.

Endpoint: `POST /notifications/read-all`.
Controller: `server/src/modules/notifications/notifications.controller.ts`.
Primary screen: notifications.
Risk: partial read-all failure.
Refresh contract: unread count zero only after success.
Negative test: server failure after some updates.

### Backend endpoint contract matrix - Asta, tutor, and agent context

Endpoint: `GET /ai/providers`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Asta/admin AI status.
Risk: provider state missing can hide mock/fallback reality.
Refresh contract: provider indicators.
Negative test: no live providers configured.

Endpoint: `GET /ai/tools`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Asta tools panel.
Risk: tools are context/read-only, not mutation-capable.
Refresh contract: tool list only.
Negative test: missing tool provider.

Endpoint: `GET /ai/next-action`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Dashboard/Asta OS Today strip.
Risk: stale context after roadmap update.
Refresh contract: dashboard next action and Asta strip.
Negative test: roadmap changed immediately before call.

Endpoint: `POST /ai/agent/message`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Asta OS, AI Tutor REST fallback.
Risk: fallback not called for terminal stream errors.
Refresh contract: session, messages, affected domains if mutation occurs.
Negative test: command mutates roadmap and Today must refresh.

Endpoint: `GET /ai/sessions`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Asta history, AI Tutor history.
Risk: blank history when endpoint fails.
Refresh contract: session list.
Negative test: 500 response, no sessions, many sessions.

Endpoint: `GET /ai/sessions/search`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Asta history search.
Risk: search result mismatch with tabs.
Refresh contract: filtered session list.
Negative test: empty query, special characters, backend failure.

Endpoint: `PATCH /ai/sessions/:id/pin`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Asta history.
Risk: invalid id can fail silently or reorder incorrectly.
Refresh contract: session list order.
Negative test: invalid id, unauthorized session.

Endpoint: `GET /ai/sessions/:id`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Asta history content.
Risk: invalid id may look like empty history.
Refresh contract: selected session messages.
Negative test: invalid id, deleted session, forbidden session.

Endpoint: `POST /ai/feedback`.
Controller: `server/src/modules/agents/ai-agent.controller.ts`.
Primary screen: Asta OS, AI Tutor, Agent Workspace.
Risk: frontend often has no error handler.
Refresh contract: feedback marker only.
Negative test: missing message id.

Endpoint: `POST /tutor/ask`.
Controller: `server/src/modules/agents/tutor.controller.ts`.
Primary screen: legacy tutor/fallback.
Risk: classic tutor stream path does not use REST fallback consistently.
Refresh contract: tutor session and title.
Negative test: streaming fails, REST succeeds.

Endpoint: `GET /tutor/sessions`.
Controller: `server/src/modules/agents/tutor.controller.ts`.
Primary screen: tutor history.
Risk: history load blank.
Refresh contract: tutor history list.
Negative test: endpoint failure.

Endpoint: WebSocket `agent:message`.
Controller: `server/src/sockets/events.gateway.ts`.
Primary screen: Asta OS, AI Tutor, Agent Workspace.
Risk: terminal error events complete stream instead of fallback.
Refresh contract: assistant turn, session id, operation receipt.
Negative test: unauthorized socket, busy socket, orchestrator failure.

Endpoint: WebSocket terminal `error`.
Controller: `server/src/sockets/events.gateway.ts`.
Primary screen: all chat surfaces.
Risk: failed assistant message with no fallback.
Refresh contract: fallback or validation error.
Negative test: transport failure after partial answer.

### Backend endpoint contract matrix - roadmap and daily plan

Endpoint: `POST /roadmaps/generate`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap Generate, Asta command.
Risk: generated roadmap does not refresh Today/Dashboard.
Refresh contract: roadmap list, active roadmap, Today stale/recalc, dashboard.
Negative test: generation success while Dashboard is open.

Endpoint: `GET /roadmaps/my`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap list.
Risk: list stale after Asta creates/archives roadmap.
Refresh contract: roadmap list.
Negative test: no roadmaps, many roadmaps, archived roadmaps.

Endpoint: `GET /roadmaps/active`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Dashboard, Today, Asta context.
Risk: active roadmap stale after activation/replan.
Refresh contract: dashboard roadmap card and Today dependency.
Negative test: no active roadmap.

Endpoint: `GET /roadmaps/:id`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap detail.
Risk: invalid id and forbidden id must be explicit.
Refresh contract: selected roadmap detail.
Negative test: malformed id, other user's id.

Endpoint: `PATCH /roadmaps/:id/progress`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap detail, Dashboard, Asta command.
Risk: task completion does not affect progress percent.
Refresh contract: roadmap, dashboard, intelligence, skill twin, today stale state.
Negative test: complete task only, complete week, undo completion.

Endpoint: `POST /roadmaps/:id/regenerate-week`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap detail, Asta command.
Risk: regenerated week resets/changes tasks but Today remains old.
Refresh contract: roadmap, versions, Today stale/recalc, dashboard next action.
Negative test: regenerate completed week, invalid week number.

Endpoint: `POST /roadmaps/:id/replan`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap detail, Asta command.
Risk: downstream stale state.
Refresh contract: roadmap, versions, Today, dashboard, intelligence.
Negative test: replan with no active unfinished weeks.

Endpoint: `GET /roadmaps/:id/versions`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap detail versions.
Risk: version tab blank on failure.
Refresh contract: version list.
Negative test: roadmap with no versions.

Endpoint: `GET /roadmaps/:id/versions/:version/diff`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap detail diff.
Risk: invalid version failure.
Refresh contract: diff viewer.
Negative test: old version missing.

Endpoint: `POST /roadmaps/:id/versions/:version/restore`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap detail.
Risk: restored roadmap content leaves Today/Dashboard stale.
Refresh contract: roadmap, versions, Today stale/recalc, dashboard.
Negative test: restore version with removed tasks.

Endpoint: `PATCH /roadmaps/:id/status`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap list/detail.
Risk: active singular state not reflected in open Dashboard.
Refresh contract: roadmap list, active roadmap, dashboard.
Negative test: activate archived roadmap.

Endpoint: `DELETE /roadmaps/:id`.
Controller: `server/src/modules/roadmap/roadmap.controller.ts`.
Primary screen: Roadmap list.
Risk: deleting active roadmap leaves Today/Dashboard pointing to removed roadmap.
Refresh contract: roadmap list, active roadmap null, Today stale, dashboard empty state.
Negative test: delete active roadmap while Today open.

Endpoint: `GET /daily-plan/today`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today, Dashboard.
Risk: returns stale persisted plan.
Refresh contract: current plan plus dependency freshness metadata.
Negative test: roadmap changed after plan generation.

Endpoint: `POST /daily-plan/generate`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today.
Risk: duplicate generation or stale dependencies.
Refresh contract: Today plan, dashboard strip.
Negative test: generate when plan already exists.

Endpoint: `POST /daily-plan/complete-item`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today.
Risk: dashboard and ledger can be stale after completion.
Refresh contract: Today, dashboard strip, streak, ledger if completed.
Negative test: complete same item twice, undo item.

Endpoint: `POST /daily-plan/item-note`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today.
Risk: note save failure after local edit.
Refresh contract: Today item.
Negative test: overlength note.

Endpoint: `POST /daily-plan/reflection`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today.
Risk: mood/reflection lost silently.
Refresh contract: Today reflection and history.
Negative test: invalid mood value.

Endpoint: `POST /daily-plan/carry-over`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today.
Risk: resurrects stale tasks after roadmap replan.
Refresh contract: Today plan, dashboard strip.
Negative test: old source id no longer exists.

Endpoint: `POST /daily-plan/reorder`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today.
Risk: drag UI can diverge if save fails.
Refresh contract: Today order.
Negative test: missing item id in order.

Endpoint: `POST /daily-plan/recalculate`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today, Asta command.
Risk: destructive replacement without explaining removed items.
Refresh contract: Today, dashboard, Asta receipt.
Negative test: recalc after completed items.

Endpoint: `POST /daily-plan/quick-mode`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today.
Risk: mode changes not reflected in dashboard.
Refresh contract: Today plan and dashboard strip.
Negative test: invalid mode.

Endpoint: `GET /daily-plan/streak`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today.
Risk: failure swallowed.
Refresh contract: streak panel.
Negative test: no history.

Endpoint: `GET /daily-plan/history`.
Controller: `server/src/modules/daily-plan/daily-plan.controller.ts`.
Primary screen: Today history.
Risk: history blank on failure.
Refresh contract: history strip.
Negative test: date window with no plans.

### Backend endpoint contract matrix - learning artifacts

Endpoint: `POST /flows/generate`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow Studio, Asta command.
Risk: new active flow not reflected in Today.
Refresh contract: flows list, Today stale/recalc, dashboard next action.
Negative test: generated flow while Today open.

Endpoint: `POST /flows/from-roadmap/:roadmapId`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Roadmap/Course/Asta.
Risk: generated flow and roadmap dependencies diverge.
Refresh contract: flows, roadmap linked state, Today.
Negative test: invalid roadmap id.

Endpoint: `GET /flows`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow Studio.
Risk: empty-vs-error.
Refresh contract: flow list.
Negative test: backend failure.

Endpoint: `GET /flows/:id`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow detail.
Risk: invalid id and forbidden id.
Refresh contract: selected flow.
Negative test: malformed id.

Endpoint: `PATCH /flows/:id`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow detail.
Risk: local flow title/status can diverge.
Refresh contract: selected flow and list.
Negative test: forbidden update.

Endpoint: `POST /flows/:id/nodes`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow detail, Mistakes repair, Asta command.
Risk: node add should affect Today if active flow.
Refresh contract: flow, Today stale/recalc, dashboard next action.
Negative test: invalid node payload.

Endpoint: `PATCH /flows/:id/nodes/:nodeId`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow detail.
Risk: optimistic position/status/note divergence.
Refresh contract: flow, intelligence, Today if status matters.
Negative test: invalid node id.

Endpoint: `DELETE /flows/:id/nodes/:nodeId`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow detail.
Risk: active Today item can point at deleted node.
Refresh contract: flow and Today stale state.
Negative test: delete current node.

Endpoint: `POST /flows/:id/execute-node/:nodeId`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow detail.
Risk: execution result can fail after status changes.
Refresh contract: flow, progress/intelligence if completion occurred.
Negative test: execute locked/unavailable node.

Endpoint: `POST /flows/:id/recalculate`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow detail.
Risk: recalculated statuses not propagated.
Refresh contract: flow, Today, dashboard.
Negative test: graph with cycles or missing dependencies.

Endpoint: `POST /flows/:id/export`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow detail.
Risk: export failure only toast.
Refresh contract: download only.
Negative test: large flow export.

Endpoint: `DELETE /flows/:id`.
Controller: `server/src/modules/flows/flows.controller.ts`.
Primary screen: Flow Studio.
Risk: Today points at removed flow.
Refresh contract: flows list, Today stale, dashboard.
Negative test: delete active flow.

Endpoint: `POST /assessment/quizzes`.
Controller: `server/src/modules/assessment/assessment.controller.ts`.
Primary screen: Quiz Studio, Spaces, Course, Voice.
Risk: generated quiz not selected/refreshed.
Refresh contract: quiz list, query/deep-link selection.
Negative test: create quiz from source then open Quizzes.

Endpoint: `GET /assessment/quizzes`.
Controller: `server/src/modules/assessment/assessment.controller.ts`.
Primary screen: Quiz Studio.
Risk: load failure vs empty.
Refresh contract: quiz list.
Negative test: no quizzes, endpoint failure.

Endpoint: `GET /assessment/quizzes/:id`.
Controller: `server/src/modules/assessment/assessment.controller.ts`.
Primary screen: Quiz taking.
Risk: invalid id.
Refresh contract: active quiz.
Negative test: deleted quiz id.

Endpoint: `POST /assessment/quizzes/:id/attempts`.
Controller: `server/src/modules/assessment/assessment.controller.ts`.
Primary screen: Quiz Studio.
Risk: attempt completion must refresh mistakes/intelligence/passport.
Refresh contract: attempts, stats, mistakes, intelligence, skill twin, passport.
Negative test: submit incomplete answers.

Endpoint: `GET /assessment/attempts`.
Controller: `server/src/modules/assessment/assessment.controller.ts`.
Primary screen: Quiz Studio history.
Risk: currently swallowed on failure.
Refresh contract: attempts history.
Negative test: endpoint failure.

Endpoint: `GET /assessment/quizzes/:id/attempts`.
Controller: `server/src/modules/assessment/assessment.controller.ts`.
Primary screen: Quiz attempt history.
Risk: history tab blank.
Refresh contract: selected quiz attempt history.
Negative test: no attempts.

Endpoint: `GET /assessment/stats`.
Controller: `server/src/modules/assessment/assessment.controller.ts`.
Primary screen: Quiz Studio, Dashboard.
Risk: stale stats after attempt.
Refresh contract: stats cards and dashboard weak topic.
Negative test: stats endpoint failure.

Endpoint: `POST /projects`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio, Asta command.
Risk: generated project not reflected in dashboard/passport.
Refresh contract: project list/stats, dashboard project panel.
Negative test: create from Asta while Project Studio open.

Endpoint: `GET /projects`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: list failure vs empty.
Refresh contract: project list.
Negative test: archived filter, endpoint failure.

Endpoint: `GET /projects/stats`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio, Dashboard.
Risk: failure swallowed.
Refresh contract: stats cards.
Negative test: stats endpoint down.

Endpoint: `GET /projects/:id`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project detail/panel.
Risk: invalid id.
Refresh contract: selected project.
Negative test: forbidden project.

Endpoint: `PATCH /projects/:id/tasks/:taskId`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: task status changes not updating stats.
Refresh contract: project, stats, dashboard.
Negative test: invalid task id.

Endpoint: `PATCH /projects/:id/tasks/:taskId/reorder`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: order divergence.
Refresh contract: project task order.
Negative test: move first up, last down.

Endpoint: `POST /projects/:id/tasks`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: stats stale.
Refresh contract: project and stats.
Negative test: empty title.

Endpoint: `DELETE /projects/:id/tasks/:taskId`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: stats stale.
Refresh contract: project and stats.
Negative test: delete completed task.

Endpoint: `POST /projects/:id/submit`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: evidence/readiness/passport stale.
Refresh contract: project, passport, portfolio stale, resume stale, readiness.
Negative test: missing github/demo links.

Endpoint: `POST /projects/:id/ai-review`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: review limitations not visible.
Refresh contract: project review, passport/readiness if evidence changes.
Negative test: no submission.

Endpoint: `POST /projects/:id/generate-case-study`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio/Portfolio.
Risk: fallback case study can look AI-authored.
Refresh contract: project, portfolio stale.
Negative test: no project submission.

Endpoint: `PATCH /projects/:id/ai-review/items/:itemId`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: improvement toggles do not refresh readiness.
Refresh contract: project and readiness stale.
Negative test: invalid improvement id.

Endpoint: `PATCH /projects/:id/archive`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: dashboard project panel stale.
Refresh contract: project list/stats, dashboard.
Negative test: archive active recommended project.

Endpoint: `DELETE /projects/:id`.
Controller: `server/src/modules/projects/projects.controller.ts`.
Primary screen: Project Studio.
Risk: passport/portfolio can reference deleted project.
Refresh contract: project list, passport stale, portfolio stale.
Negative test: delete submitted project.

### Backend endpoint contract matrix - knowledge, spaces, visuals, voice

Endpoint: `POST /knowledge/upload`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge Hub.
Risk: ingestion failure after upload.
Refresh contract: documents, agent context invalidation.
Negative test: unsupported file, huge file, ingestion error.

Endpoint: `POST /knowledge/text`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge Hub, Asta save note.
Risk: note saved but context not invalidated.
Refresh contract: documents and agent context.
Negative test: empty text.

Endpoint: `GET /knowledge/documents`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge Hub, Quiz Studio docs.
Risk: no error handler in Quiz Studio docs load.
Refresh contract: document list.
Negative test: endpoint failure.

Endpoint: `GET /knowledge/documents/:id`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge detail/shard.
Risk: invalid id.
Refresh contract: selected doc.
Negative test: failed ingestion doc.

Endpoint: `PATCH /knowledge/documents/:id`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge shard edit.
Risk: title/tag save failure.
Refresh contract: document list, agent context.
Negative test: invalid tags.

Endpoint: `DELETE /knowledge/documents/:id`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge Hub.
Risk: agent answers still cite removed doc if context/cache stale.
Refresh contract: documents and agent context invalidation.
Negative test: delete doc used in recent chat.

Endpoint: `GET /knowledge/documents/:id/summary`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge shard.
Risk: fallback summary quality.
Refresh contract: document summary panel.
Negative test: empty/failed document.

Endpoint: `GET /knowledge/documents/:id/flashcards`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge shard.
Risk: generated cards stale after document edit.
Refresh contract: card panel.
Negative test: document with very little text.

Endpoint: `GET /knowledge/documents/:id/audio-overview`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge shard/Spaces.
Risk: fallback narration vs live provider.
Refresh contract: audio overview.
Negative test: provider failure.

Endpoint: `POST /knowledge/ask`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge chat.
Risk: citations/fallback must be honest.
Refresh contract: QA transcript.
Negative test: no matching sources.

Endpoint: `GET /knowledge/qa`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge chat history.
Risk: blank conversation.
Refresh contract: QA history.
Negative test: endpoint failure.

Endpoint: `POST /knowledge/qa`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge chat.
Risk: answer not saved or not grounded.
Refresh contract: QA history.
Negative test: empty question.

Endpoint: `DELETE /knowledge/qa`.
Controller: `server/src/modules/rag/knowledge.controller.ts`.
Primary screen: Knowledge chat.
Risk: local history stale.
Refresh contract: QA history cleared.
Negative test: delete while request in flight.

Endpoint: `POST /spaces`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Study Spaces.
Risk: new space not visible if list stale.
Refresh contract: spaces list.
Negative test: duplicate/empty title.

Endpoint: `GET /spaces`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Study Spaces.
Risk: list failure vs empty.
Refresh contract: spaces list.
Negative test: endpoint failure.

Endpoint: `GET /spaces/:id`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail.
Risk: invalid/forbidden id.
Refresh contract: selected space.
Negative test: deleted space route.

Endpoint: `PATCH /spaces/:id`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail.
Risk: title/metadata stale.
Refresh contract: space detail and list.
Negative test: empty title.

Endpoint: `POST /spaces/:id/sources`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail.
Risk: source added but artifacts not invalidated.
Refresh contract: space sources and agent context if used.
Negative test: empty source.

Endpoint: `DELETE /spaces/:id/sources/:sourceId`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail.
Risk: generated summary/cards still based on removed source.
Refresh contract: space sources and artifact stale marker.
Negative test: remove source used in answer.

Endpoint: `POST /spaces/:id/ask`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail.
Risk: answer not grounded or source list stale.
Refresh contract: answer panel.
Negative test: no sources.

Endpoint: `POST /spaces/:id/summary`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail.
Risk: summary stale after source change.
Refresh contract: space artifacts.
Negative test: source deleted during generation.

Endpoint: `POST /spaces/:id/flashcards`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail.
Risk: stale artifacts.
Refresh contract: space artifacts.
Negative test: no text source.

Endpoint: `POST /spaces/:id/audio-overview`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail.
Risk: mock voice/fallback output.
Refresh contract: space artifacts and audio status.
Negative test: provider failure.

Endpoint: `POST /spaces/:id/flow`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail, Flow Studio.
Risk: generated flow not refreshing Today/Flows list.
Refresh contract: flow list, Today stale, dashboard.
Negative test: create flow then navigate back to Today.

Endpoint: `POST /spaces/:id/quiz`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail, Quiz Studio.
Risk: generated quiz not selected.
Refresh contract: quiz list and selected quiz.
Negative test: query param selection.

Endpoint: `POST /spaces/:id/visuals`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Space detail, Visual Studio.
Risk: generated visual not refreshing visuals list.
Refresh contract: visuals list and detail route.
Negative test: image provider mock.

Endpoint: `DELETE /spaces/:id`.
Controller: `server/src/modules/spaces/spaces.controller.ts`.
Primary screen: Study Spaces.
Risk: linked generated assets can remain orphaned.
Refresh contract: spaces list and dependent links.
Negative test: delete space with artifacts.

Endpoint: `GET /visuals/status`.
Controller: `server/src/modules/visuals/visuals.controller.ts`.
Primary screen: Visual Studio.
Risk: status error hidden.
Refresh contract: provider indicator.
Negative test: image provider missing.

Endpoint: `POST /visuals/generate`.
Controller: `server/src/modules/visuals/visuals.controller.ts`.
Primary screen: Visual Studio, Asta, Course, Space.
Risk: mock visuals look real.
Refresh contract: visuals list, created visual route.
Negative test: provider fallback.

Endpoint: `POST /visuals/from-flow-node`.
Controller: `server/src/modules/visuals/visuals.controller.ts`.
Primary screen: Flow detail.
Risk: generated visual not linked visibly.
Refresh contract: visual list, flow node source link.
Negative test: invalid flow/node id.

Endpoint: `GET /visuals`.
Controller: `server/src/modules/visuals/visuals.controller.ts`.
Primary screen: Visual Studio.
Risk: list failure vs empty.
Refresh contract: visuals list.
Negative test: endpoint failure.

Endpoint: `GET /visuals/:id`.
Controller: `server/src/modules/visuals/visuals.controller.ts`.
Primary screen: Visual detail.
Risk: invalid id.
Refresh contract: selected visual.
Negative test: deleted visual route.

Endpoint: `PATCH /visuals/:id`.
Controller: `server/src/modules/visuals/visuals.controller.ts`.
Primary screen: Visual detail.
Risk: metadata save stale.
Refresh contract: visual detail/list.
Negative test: empty title.

Endpoint: `POST /visuals/:id/regenerate`.
Controller: `server/src/modules/visuals/visuals.controller.ts`.
Primary screen: Visual detail.
Risk: generated asset changes while source screens still cache old thumbnail.
Refresh contract: visual detail/list and source link refresh.
Negative test: provider failure.

Endpoint: `DELETE /visuals/:id`.
Controller: `server/src/modules/visuals/visuals.controller.ts`.
Primary screen: Visual detail.
Risk: source screen links to deleted visual.
Refresh contract: visuals list and source stale marker.
Negative test: delete visual linked from flow/course.

Endpoint: `GET /voice/status`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: status error hidden, mock provider not clear.
Refresh contract: voice provider indicator.
Negative test: provider disabled.

Endpoint: `POST /voice/ask`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: voice activation overlay.
Risk: command ask path bypasses central mutation receipts.
Refresh contract: spoken answer or operation receipt.
Negative test: asking mutation command by voice.

Endpoint: `POST /voice/sessions`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: created session not listed if list stale.
Refresh contract: session list and selected session.
Negative test: invalid mode.

Endpoint: `GET /voice/sessions`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: list error only stops loading.
Refresh contract: session list.
Negative test: endpoint failure.

Endpoint: `GET /voice/sessions/:id`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: invalid id clears selected state without enough explanation.
Refresh contract: selected session.
Negative test: deleted session route.

Endpoint: `POST /voice/sessions/:id/turn`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: server TTS/mock voice failure.
Refresh contract: session transcript and state idle.
Negative test: audio playback error, provider failure.

Endpoint: `PATCH /voice/sessions/:id`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: rename not reflected in list.
Refresh contract: selected session and list title.
Negative test: empty title.

Endpoint: `POST /voice/sessions/:id/summarize`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: summary stale after more turns.
Refresh contract: session summary.
Negative test: summarize empty transcript.

Endpoint: `POST /voice/sessions/:id/create-flow`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room, Flow Studio.
Risk: generated flow not updating Today.
Refresh contract: flow list, Today stale, dashboard.
Negative test: no transcript.

Endpoint: `POST /voice/sessions/:id/create-quiz`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room, Quiz Studio.
Risk: generated quiz not selected.
Refresh contract: quiz list and selection.
Negative test: no educational content.

Endpoint: `POST /voice/sessions/:id/extract-notes`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room, Knowledge/Study Notes.
Risk: extracted notes not persisted as knowledge unless explicitly done.
Refresh contract: notes panel, optional knowledge invalidation.
Negative test: empty transcript.

Endpoint: `POST /voice/sessions/:id/end`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: duration/state stale.
Refresh contract: selected session and list.
Negative test: end already-ended session.

Endpoint: `DELETE /voice/sessions/:id`.
Controller: `server/src/modules/voice/voice.controller.ts`.
Primary screen: Voice Room.
Risk: selected session deleted but route still points to it.
Refresh contract: session list and navigation.
Negative test: delete active session route.

### Backend endpoint contract matrix - outcome and career

Endpoint: `GET /skill-passport/me`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Skill Passport, Dashboard.
Risk: stale after project/quiz/evidence changes.
Refresh contract: passport state.
Negative test: project submitted while passport open.

Endpoint: `PATCH /skill-passport/me`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Skill Passport.
Risk: visibility toggle divergence.
Refresh contract: passport public settings.
Negative test: save failure must roll back toggle.

Endpoint: `POST /skill-passport/recompute`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Skill Passport, Asta command.
Risk: recompute not triggered after evidence events.
Refresh contract: passport, portfolio/resume stale markers.
Negative test: recompute after deleted project.

Endpoint: `POST /skill-passport/publish`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Skill Passport.
Risk: public route stale.
Refresh contract: passport public state and public preview.
Negative test: username missing.

Endpoint: `POST /skill-passport/unpublish`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Skill Passport.
Risk: public preview still accessible if cache stale.
Refresh contract: public route state.
Negative test: public URL after unpublish.

Endpoint: `GET /skill-passport/evidence`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Skill Passport.
Risk: evidence list stale.
Refresh contract: evidence list.
Negative test: no evidence.

Endpoint: `POST /skill-passport/add-evidence`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Skill Passport.
Risk: resume/portfolio stale.
Refresh contract: evidence, passport, resume stale, portfolio stale.
Negative test: invalid URL.

Endpoint: `POST /skill-passport/from-project/:projectId`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Project Studio/Skill Passport.
Risk: duplicate evidence.
Refresh contract: passport, portfolio, resume.
Negative test: same project twice.

Endpoint: `DELETE /skill-passport/evidence/:id`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Skill Passport.
Risk: resume/portfolio keep removed evidence.
Refresh contract: passport, resume stale, portfolio stale.
Negative test: delete public evidence.

Endpoint: `GET /skill-passport/public/:username`.
Controller: `server/src/modules/skill-passport/skill-passport.controller.ts`.
Primary screen: Public Passport.
Risk: public visibility/privacy not enforced.
Refresh contract: public page.
Negative test: unpublished passport.

Endpoint: `GET /career-readiness/me`.
Controller: `server/src/modules/career-readiness/career-readiness.controller.ts`.
Primary screen: Career Readiness, Dashboard.
Risk: stale after project/interview/passport changes.
Refresh contract: readiness panels.
Negative test: no target role.

Endpoint: `POST /career-readiness/analyze`.
Controller: `server/src/modules/career-readiness/career-readiness.controller.ts`.
Primary screen: Career Readiness, Asta command.
Risk: analysis result does not refresh dashboard.
Refresh contract: readiness, dashboard, outcome council stale.
Negative test: no evidence.

Endpoint: `GET /career-readiness/roles`.
Controller: `server/src/modules/career-readiness/career-readiness.controller.ts`.
Primary screen: Career Readiness.
Risk: roles error swallowed.
Refresh contract: role selector.
Negative test: endpoint failure.

Endpoint: `GET /career-readiness/roles/:id`.
Controller: `server/src/modules/career-readiness/career-readiness.controller.ts`.
Primary screen: Career Readiness.
Risk: invalid role id.
Refresh contract: role detail.
Negative test: unknown role.

Endpoint: `POST /career-readiness/set-target-role`.
Controller: `server/src/modules/career-readiness/career-readiness.controller.ts`.
Primary screen: Career Readiness/Profile.
Risk: profile/agent context stale.
Refresh contract: readiness, profile, agent context, dashboard.
Negative test: invalid role id.

Endpoint: `POST /career-readiness/generate-gap-plan`.
Controller: `server/src/modules/career-readiness/career-readiness.controller.ts`.
Primary screen: Career Readiness, Roadmap/Asta.
Risk: generated plan not linked to roadmap/today.
Refresh contract: readiness and possible roadmap/today stale.
Negative test: no readiness analysis.

Endpoint: `GET /mentor-council`.
Controller: `server/src/modules/mentor-council/mentor-council.controller.ts`.
Primary screen: Mentor Council.
Risk: stale context.
Refresh contract: latest verdict.
Negative test: no activity.

Endpoint: `POST /mentor-council/convene`.
Controller: `server/src/modules/mentor-council/mentor-council.controller.ts`.
Primary screen: Mentor Council.
Risk: stale context version.
Refresh contract: verdict.
Negative test: immediately after roadmap update.

Endpoint: `POST /outcome-council/recommend`.
Controller: `server/src/modules/outcome-council/outcome-council.controller.ts`.
Primary screen: Outcome Council.
Risk: stale readiness/passport.
Refresh contract: outcome recommendations.
Negative test: immediately after project submit.

Endpoint: `GET /outcome-council/latest`.
Controller: `server/src/modules/outcome-council/outcome-council.controller.ts`.
Primary screen: Outcome Council.
Risk: latest can be stale.
Refresh contract: latest result with generatedAt.
Negative test: no latest result.

Endpoint: `GET /portfolio/me`.
Controller: `server/src/modules/portfolio/portfolio.controller.ts`.
Primary screen: Portfolio.
Risk: stale after evidence update.
Refresh contract: portfolio state.
Negative test: no portfolio.

Endpoint: `PATCH /portfolio/me`.
Controller: `server/src/modules/portfolio/portfolio.controller.ts`.
Primary screen: Portfolio.
Risk: conflict overwrites local edits.
Refresh contract: portfolio state.
Negative test: concurrent edit.

Endpoint: `POST /portfolio/generate`.
Controller: `server/src/modules/portfolio/portfolio.controller.ts`.
Primary screen: Portfolio.
Risk: generated from stale passport.
Refresh contract: portfolio and public preview.
Negative test: no evidence.

Endpoint: `POST /portfolio/add-project/:projectId`.
Controller: `server/src/modules/portfolio/portfolio.controller.ts`.
Primary screen: Project Studio/Portfolio.
Risk: duplicate project entry.
Refresh contract: portfolio.
Negative test: project already added.

Endpoint: `POST /portfolio/publish`.
Controller: `server/src/modules/portfolio/portfolio.controller.ts`.
Primary screen: Portfolio.
Risk: missing username/public settings.
Refresh contract: public portfolio route.
Negative test: username absent.

Endpoint: `POST /portfolio/unpublish`.
Controller: `server/src/modules/portfolio/portfolio.controller.ts`.
Primary screen: Portfolio.
Risk: public route cache stale.
Refresh contract: public route disabled.
Negative test: public URL after unpublish.

Endpoint: `GET /portfolio/public/:username`.
Controller: `server/src/modules/portfolio/portfolio.controller.ts`.
Primary screen: Public Portfolio.
Risk: privacy enforcement.
Refresh contract: public portfolio.
Negative test: private portfolio.

Endpoint: `GET /resume/me`.
Controller: `server/src/modules/resume/resume.controller.ts`.
Primary screen: Resume.
Risk: stale after evidence/profile changes.
Refresh contract: resume.
Negative test: no resume yet.

Endpoint: `PATCH /resume/me`.
Controller: `server/src/modules/resume/resume.controller.ts`.
Primary screen: Resume.
Risk: conflict overwrite.
Refresh contract: resume.
Negative test: stale updatedAt.

Endpoint: `POST /resume/generate`.
Controller: `server/src/modules/resume/resume.controller.ts`.
Primary screen: Resume.
Risk: generated from stale evidence.
Refresh contract: resume.
Negative test: no skill passport.

Endpoint: `POST /applications/analyze-jd`.
Controller: `server/src/modules/resume/resume.controller.ts`.
Primary screen: Applications.
Risk: analysis failure and stale profile context.
Refresh contract: analysis panel.
Negative test: empty JD.

Endpoint: `POST /applications`.
Controller: `server/src/modules/resume/resume.controller.ts`.
Primary screen: Applications.
Risk: list stale.
Refresh contract: applications list.
Negative test: missing company/role.

Endpoint: `GET /applications`.
Controller: `server/src/modules/resume/resume.controller.ts`.
Primary screen: Applications.
Risk: load failure currently looks empty.
Refresh contract: application list.
Negative test: endpoint failure.

Endpoint: `PATCH /applications/:id`.
Controller: `server/src/modules/resume/resume.controller.ts`.
Primary screen: Applications.
Risk: local status/note divergence.
Refresh contract: application list and funnel stats.
Negative test: invalid id.

Endpoint: `DELETE /applications/:id`.
Controller: `server/src/modules/resume/resume.controller.ts`.
Primary screen: Applications.
Risk: privacy clear and delete not propagated.
Refresh contract: application list/funnel stats.
Negative test: delete already deleted.

### Backend endpoint contract matrix - ecosystem and account

Endpoint: `GET /mentors`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentors.
Risk: hidden profiles visible.
Refresh contract: mentor list.
Negative test: private mentor profile should not appear.

Endpoint: `GET /mentors/profile/me`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentors/profile.
Risk: profile missing not distinguished from load failure.
Refresh contract: mentor profile.
Negative test: non-mentor user.

Endpoint: `POST /mentors/profile`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentor profile.
Risk: new profile visibility and list stale.
Refresh contract: profile and mentor list if public.
Negative test: invalid price/availability.

Endpoint: `PATCH /mentors/profile`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentor profile.
Risk: visibility change not reflected in list.
Refresh contract: profile and mentor list.
Negative test: set visibility private.

Endpoint: `GET /mentors/:id`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentor detail.
Risk: private mentor accessible by id.
Refresh contract: mentor detail.
Negative test: hidden mentor id.

Endpoint: `POST /mentor-sessions`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentors.
Risk: duplicate/self/scheduling/payment gaps.
Refresh contract: mentor sessions list.
Negative test: duplicate request and requesting yourself.

Endpoint: `GET /mentor-sessions`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentor Sessions tab.
Risk: blank tab on failure.
Refresh contract: sessions list.
Negative test: endpoint failure.

Endpoint: `PATCH /mentor-sessions/:id/status`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentor Sessions.
Risk: direct status transitions.
Refresh contract: sessions list and notifications.
Negative test: student tries mentor-only status update.

Endpoint: `POST /mentor-sessions/:id/notes`.
Controller: `server/src/modules/mentor-marketplace/mentor-marketplace.controller.ts`.
Primary screen: Mentor Sessions.
Risk: backend notes without full UI.
Refresh contract: selected session notes.
Negative test: non-mentor adds notes.

Endpoint: `GET /marketplace/templates`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Marketplace.
Risk: approved/public filtering.
Refresh contract: template list.
Negative test: pending template should not show publicly.

Endpoint: `GET /marketplace/templates/mine`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Creator Studio.
Risk: mine load error swallowed.
Refresh contract: my template list.
Negative test: endpoint failure.

Endpoint: `GET /marketplace/templates/pending`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Creator Studio admin.
Risk: admin-only list error swallowed.
Refresh contract: pending templates.
Negative test: non-admin access.

Endpoint: `GET /marketplace/templates/:id`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Marketplace detail.
Risk: direct access to non-approved templates.
Refresh contract: template detail.
Negative test: pending/private template id.

Endpoint: `POST /marketplace/templates`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Creator Studio.
Risk: content only `{ goal }`, incomplete templates.
Refresh contract: my templates.
Negative test: missing type-specific content.

Endpoint: `PATCH /marketplace/templates/:id`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Creator Studio.
Risk: author-only update and schema validation.
Refresh contract: my templates and pending list.
Negative test: update someone else's template.

Endpoint: `POST /marketplace/templates/:id/publish`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Creator Studio.
Risk: publishing incomplete template.
Refresh contract: my templates and pending list.
Negative test: publish without content schema.

Endpoint: `POST /marketplace/templates/:id/review`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Creator Studio admin.
Risk: approval of incomplete template.
Refresh contract: pending list and marketplace list.
Negative test: non-admin review.

Endpoint: `POST /marketplace/templates/:id/use`.
Controller: `server/src/modules/marketplace/marketplace.controller.ts`.
Primary screen: Marketplace.
Risk: does not clone/create real asset.
Refresh contract: created asset, usage counter, destination screen.
Negative test: use every template type.

Endpoint: `GET /institution/overview`.
Controller: `server/src/modules/institution/institution.controller.ts`.
Primary screen: Institution.
Risk: student can see nav but backend forbids.
Refresh contract: institution overview.
Negative test: student role.

Endpoint: `GET /institution/cohorts/:id/outcomes`.
Controller: `server/src/modules/institution/institution.controller.ts`.
Primary screen: Institution.
Risk: sampled data treated as full truth.
Refresh contract: cohort outcomes.
Negative test: cohort from another institution.

Endpoint: `POST /institution/cohorts/:id/assign-flow`.
Controller: `server/src/modules/institution/institution.controller.ts`.
Primary screen: Institution.
Risk: announcement-only, not real assignment.
Refresh contract: cohort assignment list and learner Today/tasks.
Negative test: learner receives no actual flow.

Endpoint: `POST /institution/cohorts/:id/assign-template`.
Controller: `server/src/modules/institution/institution.controller.ts`.
Primary screen: Institution.
Risk: announcement-only, not real asset.
Refresh contract: cohort assignment and learner marketplace/task.
Negative test: template not cloned for learners.

Endpoint: `GET /institution/reports/outcomes`.
Controller: `server/src/modules/institution/institution.controller.ts`.
Primary screen: Institution.
Risk: sampled totals.
Refresh contract: report tables.
Negative test: large org over sample size.

Endpoint: `GET /institution/reports/readiness`.
Controller: `server/src/modules/institution/institution.controller.ts`.
Primary screen: Institution.
Risk: readiness sample shown as definitive.
Refresh contract: readiness report.
Negative test: no students with readiness.

Endpoint: `GET /billing/plans`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing/Pricing.
Risk: no error handler in pricing.
Refresh contract: plans.
Negative test: endpoint failure.

Endpoint: `GET /billing/subscription`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing.
Risk: subscription error hidden.
Refresh contract: current plan and entitlements.
Negative test: no subscription.

Endpoint: `GET /billing/usage`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing.
Risk: usage stale after AI calls.
Refresh contract: usage meter.
Negative test: quota exhausted.

Endpoint: `GET /billing/transactions`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing.
Risk: transaction list error hidden.
Refresh contract: transaction list.
Negative test: no transactions.

Endpoint: `GET /billing/invoices`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing.
Risk: invoices may not exist in mock mode.
Refresh contract: invoice list.
Negative test: mock provider.

Endpoint: `GET /billing/provider`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing.
Risk: mock/live confusion.
Refresh contract: provider banner.
Negative test: production with mock provider.

Endpoint: `POST /billing/checkout`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing/Pricing.
Risk: mock checkout looks real.
Refresh contract: subscription, usage, entitlements, shell.
Negative test: payment provider disabled.

Endpoint: `POST /billing/checkout/mock`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing.
Risk: must never be available as real payment.
Refresh contract: subscription and entitlements.
Negative test: production environment.

Endpoint: `POST /billing/change-plan`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing.
Risk: entitlements stale.
Refresh contract: subscription, entitlements, shell nav.
Negative test: downgrade below used quota.

Endpoint: `POST /billing/verify`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing checkout return.
Risk: duplicate verification.
Refresh contract: subscription, transactions, entitlements.
Negative test: invalid signature.

Endpoint: `POST /billing/cancel`.
Controller: `server/src/modules/billing/billing.controller.ts`.
Primary screen: Billing.
Risk: entitlements remain active until refreshed.
Refresh contract: subscription and entitlements.
Negative test: cancel already canceled plan.

Endpoint: `GET /integrations`.
Controller: `server/src/modules/integrations/integrations.controller.ts`.
Primary screen: Integrations.
Risk: provider states not clear.
Refresh contract: integration cards.
Negative test: provider config missing.

Endpoint: `POST /integrations/connect`.
Controller: `server/src/modules/integrations/integrations.controller.ts`.
Primary screen: Integrations.
Risk: mock/manual connection may look live.
Refresh contract: integration card state.
Negative test: unknown provider.

Endpoint: `POST /integrations/disconnect`.
Controller: `server/src/modules/integrations/integrations.controller.ts`.
Primary screen: Integrations.
Risk: downstream sync still assumed.
Refresh contract: integration card and sync status.
Negative test: disconnect unconnected provider.

Endpoint: `POST /integrations/sync`.
Controller: `server/src/modules/integrations/integrations.controller.ts`.
Primary screen: Integrations.
Risk: generic sync failures.
Refresh contract: sync status and imported data.
Negative test: provider API failure.

Endpoint: `POST /integrations/announce`.
Controller: `server/src/modules/integrations/integrations.controller.ts`.
Primary screen: Integrations.
Risk: webhook delivery failure.
Refresh contract: connection delivery status.
Negative test: invalid webhook URL.

Endpoint: `POST /integrations/lms/import`.
Controller: `server/src/modules/integrations/integrations.controller.ts`.
Primary screen: Integrations.
Risk: CSV row-level errors missing.
Refresh contract: imported resources/users/status report.
Negative test: CSV missing email column.

Endpoint: `GET /integrations/calendar.ics`.
Controller: `server/src/modules/integrations/integrations.controller.ts`.
Primary screen: Integrations calendar export.
Risk: direct link misses auth header and export is generic.
Refresh contract: downloaded calendar file.
Negative test: browser anchor without Authorization header.

Endpoint: `GET /developer/events`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: visible to unauthorized student via nav.
Refresh contract: event list.
Negative test: student user and org id malformed.

Endpoint: `GET /developer/api-keys`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: ObjectId org id crash.
Refresh contract: API key list.
Negative test: non-ObjectId organizationId.

Endpoint: `POST /developer/api-keys`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: secret display and org id cast.
Refresh contract: API key list and one-time secret.
Negative test: missing OrgManage permission.

Endpoint: `DELETE /developer/api-keys/:id`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: malformed id.
Refresh contract: API key list.
Negative test: invalid id.

Endpoint: `GET /developer/webhooks`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: forbidden/invalid org.
Refresh contract: webhook list.
Negative test: non-org user.

Endpoint: `POST /developer/webhooks`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: URL validation and secret handling.
Refresh contract: webhook list.
Negative test: invalid URL.

Endpoint: `PATCH /developer/webhooks/:id`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: malformed id and ownership.
Refresh contract: webhook list.
Negative test: webhook from another org.

Endpoint: `DELETE /developer/webhooks/:id`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: malformed id.
Refresh contract: webhook list.
Negative test: invalid id.

Endpoint: `POST /developer/webhooks/:id/test`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: delivery failure must be distinct from app failure.
Refresh contract: webhook deliveries.
Negative test: endpoint returns 500.

Endpoint: `GET /developer/webhook-deliveries`.
Controller: `server/src/modules/developer/developer.controller.ts`.
Primary screen: Developer.
Risk: delivery list stale.
Refresh contract: delivery list.
Negative test: no deliveries.

Endpoint: `GET /auth/sessions`.
Controller: `server/src/modules/sessions/sessions.controller.ts`.
Primary screen: Security.
Risk: current device heuristic.
Refresh contract: device/session list.
Negative test: multiple sessions same UA.

Endpoint: `DELETE /auth/sessions/:id`.
Controller: `server/src/modules/sessions/sessions.controller.ts`.
Primary screen: Security.
Risk: malformed session id.
Refresh contract: session list.
Negative test: invalid id.

Endpoint: `POST /auth/logout-all`.
Controller: `server/src/modules/sessions/sessions.controller.ts`.
Primary screen: Security.
Risk: existing access tokens may remain valid until expiry.
Refresh contract: session list and auth state.
Negative test: another tab already has access token.

Endpoint: `POST /data/export/me`.
Controller: `server/src/modules/data-governance/data-governance.controller.ts`.
Primary screen: Your Data.
Risk: file URL portability.
Refresh contract: export jobs list.
Negative test: frontend and API different origins.

Endpoint: `GET /data/export/jobs`.
Controller: `server/src/modules/data-governance/data-governance.controller.ts`.
Primary screen: Your Data.
Risk: polling/stale status.
Refresh contract: export job list.
Negative test: pending job, failed job.

Endpoint: `POST /data/delete-request`.
Controller: `server/src/modules/data-governance/data-governance.controller.ts`.
Primary screen: Your Data.
Risk: request submitted but app state unchanged.
Refresh contract: delete request status and account warning.
Negative test: duplicate delete request.

Endpoint: `GET /privacy/settings`.
Controller: `server/src/modules/privacy/privacy.controller.ts`.
Primary screen: Data & Privacy.
Risk: error swallowed.
Refresh contract: privacy settings.
Negative test: endpoint failure.

Endpoint: `GET /privacy/export`.
Controller: `server/src/modules/privacy/privacy.controller.ts`.
Primary screen: Data & Privacy.
Risk: overlaps with data export.
Refresh contract: download/export payload.
Negative test: large account.

Endpoint: `POST /privacy/make-private`.
Controller: `server/src/modules/privacy/privacy.controller.ts`.
Primary screen: Data & Privacy.
Risk: public passport/portfolio not refreshed.
Refresh contract: passport, portfolio, public routes.
Negative test: public URL after make-private.

Endpoint: `POST /privacy/reset-skill-twin`.
Controller: `server/src/modules/privacy/privacy.controller.ts`.
Primary screen: Data & Privacy.
Risk: Skill Twin/Mistakes/Dashboard stale.
Refresh contract: skill twin, mistakes, dashboard, agent context.
Negative test: reset while Skill Twin open.

Endpoint: `POST /privacy/clear-applications`.
Controller: `server/src/modules/privacy/privacy.controller.ts`.
Primary screen: Data & Privacy, Applications.
Risk: Applications screen stale.
Refresh contract: applications list and outcome council.
Negative test: clear while Applications open.

### Frontend service contract ledger

Service: `client/src/app/core/services/api.service.ts`.
Role: base HTTP wrapper.
Risk: central place to normalize errors but currently callers handle inconsistently.
Required improvement: typed error shape and optional operation metadata.

Service: `client/src/app/core/services/auth.service.ts`.
Role: auth state and token storage.
Risk: refresh token is stored but not used for retry.
Required improvement: refresh method, session restore, current session id.

Service: `client/src/app/core/services/agent.service.ts`.
Role: Asta REST and stream calls.
Risk: stream terminal errors are not converted into fallback.
Required improvement: shared stream error policy.

Service: `client/src/app/core/services/socket.service.ts`.
Role: Socket.IO event adapter.
Risk: terminal error event completes stream.
Required improvement: classify and throw fallback-worthy errors.

Service: `client/src/app/core/services/daily-plan.service.ts`.
Role: Today API client.
Risk: no dependency freshness contract.
Required improvement: expose stale/dependency metadata.

Service: `client/src/app/core/services/roadmap.service.ts`.
Role: roadmap API client.
Risk: writes do not broadcast domain invalidation.
Required improvement: emit roadmap changed events.

Service: `client/src/app/core/services/flow.service.ts`.
Role: flow API client.
Risk: generated/changed flow does not refresh Today/Dashboard.
Required improvement: emit flow changed event.

Service: `client/src/app/core/services/quiz.service.ts`.
Role: assessment API client.
Risk: attempts history errors can be swallowed by callers.
Required improvement: standard load-state helper.

Service: `client/src/app/core/services/project.service.ts`.
Role: project API client.
Risk: stats and evidence side effects not centralized.
Required improvement: project changed/evidence changed event.

Service: `client/src/app/core/services/skill-passport.service.ts`.
Role: passport API client.
Risk: recompute timing is manual.
Required improvement: stale marker after evidence changes.

Service: `client/src/app/core/services/career-readiness.service.ts`.
Role: readiness API client.
Risk: role list failure hidden by caller.
Required improvement: distinct role-load error.

Service: `client/src/app/core/services/portfolio.service.ts`.
Role: portfolio API client.
Risk: public link depends on username/settings.
Required improvement: public URL readiness helper.

Service: `client/src/app/core/services/resume.service.ts`.
Role: resume API client.
Risk: stale generated resume after evidence/profile changes.
Required improvement: generated-from version metadata.

Service: `client/src/app/core/services/marketplace.service.ts`.
Role: marketplace templates API.
Risk: use template response does not guarantee created asset.
Required improvement: return created entity ids per type.

Service: `client/src/app/core/services/mentor-marketplace.service.ts`.
Role: mentor/profile/session API.
Risk: weak lifecycle and duplicate request handling.
Required improvement: status transition model and duplicate guards.

Service: `client/src/app/core/services/institution.service.ts`.
Role: institution dashboards and assignments.
Risk: assignment endpoints are announcement foundation.
Required improvement: assignment entities and learner delivery state.

Service: `client/src/app/core/services/billing.service.ts`.
Role: billing API client.
Risk: mock/live provider confusion.
Required improvement: provider-mode required banner and entitlement refresh.

Service: `client/src/app/core/services/entitlement.service.ts`.
Role: entitlement loading.
Risk: shell swallows failure.
Required improvement: safe fallback plus visible degraded state.

Service: `client/src/app/core/services/integration.service.ts`.
Role: integrations API client.
Risk: direct calendar href misses auth headers.
Required improvement: authenticated blob download.

Service: `client/src/app/core/services/developer.service.ts`.
Role: developer endpoints.
Risk: forbidden visible route and org id failures.
Required improvement: permission precheck before loading.

Service: `client/src/app/core/services/privacy.service.ts`.
Role: privacy destructive APIs.
Risk: downstream screens do not update.
Required improvement: broadcast privacy mutation events.

Service: `client/src/app/core/services/student-profile.service.ts`.
Role: learner profile.
Risk: profile save does not refresh auth/profile-dependent domains.
Required improvement: goal/role change invalidation.

Service: `client/src/app/core/services/knowledge.service.ts`.
Role: knowledge documents and Q&A.
Risk: document changes do not always invalidate agent context.
Required improvement: knowledge changed event.

Service: `client/src/app/core/services/space.service.ts`.
Role: study spaces.
Risk: generated flow/quiz/visual side effects not centralized.
Required improvement: artifact created event.

Service: `client/src/app/core/services/visual.service.ts`.
Role: visuals API.
Risk: mock provider status not consistently shown.
Required improvement: status-aware generate UI.

Service: `client/src/app/core/services/voice-session.service.ts`.
Role: voice sessions.
Risk: session list and provider status errors weak.
Required improvement: voice provider state contract.

Service: `client/src/app/core/services/practice.service.ts`.
Role: code practice execution.
Risk: mock execution can be mistaken for real execution.
Required improvement: provider id/result provenance in UI.

Service: `client/src/app/core/services/mistake.service.ts`.
Role: Mistake OS.
Risk: repair artifacts not invalidating flows/projects/today.
Required improvement: repair event broadcast.

Service: `client/src/app/core/services/simulation.service.ts`.
Role: simulations.
Risk: finish and repair flow side effects not propagated.
Required improvement: simulation completed event.

Service: `client/src/app/core/services/course.service.ts`.
Role: course builder.
Risk: generated artifacts not refreshing target screens.
Required improvement: artifact created events.

Service: `client/src/app/core/services/cohort.service.ts`.
Role: cohorts.
Risk: callers miss errors for list/detail/member ops.
Required improvement: standard panel load helpers.

Service: `client/src/app/core/services/live-session.service.ts`.
Role: live sessions.
Risk: list/start errors missing in caller.
Required improvement: action error contract.

Service: `client/src/app/core/services/community.service.ts`.
Role: community.
Risk: some vote/thread/report failures hidden.
Required improvement: optimistic rollback helpers.

Service: `client/src/app/core/services/peer-room.service.ts`.
Role: peer rooms.
Risk: shared room can become stale.
Required improvement: polling/socket refresh.

Service: `client/src/app/core/services/resources.service.ts`.
Role: resources.
Risk: catalog failure can look empty.
Required improvement: empty-vs-error distinction.

Service: `client/src/app/core/services/ledger.service.ts`.
Role: proof ledger.
Risk: client CSV is filtered/current only.
Required improvement: server full export if product expects full ledger.

Service: `client/src/app/core/services/certificate.service.ts`.
Role: certificates.
Risk: invalid/revoked verification edge cases.
Required improvement: explicit verify states.

Service: `client/src/app/core/services/notification.service.ts`.
Role: notification count/list.
Risk: errors do not feed domain refresh.
Required improvement: link notifications to invalidation events.

Service: `client/src/app/core/services/offline.service.ts`.
Role: IndexedDB snapshots.
Risk: offline support narrower than UI copy.
Required improvement: supported entity registry.

Service: `client/src/app/core/services/sync-queue.service.ts`.
Role: offline mutation replay.
Risk: replay success does not refresh open screens.
Required improvement: emit sync-completed invalidation.

Service: `client/src/app/core/services/org-context.service.ts`.
Role: organization context.
Risk: context failure set loaded but hides org-aware features.
Required improvement: explicit no-org vs failed-load state.

Service: `client/src/app/core/services/feature-flag.service.ts`.
Role: feature flags.
Risk: failure swallowed by shell.
Required improvement: safe default policy and visible degraded state.

Service: `client/src/app/core/services/product-analytics.service.ts`.
Role: analytics events.
Risk: errors intentionally swallowed.
Required improvement: acceptable, but add dev diagnostics if needed.

Service: `client/src/app/core/services/web-push.service.ts`.
Role: push subscriptions.
Risk: push sender placeholder on backend.
Required improvement: provider/config state before opt-in.

Service: `client/src/app/core/services/voice-command-router.service.ts`.
Role: voice command interpretation.
Risk: destructive commands are blocked, but mutation requests become ask/navigate.
Required improvement: voice-to-operation preview.

Service: `client/src/app/core/services/voice-activation.service.ts`.
Role: wake/overlay ask flow.
Risk: stream error uses generic failure and no operation receipt.
Required improvement: share Asta fallback/operation pipeline.

Service: `client/src/app/core/services/text-to-speech.service.ts`.
Role: browser speech output.
Risk: availability varies by browser.
Required improvement: visible unavailable state in voice screens.

Service: `client/src/app/core/services/speech-recognition.service.ts`.
Role: browser speech input.
Risk: permission/browser support errors.
Required improvement: consistent mic diagnostics.

### Issue tickets ready to create

Ticket: AUTH-001 refresh before logout.
Severity: P0.
Source: `auth.service`, `error.interceptor`, `auth.controller`.
Problem: access-token expiry logs user out during route changes.
Fix: refresh-and-retry interceptor with request queueing.
Test: expire access token and navigate every sidebar route.

Ticket: AUTH-002 socket token refresh.
Severity: P0.
Source: `socket.service`, `events.gateway`.
Problem: socket unauthorized event fails chat without refresh/fallback.
Fix: refresh token before reconnect or fallback to REST.
Test: expire token during Asta stream.

Ticket: NAV-001 permission-aware student nav.
Severity: P0.
Source: `nav.ts`, Institution, Developer controllers.
Problem: sidebar exposes forbidden screens.
Fix: role/permission/org-aware nav.
Test: student, mentor, org manager, admin route matrix.

Ticket: NAV-002 client guards for org-only routes.
Severity: P0.
Source: `app.routes.ts`.
Problem: backend guards catch too late.
Fix: add guards for Institution, Developer, Reports, Org, Platform, Founder.
Test: direct URL access by student.

Ticket: CHAT-001 terminal stream error fallback.
Severity: P0.
Source: `socket.service`, `asta-os.component`, `tutor-workspace.component`, `agent-workspace.component`.
Problem: stream `error` event completes and fails assistant message.
Fix: classify terminal events and invoke fallback where safe.
Test: socket unauthorized, busy, orchestrator throw.

Ticket: CHAT-002 shared chat surface behavior.
Severity: P1.
Source: Asta OS, AI Tutor, Agent Workspace.
Problem: different chat surfaces handle stream/history/retry differently.
Fix: shared chat run helper.
Test: same failure matrix on all chat screens.

Ticket: HISTORY-001 visible session load errors.
Severity: P1.
Source: `asta-os-history.component`, `tutor-workspace.component`.
Problem: tabs exist but content is blank on failure.
Fix: list/message error states.
Test: fail sessions endpoint and messages endpoint.

Ticket: HISTORY-002 semantic session titles.
Severity: P1.
Source: `agent-session.service`.
Problem: titles are generic or first-message slices.
Fix: generate semantic title at creation and refine after response.
Test: mutation, tutor, attachment, failed stream sessions.

Ticket: ASTA-001 central mutation planner.
Severity: P0.
Source: `agent-orchestrator.service`, command registry, domain services.
Problem: Asta updates one domain but not all dependencies.
Fix: operation planner with typed writes and affected domains.
Test: "I learned this, update everything".

Ticket: ASTA-002 operation receipts.
Severity: P1.
Source: Asta response payloads.
Problem: user cannot tell what changed and what did not.
Fix: receipt with updated/failed/skipped domains.
Test: roadmap update with daily plan recalc failure.

Ticket: STATE-001 frontend invalidation service.
Severity: P0.
Source: all feature screens.
Problem: open screens remain stale after cross-domain writes.
Fix: query/domain invalidation service.
Test: mutate roadmap with Today/Dashboard open.

Ticket: STATE-002 backend domain events.
Severity: P0.
Source: roadmap, daily plan, quiz, projects, mistakes, profile, privacy.
Problem: not every write emits events.
Fix: emit consistent events and expose to frontend.
Test: event log for every mutation endpoint.

Ticket: TODAY-001 daily plan dependency hash.
Severity: P0.
Source: `daily-plan.service`.
Problem: persisted Today plan is stale after roadmap/flow/mistake changes.
Fix: store dependency hash and stale reason.
Test: replan roadmap after generating Today.

Ticket: TODAY-002 carry-over stale source protection.
Severity: P1.
Source: `daily-plan.service`.
Problem: carry-over can resurrect removed tasks.
Fix: validate source ids before carry-over.
Test: delete/replan source then carry over.

Ticket: DASH-001 stale course route.
Severity: P1.
Source: `dashboard.component.ts`.
Problem: links `/app/courses/:id` instead of `/app/course-builder/:id`.
Fix: route correction.
Test: click Continue course.

Ticket: DASH-002 dashboard secondary panel errors.
Severity: P1.
Source: `dashboard.component.ts`.
Problem: many secondary calls swallow errors.
Fix: panel-level error states.
Test: fail each secondary endpoint.

Ticket: ROADMAP-001 task progress clarity.
Severity: P1.
Source: `roadmap.service`.
Problem: task completion does not affect progress percentage.
Fix: separate task progress or include tasks in progress model.
Test: complete all tasks without completing week.

Ticket: ROADMAP-002 roadmap mutation downstream refresh.
Severity: P0.
Source: roadmap commands and service.
Problem: replan/regenerate/restore does not update Today/Dashboard.
Fix: emit roadmap content changed event.
Test: restore old version with Today open.

Ticket: FLOW-001 optimistic flow node rollback.
Severity: P1.
Source: `flow-detail.component.ts`.
Problem: drag/note/status can appear saved before server success.
Fix: rollback or unsynced marker.
Test: fail node update endpoint.

Ticket: FLOW-002 repair flow to Today propagation.
Severity: P1.
Source: Mistakes/Flows/Daily Plan.
Problem: repair node does not become daily action automatically.
Fix: event and stale/recalc behavior.
Test: create repair node, check Today.

Ticket: QUIZ-001 attempts error visibility.
Severity: P1.
Source: `quiz-studio.component.ts`.
Problem: attempts/history errors hidden.
Fix: error state per history panel.
Test: fail attempts endpoint.

Ticket: QUIZ-002 quiz completion propagation.
Severity: P0.
Source: assessment service and frontend.
Problem: quiz submit should refresh mistakes/intelligence/passport.
Fix: quiz graded event and frontend invalidation.
Test: submit failed quiz and inspect Mistake OS.

Ticket: PROJECT-001 stats refresh.
Severity: P1.
Source: `project-studio.component.ts`.
Problem: stats failure hidden and stats stale after task changes.
Fix: error state and refresh after mutations.
Test: add/remove/task complete.

Ticket: PROJECT-002 review limitation label.
Severity: P1.
Source: `project-review.generator.ts`.
Problem: static code analysis is future but UI may imply deep AI review.
Fix: label review limitations or implement analysis.
Test: submit project with broken code.

Ticket: PASSPORT-001 evidence-driven recompute.
Severity: P1.
Source: skill passport/project/quiz.
Problem: passport stale after evidence events.
Fix: auto recompute or stale badge.
Test: submit project and inspect passport.

Ticket: PORTFOLIO-001 stale portfolio marker.
Severity: P1.
Source: portfolio/passport/project.
Problem: portfolio generated from stale evidence.
Fix: evidence version metadata.
Test: add evidence then inspect portfolio.

Ticket: RESUME-001 stale resume marker.
Severity: P1.
Source: resume/passport/profile.
Problem: resume not marked stale after profile/evidence change.
Fix: generated-from version metadata.
Test: update profile goal.

Ticket: CAREER-001 role load error.
Severity: P2.
Source: `career-readiness.component.ts`.
Problem: roles endpoint error swallowed.
Fix: role list error state.
Test: fail roles endpoint.

Ticket: CAREER-002 readiness invalidation.
Severity: P1.
Source: projects/interviews/passport/readiness.
Problem: readiness stale after outcome activities.
Fix: readiness stale event.
Test: finish interview.

Ticket: MARKET-001 template clone.
Severity: P1.
Source: `marketplace.service`.
Problem: use template does not create assets.
Fix: type-specific clone implementations.
Test: use every template type.

Ticket: CREATOR-001 template schemas.
Severity: P1.
Source: `creator-studio.component.ts`.
Problem: content is only `{ goal }`.
Fix: type-specific forms and backend validation.
Test: create course/flow/project templates.

Ticket: MENTOR-001 mentor visibility filter.
Severity: P1.
Source: `mentor-marketplace.service`.
Problem: hidden profiles can list.
Fix: filter public visibility for normal list.
Test: private mentor profile.

Ticket: MENTOR-002 session request lifecycle.
Severity: P1.
Source: mentor sessions.
Problem: duplicate/self/schedule/payment gaps.
Fix: request validation and lifecycle model.
Test: duplicate request.

Ticket: INSTITUTION-001 real assignments.
Severity: P1.
Source: `institution.service`.
Problem: assign flow/template only announces.
Fix: assignment records and learner delivery.
Test: assigned learner sees task.

Ticket: INSTITUTION-002 sample transparency.
Severity: P1.
Source: `institution.service`.
Problem: sampled reports look definitive.
Fix: sample size and total labels.
Test: org above sample size.

Ticket: BILLING-001 mock provider guard.
Severity: P0 in production.
Source: billing module/provider.
Problem: mock checkout can look real.
Fix: production fail-closed and banner.
Test: production config without live provider.

Ticket: BILLING-002 entitlement refresh.
Severity: P1.
Source: billing/entitlements/shell.
Problem: plan change does not refresh shell gates.
Fix: entitlement invalidation after billing mutation.
Test: upgrade plan while shell open.

Ticket: INTEGRATIONS-001 authenticated calendar download.
Severity: P1.
Source: integrations service/component.
Problem: anchor download lacks Authorization header.
Fix: fetch blob or signed URL.
Test: download `.ics` as logged-in user.

Ticket: INTEGRATIONS-002 real calendar contents.
Severity: P1.
Source: integrations service.
Problem: calendar export generic, not tied to real plan/session schedule.
Fix: generate from Today/live sessions/course schedule.
Test: compare `.ics` with Today.

Ticket: DEV-001 org id validation.
Severity: P0/P1.
Source: developer controller/service.
Problem: `new Types.ObjectId(orgId)` can throw for non-ObjectId org id.
Fix: use org document id and validate ids.
Test: org slug/external id context.

Ticket: DEV-002 developer route permission.
Severity: P0.
Source: nav/routes/developer.
Problem: student can click Developer.
Fix: hide/guard.
Test: student sidebar and deep link.

Ticket: SECURITY-001 current session id.
Severity: P1.
Source: sessions service/security component.
Problem: current device heuristic can be wrong.
Fix: store session id client-side.
Test: two sessions same browser UA.

Ticket: SECURITY-002 revoke id validation.
Severity: P1.
Source: sessions service.
Problem: malformed session id can produce server error.
Fix: parse/validate id.
Test: DELETE invalid id.

Ticket: DATA-001 portable export URL.
Severity: P1.
Source: data governance.
Problem: fileUrl can fail across frontend/API origins.
Fix: absolute signed URL or authenticated blob.
Test: separate frontend origin.

Ticket: PRIVACY-001 destructive action invalidation.
Severity: P1.
Source: privacy service/screens.
Problem: clear/reset/private actions leave other screens stale.
Fix: broadcast privacy mutation events.
Test: clear applications while Applications open.

Ticket: PROFILE-001 auth user refresh.
Severity: P1.
Source: profile/student profile/auth.
Problem: saved name/goal may not update shell/auth context.
Fix: refresh auth user/profile after save.
Test: change display name and inspect shell.

Ticket: PROFILE-002 goal-change dependent stale state.
Severity: P1.
Source: profile/roadmap/today/skill twin.
Problem: target goal changes but dependent paths remain old.
Fix: mark roadmap/today/readiness/skill twin stale.
Test: change goal from Java to ML.

Ticket: OFFLINE-001 supported entity registry.
Severity: P1.
Source: offline service/offline screen.
Problem: UI can overpromise offline support.
Fix: registry of supported entity types.
Test: toggle offline for Today/Flow/Notes.

Ticket: OFFLINE-002 sync completion invalidation.
Severity: P1.
Source: sync queue.
Problem: replayed mutations do not refresh screens.
Fix: emit sync-completed domain events.
Test: complete task offline then reconnect.

Ticket: VOICE-001 provider state.
Severity: P1.
Source: voice provider/voice room.
Problem: mock voice not clear.
Fix: visible live/mock provider status.
Test: run with mock provider.

Ticket: VOICE-002 voice-created artifacts refresh.
Severity: P1.
Source: voice sessions.
Problem: create flow/quiz/notes not globally refreshed.
Fix: artifact event after creation.
Test: create quiz from voice, open Quiz Studio.

Ticket: VISUAL-001 image provider state.
Severity: P1.
Source: visuals module/visual screen.
Problem: mock image generation can look real.
Fix: status banner and provider provenance.
Test: mock provider generation.

Ticket: PRACTICE-001 execution provider provenance.
Severity: P1.
Source: practice service/mock execution.
Problem: mock execution does not run code.
Fix: show provider and trust level per run.
Test: SQL or unavailable Piston.

Ticket: COMMUNITY-001 reports authorization state.
Severity: P1.
Source: community reports.
Problem: reports error becomes empty list.
Fix: visible moderator/permission state.
Test: non-moderator opens reports.

Ticket: COHORT-001 member mutation errors.
Severity: P1.
Source: cohorts component.
Problem: add/remove member errors missing.
Fix: toasts and rollback.
Test: add invalid user id.

Ticket: LIVE-001 live session load errors.
Severity: P1.
Source: live sessions component.
Problem: mine/org/detail/start errors missing.
Fix: panel-level load states and action toasts.
Test: fail each endpoint.

Ticket: RESOURCE-001 resource error states.
Severity: P2.
Source: resources component.
Problem: catalog/library failure looks empty.
Fix: separate error/empty.
Test: fail catalog endpoint.

Ticket: LEDGER-001 full export.
Severity: P2.
Source: ledger component.
Problem: CSV export uses filtered in-memory entries.
Fix: server-side export or label filtered export.
Test: export after filter.

Ticket: OPS-001 client error reporting route.
Severity: P2.
Source: ops/client errors.
Problem: app may not report frontend crashes around unauthorized navigation.
Fix: capture route/API error metadata.
Test: force 401/403/500 route failures.

### Endpoint-to-refresh quick map

Mutation: `POST /roadmaps/generate`.
Refresh: roadmap list.
Refresh: active roadmap.
Refresh: Today stale/recalc.
Refresh: Dashboard.
Refresh: Agent context.

Mutation: `PATCH /roadmaps/:id/progress`.
Refresh: roadmap detail.
Refresh: Dashboard.
Refresh: Learning Intelligence.
Refresh: Skill Twin.
Refresh: Today stale/recalc.

Mutation: `POST /roadmaps/:id/replan`.
Refresh: roadmap detail.
Refresh: roadmap versions.
Refresh: Today stale/recalc.
Refresh: Dashboard.
Refresh: Agent context.

Mutation: `POST /daily-plan/complete-item`.
Refresh: Today.
Refresh: Dashboard today strip.
Refresh: Daily streak.
Refresh: Proof ledger if completed.
Refresh: Skill Twin if activity-weighted.

Mutation: `POST /flows/:id/nodes`.
Refresh: flow detail.
Refresh: Today if active flow.
Refresh: Dashboard next action.
Refresh: Agent context.
Refresh: Learning Intelligence.

Mutation: `PATCH /flows/:id/nodes/:nodeId`.
Refresh: flow detail.
Refresh: Today if active node status changed.
Refresh: Dashboard.
Refresh: Learning Intelligence.
Refresh: Mistakes if repair node.

Mutation: `POST /assessment/quizzes/:id/attempts`.
Refresh: quiz attempts.
Refresh: quiz stats.
Refresh: Mistakes.
Refresh: Learning Intelligence.
Refresh: Skill Passport.

Mutation: `POST /projects/:id/submit`.
Refresh: project detail.
Refresh: project stats.
Refresh: Skill Passport.
Refresh: Portfolio stale.
Refresh: Career Readiness.

Mutation: `POST /projects/:id/ai-review`.
Refresh: project detail.
Refresh: Skill Passport if evidence changes.
Refresh: Portfolio stale.
Refresh: Career Readiness.
Refresh: Outcome Council stale.

Mutation: `POST /mistakes/:id/repair-flow`.
Refresh: Mistake OS.
Refresh: Flow Studio.
Refresh: Today stale/recalc.
Refresh: Dashboard next action.
Refresh: Learning Intelligence.

Mutation: `POST /mistakes/:id/repair-project`.
Refresh: Mistake OS.
Refresh: Project Studio.
Refresh: Dashboard project panel.
Refresh: Skill Twin.
Refresh: Agent context.

Mutation: `POST /spaces/:id/flow`.
Refresh: Space detail.
Refresh: Flow Studio.
Refresh: Today stale/recalc.
Refresh: Dashboard next action.
Refresh: Agent context.

Mutation: `POST /spaces/:id/quiz`.
Refresh: Space detail.
Refresh: Quiz Studio.
Refresh: Generated quiz selection.
Refresh: Agent context.
Refresh: Dashboard if quiz count shown.

Mutation: `POST /spaces/:id/visuals`.
Refresh: Space detail.
Refresh: Visual Studio.
Refresh: Generated visual route.
Refresh: Source link.
Refresh: Agent context.

Mutation: `POST /voice/sessions/:id/create-flow`.
Refresh: Voice session.
Refresh: Flow Studio.
Refresh: Today stale/recalc.
Refresh: Dashboard.
Refresh: Agent context.

Mutation: `POST /voice/sessions/:id/create-quiz`.
Refresh: Voice session.
Refresh: Quiz Studio.
Refresh: Generated quiz selection.
Refresh: Agent context.
Refresh: Dashboard if stats shown.

Mutation: `POST /skill-passport/add-evidence`.
Refresh: Skill Passport.
Refresh: Portfolio stale.
Refresh: Resume stale.
Refresh: Career Readiness.
Refresh: Public Passport if published.

Mutation: `POST /portfolio/generate`.
Refresh: Portfolio.
Refresh: Public Portfolio if published.
Refresh: Outcome Council stale.
Refresh: Dashboard if portfolio metric shown.
Refresh: Agent context.

Mutation: `POST /resume/generate`.
Refresh: Resume.
Refresh: Applications if resume linked.
Refresh: Career Readiness.
Refresh: Agent context.
Refresh: Profile if summary displayed.

Mutation: `POST /marketplace/templates/:id/use`.
Refresh: Marketplace usage.
Refresh: Destination asset list.
Refresh: Destination detail route.
Refresh: Dashboard if new course/project/flow.
Refresh: Today if new active flow/roadmap.

Mutation: `POST /institution/cohorts/:id/assign-flow`.
Refresh: Institution cohort detail.
Refresh: Learner assignments.
Refresh: Learner Today.
Refresh: Notifications.
Refresh: Reports.

Mutation: `POST /billing/change-plan`.
Refresh: Billing subscription.
Refresh: Entitlements.
Refresh: Shell nav/gates.
Refresh: Usage meter.
Refresh: Admin billing if open.

Mutation: `POST /integrations/sync`.
Refresh: Integrations card.
Refresh: Imported data domain.
Refresh: Notifications.
Refresh: Agent context if learner data imported.
Refresh: Dashboard if schedule/progress imported.

Mutation: `POST /privacy/make-private`.
Refresh: Privacy settings.
Refresh: Skill Passport.
Refresh: Portfolio.
Refresh: Public routes.
Refresh: Shell privacy indicator.

Mutation: `POST /privacy/reset-skill-twin`.
Refresh: Privacy settings.
Refresh: Skill Twin.
Refresh: Mistakes.
Refresh: Dashboard.
Refresh: Agent context.

Mutation: `POST /privacy/clear-applications`.
Refresh: Privacy settings.
Refresh: Applications.
Refresh: Outcome Council.
Refresh: Career Readiness.
Refresh: Agent context.

Mutation: `PATCH /student-profile/me`.
Refresh: Profile.
Refresh: Auth user.
Refresh: Dashboard.
Refresh: Roadmap stale recommendation.
Refresh: Agent context.

### Remaining runtime verification matrix

Runtime check: app build.
Command: `npm run build:client`.
Current status: blocked.
Blocker: `node.exe` not on PATH.
Pass condition: Angular build completes without type/template errors.

Runtime check: server build.
Command: `npm run build:server`.
Current status: blocked.
Blocker: `node.exe` not on PATH.
Pass condition: Nest build completes without TS errors.

Runtime check: auth expiry.
Setup: login, expire access token, keep refresh token valid.
Action: navigate Dashboard, Today, Marketplace, Developer, Institution.
Pass condition: refresh occurs or clean forbidden state, no crash/logout loop.

Runtime check: Asta stream fallback.
Setup: force socket terminal error.
Action: send prompt in Asta OS, AI Tutor, Mentor Room.
Pass condition: fallback or clear retry state.

Runtime check: history blank.
Setup: fail `/ai/sessions/:id`.
Action: open history tab.
Pass condition: visible error and retry, not blank content.

Runtime check: session naming.
Setup: create sessions for tutor, mutation, attachment, failed stream.
Action: open history.
Pass condition: semantic title for every session.

Runtime check: central roadmap update.
Setup: open Dashboard and Today.
Action: ask Asta to mark current week learned.
Pass condition: roadmap, Today, Dashboard, Intelligence, Skill Twin update or show stale/receipt.

Runtime check: marketplace use.
Setup: approved templates for each type.
Action: click Use.
Pass condition: real asset created and route opens created asset.

Runtime check: institution assignment.
Setup: admin/mentor cohort.
Action: assign flow/template.
Pass condition: learner receives actual assignment, not just announcement.

Runtime check: billing mock guard.
Setup: production-like env.
Action: open Billing.
Pass condition: mock provider blocked or loudly labelled.

Runtime check: integration calendar.
Setup: authenticated user with Today/live sessions.
Action: download calendar.
Pass condition: authenticated download and events match actual schedule.

Runtime check: privacy propagation.
Setup: open Applications and Passport.
Action: clear applications and make private.
Pass condition: open screens refresh and public URLs update.

Runtime check: offline sync.
Setup: go offline, queue daily plan completion.
Action: reconnect.
Pass condition: mutation syncs and Dashboard/Today/Ledger refresh.

Runtime check: object id validation.
Setup: malformed ids for roadmap, developer key, session, project.
Action: hit API routes.
Pass condition: 400/404/403 clean response, no 500 CastError.

Runtime check: mock provider labels.
Setup: voice, visuals, practice without live providers.
Action: generate voice/visual/run code.
Pass condition: UI shows provider/fallback provenance.

Runtime check: route matrix.
Setup: users: student, mentor, org manager, admin.
Action: open every sidebar route.
Pass condition: allowed screens load, forbidden screens hidden or explicit.
