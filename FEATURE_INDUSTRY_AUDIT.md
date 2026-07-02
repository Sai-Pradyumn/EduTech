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

---

## Chat & AI core

### AI Tutor (Classic) — bar: ChatGPT / Claude apps
Strong: streaming with workflow feed, modes, visual blocks, feedback, retry.
Now has history, deep links, large view.
- [ ] `P1·M` **Message actions**: copy / regenerate / edit-my-message on every
  turn (OS canvas has them; classic doesn't).
- [ ] `P2·S` **Search across past chats** (sessions already auto-title from the
  first exchange — corrected; OS has in-chat search only).
- [ ] `P2·S` **Stop generation** button while streaming.
- [ ] `P3·M` Shareable/exportable conversations (OS has export; classic none).

### Asta OS — bar: ChatGPT desktop + Arc-style command surfaces
Strong: tabs, tools, voice/face rooms, memory cards, canvas actions, export,
search, today strip. Now has focus mode.
- [ ] `P2·M` **Cross-session search** (search across all past sessions, not
  just the open one).
- [ ] `P2·S` Keyboard shortcut map surfaced in-product (⌘K exists; add "?").
- [ ] `P3·M` Pin/star sessions.

### Chat commands (new) — bar: Linear/Slack slash-actions, ChatGPT tasks
- [ ] `P2·M` **Broaden targets**: daily-plan items ("mark 'revise recursion'
  done"), memory ("remember that I prefer video"), courses ("archive my TS
  course"). The registry is generic — each module registers its own commands.
- [ ] `P2·S` **Undo affordance**: after a chat-command write, offer a one-click
  undo chip (roadmap already has versions; wire "undo" to restore previous).
- [ ] `P3·M` LLM-assisted intent extraction behind the deterministic matchers
  (higher recall, keep precision-first execution confirmation).

## Learning path

### Roadmap — bar: Duolingo path + Notion doc history
Strong: generation from profile, weekly plan with tasks, milestones, projects,
progress/streak/projection, per-week regenerate, versions, deep links, chat
control.
- [x] **Adaptive re-planning** — when real pace slips beyond 2× the plan, a
  Pace-check card offers one-click re-planning of the next weeks (capped at 4
  LLM rewrites, versioned, completed weeks untouched).
- [ ] `P2·S` **Version diff view**: show what changed between two versions
  (week-level added/removed/changed chips) before restoring.
- [ ] `P3·M` Calendar export (ICS) of the weekly plan.

### Flows (graph learning) — bar: skill trees (Duolingo/Khan)
Strong: dependency graph, node types, weak-area repair nodes, live agents per
node.
- [ ] `P2·M` Progress persistence parity with roadmap (complete-from-chat, the
  command registry makes this one registrar).

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
- [ ] `P2·S` Chat command: "mark 'revise recursion' as done" (see registry).
- [ ] `P3·S` Time-of-day awareness (morning vs evening plan framing).

## Practice & assessment

### Quiz Studio — bar: LeetCode/Anki hybrid
Strong: AI-written questions per topic/document (since 3e50776), grading,
mistakes feed the twin. **Corrected:** timed mode + countdown, retake and
shuffle already exist; spaced repetition (SM-2-lite) already exists on mistakes
with a due queue, review UI and dashboard strip.
- [ ] `P2·M` **Test me, don't trust me**: due reviews are self-reported
  (Recalled/Forgot) — offer a real 1–2-question re-test per due concept.
- [ ] `P3·S` Per-question timing analytics.

### Interview — bar: Pramp/Interviewing.io
Strong: AI questions tailored to role + weak areas, scoring, PDF report.
- [x] **Voice mode** — questions read aloud (TTS), answers dictated (STT),
  auto-reads the next question after each submit; toggle in the session header.
- [ ] `P3·M` Question-bank difficulty ladder per company archetype.

### Practice Studio (code) — bar: LeetCode editor
Strong: real execution (Piston), problems.
- [ ] `P2·M` Test-case-based grading (currently output-eyeballing), hidden
  cases.

### Mistake OS — bar: error-log products (Anki lapses)
Strong: severity/frequency, repair routing into live features.
- [ ] `P2·S` "Repair session" chat command + a weekly repair digest nudge.

## Knowledge & content

### Knowledge Hub (RAG) — bar: NotebookLM
Strong: hybrid retrieval (Qdrant dense + keyword), summaries, flashcards,
doc-grounded quizzes. **Corrected:** grounded chat with cited sources AND
per-document scoping (select docs → documentIds) already exists in the hub.
- [ ] `P2·M` Audio overview (NotebookLM's headline feature) via the existing
  voice synthesis path.

### Resources — bar: curated marketplaces
Strong: curated catalog, personalized "for you" with reasons, library.
- [ ] `P3·M` Community submissions + upvotes (governance needed).

## Career

### Resume / JD match — bar: Teal/Rezi
Strong: AI analysis, JD matching, PDF.
- [ ] `P2·M` Track applications against JD matches (applications feature
  exists; link them).

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
- [ ] `P2·L` Moderation tooling (report/flag queue) before scale.

## Platform

### Dashboard / Intelligence — bar: Whoop/Strava-style insight surfaces
Strong: skill twin, cognitive guardian, momentum, next action.
- [ ] `P2·S` One "why" drill-down per metric (readiness → contributing
  signals), reusing skill-twin explanations.

### Notifications / Nudges — bar: Duolingo's engagement engine
Strong: nudge engine with real triggers.
- [ ] `P2·M` Digest email (weekly progress + next step) — SMTP config exists.

### Gamification (streaks/certificates/ledger) — bar: Duolingo
Strong: streaks, confetti, certificates, immutable ledger.
- [ ] `P3·M` League/leaderboard among cohort peers (opt-in).

---

## Cross-cutting themes (the real industry gap)

1. **Actions from language** — shipped for roadmap; extend the command registry
   to daily plan, courses, memory, flows. One registrar per module.
2. **Every insight must route somewhere** — any card that names a topic must
   deep-link into learning it (roadmap → tutor shipped; apply to mistakes,
   twin, readiness, resources).
3. **History & undo everywhere state mutates** — roadmap has versions; flows
   and courses deserve the same pattern (the schema is reusable).
4. **Depth on demand** — generate deep content lazily at the moment of use
   (course lessons, interview follow-ups), not upfront where it's shallow.
