# ADR 0003 — AI output contract (validate → repair → typed error → deterministic fallback)

**Status:** Accepted

## Context

Many features don't want prose — they want *structured* output (a quiz's questions,
a roadmap's weeks, a lesson body, an interview ladder) that the UI renders as typed
data. LLMs are probabilistic: they drift from the schema, truncate, or return prose
where JSON was asked. Two failure modes are unacceptable: shipping malformed data to
the UI, and — the cardinal rule — **faking depth** (canned or templated output dressed
up as a real generation). Offline/mock runs must still produce something honest.

## Decision

Every structured generation goes through one path:
`AiService.generateStructuredOutput(messages, schema, opts)`
(`server/src/modules/ai/ai.service.ts`, schemas in `ai/contracts/output-contract.ts`).

1. **Validate** the model output against the item schema (full field schemas, not a
   loose shape).
2. **One repair pass** — re-prompt the model to fix the specific violation.
3. On continued failure, throw a typed **`AiContractViolationError`** — never return
   half-valid data.
4. The **caller supplies a deterministic fallback** — a real, structured, honest
   result derived from the actual input (e.g. an extractive outline), explicitly
   labelled when it's the offline/degraded path, never fabricated to look AI-authored.
5. When the gateway is on the mock/offline provider (`!isLive`), the contract is
   exempt and the deterministic fallback is used directly.

## Consequences

- The UI only ever receives schema-valid data or a clean typed error to handle —
  no defensive parsing scattered across features.
- Honesty is structural: a feature can't accidentally ship canned output as real,
  because the fallback is a separate, labelled, input-derived path.
- Every new AI feature must define a full item schema **and** a deterministic
  fallback — that's the cost of admission, and it's what makes offline mode truthful.
- One repair pass adds latency on the unhappy path; we cap it at one to bound cost.
