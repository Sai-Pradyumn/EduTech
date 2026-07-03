# Asta — Feature-by-Feature Industry Audit (2026-07)

Every user-facing feature (Classic + Asta OS), compared against the strongest
product in its category: what the industry bar looks like, where Asta stands,
and the concrete gaps. Legend matches `IMPROVEMENTS_BACKLOG.md` —
`P1` high · `P2` medium · `P3` nice-to-have; effort `S/M/L`.

> **2026-07 line-level re-verification** — several items below were found to ALREADY exist and
> are corrected in place: spaced repetition (SM-2-lite on mistakes + due endpoint + review UI),
> Knowledge-Hub grounded chat **with doc scoping** and citations, timed/retake/shuffle quizzes,
> auto-titled sessions, flow-node deep links into Tutor/quiz, Skill-Twin "Why?" drawers, and the
> public portfolio page (`/p/:username`). Gaps that were re-confirmed: course Learn mode (shipped
> below), memory manager, time-based nudges/digest, interview voice, classic-tutor message actions.

**Shipped in this audit round** (branch `feat/full-revamp`):
- ✅ **Course Learn Mode** — courses are now takeable: full lesson bodies written by AI on first
  open (cached, honest outline offline), lesson reader with prev/next, per-lesson completion,
  auto-advance, course progress %, continue-where-you-left-off on the course cards, module-quiz
  CTAs, per-lesson rewrite.
- ✅ Chat commands — saying "mark week 2 complete / refocus week 3 on X /
  restore version 2" in ANY chat executes the real update (registry +
  orchestrator hook + roadmap commands).
- ✅ Roadmap versions — git-style history; every generation/edit/restore is a
  restorable point; UI panel + chat restore.
- ✅ Roadmap → learning deep-links — every week card routes into the Tutor
  (learn / quiz on that exact topic) and can be reworked in place.
- ✅ Tutor: past-chats history (sessions were persisted server-side but had no
  UI), topic deep-link prefill, working `open_route` actions.
- ✅ Large-screen mode — Classic tutor (full-viewport takeover, Esc exits) and
  Asta OS (side panels fold away, canvas gets the screen).
- ✅ Review loop closure — real MCQ re-tests for due concepts; due reviews land
  in the daily plan; "start my review" from any chat.
- ✅ Memory manager — everything Asta knows (confirmed + observed) listed and
  deletable in the profile; remember/forget by chat.
- ✅ Tutor control — copy/regenerate/edit-and-resend/stop + chat search.
- ✅ Chat commands + Undo — daily plan, courses, memory, mistakes registrars;
  every chat write gets an Undo chip.
- ✅ Time-based engagement — inactivity + due-review nudges, Monday digest
  (in-app + SMTP-gated email), session-soon reminders.
- ✅ Interview voice mode, session ICS + reminders, adaptive re-plan, roadmap
  version diff + plan ICS export (see sections below).

---

## Chat & AI core

### AI Tutor (Classic) — bar: ChatGPT / Claude apps
Strong: streaming with workflow feed, modes, visual blocks, feedback, retry.
Now has history, deep links, large view.
- [x] **Message actions** — copy / regenerate / edit-and-resend on every turn.
- [x] **Search across past chats** — history panel title filter.
- [x] **Stop generation** — keeps the partial answer with an honest note.
- [x] **Exportable conversations** — one-click markdown download of the
  current thread (OS already had export).

### Asta OS — bar: ChatGPT desktop + Arc-style command surfaces
Strong: tabs, tools, voice/face rooms, memory cards, canvas actions, export,
search, today strip. Now has focus mode.
- [x] **Cross-session search** — the history popover searches titles AND
  message content across every past session (server-side, snippet per hit).
- [x] **Keyboard shortcut map** — the global "?" overlay now lists the Asta OS
  and Tutor keys (⌘K composer focus, Esc behaviours).
- [x] **Pin/star sessions** — star in the history popover; pinned sessions
  lead every history list (classic tutor included).

### Chat commands (new) — bar: Linear/Slack slash-actions, ChatGPT tasks
- [x] **Broaden targets** — daily-plan items (check off / add), memory
  (remember/forget), courses (archive/restore/continue), mistakes ("start my
  review"); each module has its own registrar.
- [x] **Undo affordance** — every chat-command write returns an Undo chip that
  sends the honest inverse command back through the same audited path.
- [x] **LLM-assisted intent ("did you mean")** — imperative near-misses get a
  model-rewritten canonical phrasing as a click-to-confirm chip; the rewrite
  never executes by itself and is only offered when it would really match a
  deterministic matcher (precision stays absolute). Runs in parallel with the
  agent pass — zero added latency.

## Learning path

### Roadmap — bar: Duolingo path + Notion doc history
Strong: generation from profile, weekly plan with tasks, milestones, projects,
progress/streak/projection, per-week regenerate, versions, deep links, chat
control.
- [x] **Adaptive re-planning** — when real pace slips beyond 2× the plan, a
  Pace-check card offers one-click re-planning of the next weeks (capped at 4
  LLM rewrites, versioned, completed weeks untouched).
- [x] **Version diff view** — "What changed?" per version: week-level
  added/removed/changed lines + field changes, computed against the current
  plan before restoring.
- [x] **Calendar export (ICS)** — remaining weeks exported as Mon–Fri calendar
  blocks projected forward from next Monday.

### Flows (graph learning) — bar: skill trees (Duolingo/Khan)
Strong: dependency graph, node types, weak-area repair nodes, live agents per
node.
- [x] **Complete-from-chat** — "mark 'closures' complete in my flow" /
  "reopen … in my flow" really update the active flow (fuzzy node resolution,
  unlock announcements, Undo chip); ledger + repair events fire as if clicked.

### Courses — bar: Coursera/Udemy authoring
Strong: AI-designed blueprints (goal-specific since 3e50776), lessons, quizzes,
voice scripts, capstone, certificates. **Now takeable: Learn mode.**
- [x] **Lesson content depth** — full lesson bodies generated lazily on first
  open (LessonComposerService; cached; honest outline offline).
- [x] **Resume-where-you-left-off** — lastLessonId + completedLessons; course
  cards show progress + "Continue: <lesson>".
- [ ] `P3·S` Deep-link "continue course" from Today/dashboard strips.

### Daily plan / Today — bar: Todoist + Duolingo daily goals
Strong: generated plan, modes, carry-over, streak, ledger events.
- [x] **Chat commands** — "check off 'revise recursion'", "add 30 min of X to
  my plan" execute for real from any chat (with Undo).
- [x] **Time-of-day awareness** — the Today header greets by clock and frames
  the plan for the moment (fresh start / midday check-in with items left /
  evening wind-down / late-session restraint / everything-done rest).

## Practice & assessment

### Quiz Studio — bar: LeetCode/Anki hybrid
Strong: AI-written questions per topic/document (since 3e50776), grading,
mistakes feed the twin. **Corrected:** timed mode + countdown, retake and
shuffle already exist; spaced repetition (SM-2-lite) already exists on mistakes
with a due queue, review UI and dashboard strip.
- [x] **Test me, don't trust me** — real MCQ re-test per due concept (answers
  stay server-side; grading feeds the SM-2 scheduler).
- [x] **Per-question timing analytics** — each answer is timestamped; results
  show time per question, average pace, the slowest question, and flags wrong
  answers given in under half your average time ("rushed").

### Interview — bar: Pramp/Interviewing.io
Strong: AI questions tailored to role + weak areas, scoring, PDF report.
- [x] **Voice mode** — questions read aloud (TTS), answers dictated (STT),
  auto-reads the next question after each submit; toggle in the session header.
- [x] **Company-archetype difficulty ladder** — pick Startup / Big Tech /
  Consulting / Enterprise and the generated questions follow that company's
  interviewing style on a strict easy→hard ladder; the style is shown on the
  session and report.

### Practice Studio (code) — bar: LeetCode editor
Strong: real execution (Piston), problems. **Corrected:** test-case grading
already existed ("Check tests" — in-browser function tests for JS, server
stdin→stdout grading for the rest, results feeding ledger/Mistake OS).
- [x] **Hidden cases** — every problem now carries hidden grading cases:
  they grade like any other, but the UI shows only "Hidden case N" with a
  neutral failure hint (never the inputs or expectation); the statement warns
  "N hidden grading cases — handle the edges".

### Mistake OS — bar: error-log products (Anki lapses)
Strong: severity/frequency, repair routing into live features.
- [x] **Review from anywhere** — "start my review" chat command routes to the
  due queue; the daily scan nudges when reviews are due (top concept named);
  the Monday digest names the biggest open gap.
- [x] **Repair from anywhere** — "repair my weakest area" names the worst open
  gap (severity + frequency) and opens a tutor repair session on exactly it.

## Knowledge & content

### Knowledge Hub (RAG) — bar: NotebookLM
Strong: hybrid retrieval (Qdrant dense + keyword), summaries, flashcards,
doc-grounded quizzes. **Corrected:** grounded chat with cited sources AND
per-document scoping (select docs → documentIds) already exists in the hub.
- [x] **Audio overview** (NotebookLM's headline feature) — 🎧 on every ready
  doc: a grounded narration script (live AI, honest extractive fallback) read
  aloud with browser TTS in sentence-chunked playback; listen-time estimate,
  stop control, show-transcript, copy.

### Resources — bar: curated marketplaces
Strong: curated catalog, personalized "for you" with reasons, library.
- [x] **Community submissions + upvotes** — "Suggest a resource" lands as
  pending (visible only to the submitter, never recommended) until an admin
  approves/rejects it; upvote toggle on every card (URL-deduped, quality 50
  start so curated entries keep ranking precedence).

## Career

### Resume / JD match — bar: Teal/Rezi
Strong: AI analysis, JD matching, PDF. **Corrected:** applications ARE
JD-matches — each tracked application carries the JD text, match score,
matched/missing skills, tailored bullets, cover letter and prep plan through
the saved→applied→interviewing→offer pipeline; nothing left to link.

### Career readiness / Portfolio / Skill passport — bar: LinkedIn profile
Strong: readiness scoring, portfolio, verifiable ledger. **Corrected:** a public
shareable portfolio page already exists (`/p/:username`, public passport too).

## Social & live

### Live sessions / Peer rooms / Voice rooms — bar: Discord stages + Zoom
Strong: real Jitsi rooms, recaps, orchestrated agents in-room.
- [x] **Reminders + calendar** — org members get a nudge when a session starts
  within the hour (15-min scheduler scan, deduped); "Add to calendar" downloads
  a standard .ics with a 15-min alarm and the join link.
- [ ] `P3·M` Recurring session templates.

### Community / Spaces / Cohorts — bar: Discord/Circle
Strong: threads, spaces with sources.
- [x] **Moderation tooling** — ⚑ Report on any thread/reply (deduped per
  reporter, snapshot preview survives deletion); OrgManage moderators get an
  in-community queue with open-first ordering, jump-to-target and resolve;
  delete-any already existed.

## Platform

### Dashboard / Intelligence — bar: Whoop/Strava-style insight surfaces
Strong: skill twin, cognitive guardian, momentum, next action.
- [ ] `P2·S` One "why" drill-down per metric (readiness → contributing
  signals), reusing skill-twin explanations.

### Notifications / Nudges — bar: Duolingo's engagement engine
Strong: nudge engine with real triggers.
- [x] **Time-based engagement** — daily inactivity + due-review nudges and a
  Monday week-in-review digest with honest numbers: in-app always, email when
  SMTP is configured.

### Gamification (streaks/certificates/ledger) — bar: Duolingo
Strong: streaks, confetti, certificates, immutable ledger.
- [x] **Peer leaderboard (opt-in both ways)** — students must join the board
  to appear on it AND to see it; leaving re-hides their scores instantly.
  Managers keep the full view + CSV.

---

## Cross-cutting themes (the real industry gap)

1. **Actions from language** — shipped for roadmap, daily plan, courses,
   memory, mistakes AND flows (one registrar per module, all with Undo), plus
   a "did you mean" suggester for near-miss phrasings.
2. **Every insight must route somewhere** — any card that names a topic must
   deep-link into learning it (roadmap → tutor shipped; apply to mistakes,
   twin, readiness, resources).
3. **History & undo everywhere state mutates** — roadmap has versions; flows
   and courses deserve the same pattern (the schema is reusable).
4. **Depth on demand** — generate deep content lazily at the moment of use
   (course lessons, interview follow-ups), not upfront where it's shallow.
