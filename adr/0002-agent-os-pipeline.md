# ADR 0002 — Agent OS pipeline (orchestrator, streaming, validation)

**Status:** Accepted

## Context

Asta is "one companion, many agents behind the scenes," not a single chat endpoint.
A learner message can need routing to a specialist (tutor, RAG/doubt-solver, career,
assessment, project builder…), can carry an imperative that should *change state*
(mark a week complete, restore a version), and must stream back token-by-token with
live "agent activity" — never raw logs. This has to hold across two front-ends
(Classic Tutor and Asta OS) without duplicating the brain.

## Decision

One orchestration pipeline (`server/src/modules/agents/agent-orchestrator.service.ts`)
sits behind an `AgentService.stream()` → Socket.IO channel that both front-ends reuse.

- **Route → context → execute → synthesize.** The router picks a specialist agent
  (`agents/core/agent-router.service.ts`, `agents/agents/*`); a Context Engine
  (`agents/core/context-engine.service.ts`) assembles the learner's real state; the
  agent runs; a composer streams the answer.
- **Chat commands run *before* the LLM.** A precision-first registry
  (`agents/core/chat-command-registry.service.ts`, see [ADR below]) intercepts
  imperatives and performs real, audited writes — questions never write. On a hit,
  the Context Engine is invalidated so the next turn sees the change.
- **Output is validated + structured**, not trusted raw — the visual-block renderer
  consumes typed blocks, and structured generations go through the output contract
  ([ADR 0003](0003-ai-output-contract.md)).

## Consequences

- Both experiences share one pipeline: fix or extend the brain once.
- Deterministic imperatives (commands) and probabilistic answers (LLM) coexist
  safely — the command layer is precise and reversible; the LLM layer is streamed.
- New specialist agents plug into the registry/router without touching callers.
- Cost: more moving parts than a single prompt call; the router and context assembly
  are on the hot path and must stay fast and observable
  (`agents/core/agent-observability.service.ts`).
