# Architecture Decision Records

Short records of the load-bearing architectural calls in Asta — the decisions that
are expensive to reverse and that a new contributor needs the *why* behind, not just
the code. Each ADR is immutable once accepted; a later decision that changes course
gets a new ADR that supersedes the old one (noted in both).

Format: **Context** (the forces), **Decision** (what we chose), **Consequences**
(what it buys and what it costs). Kept intentionally short.

| # | Decision | Status |
|---|---|---|
| [0001](0001-ai-provider-abstraction.md) | AI provider abstraction — multi-provider gateway + mock fallback | Accepted |
| [0002](0002-agent-os-pipeline.md) | Agent OS pipeline — orchestrator, streaming, validation | Accepted |
| [0003](0003-ai-output-contract.md) | AI output contract — validate → repair → typed error → deterministic fallback | Accepted |
| [0004](0004-entitlements-and-metering.md) | Entitlements & metering — plan-based access + usage limits | Accepted |
