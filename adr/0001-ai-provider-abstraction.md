# ADR 0001 — AI provider abstraction (multi-provider gateway + mock fallback)

**Status:** Accepted

## Context

Asta is AI-native — nearly every surface calls an LLM. We needed to avoid three
traps: (1) hard coupling to one vendor's SDK, (2) a dev/CI/demo experience that
can't run without paid API keys, and (3) an outage or rate-limit in one provider
taking the whole product down. Providers also differ (OpenAI-compatible vs. native
Claude/Gemini), and cost/latency/quality vary per task.

## Decision

All model access goes through one gateway (`server/src/modules/ai/gateway/llm-gateway.service.ts`)
behind a single `AiProvider` interface (`ai/interfaces/ai-provider.interface.ts`).

- **Adapters, not SDK calls in features.** `openai-compatible.provider.ts` covers
  Groq/Mistral/OpenRouter/DeepSeek/OpenAI/Ollama; `claude.provider.ts` and
  `gemini.provider.ts` are native. A feature never imports a vendor SDK directly.
- **A configured chain, not a single provider.** `LLM_PROVIDERS` + `provider-chain.ts`
  define priority order and a health-tracked fallback chain; `LLM_STRATEGY` selects
  `fallback` (first healthy wins), `parallel` (race + synthesize), or `refine`
  (draft → critique). Config lives in `config/configuration.ts`.
- **A first-class mock provider** (`providers/mock-ai.provider.ts`) is the last link.
  With **no keys at all** the app is fully functional on honest deterministic output,
  and CI asserts exactly this fallback. Ollama sits just above mock for real, free,
  zero-key local inference.

## Consequences

- The whole app runs with zero secrets — dev, CI, demos and the e2e suite all work
  offline of any cloud. "Go live" is pasting one key and restarting.
- Provider outages degrade gracefully down the chain instead of failing the request.
- New providers are one adapter; task-level cost/quality tuning is config, not code.
- Cost: a gateway indirection layer and a health-tracking surface to maintain, and
  mock output must be kept honest (never faked to look real) — enforced by the
  output contract ([ADR 0003](0003-ai-output-contract.md)).
