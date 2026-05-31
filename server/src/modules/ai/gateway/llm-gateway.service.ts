import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import {
  AIMessage,
  AIProviderCallError,
  GenOptions,
  IAIProvider,
  ProviderCapabilities,
} from '../interfaces/ai-provider.interface';
import { HealthTrackerService } from './health-tracker.service';
import { PROVIDER_CHAIN_TOKEN } from './provider-chain';

/**
 * The single entry point every agent/RAG call goes through. Holds an ordered provider
 * chain and runs the configured strategy (fallback by default), with per-provider health
 * cooldowns, per-call timeout, and a guaranteed mock terminal so the UX never hard-fails.
 * Implements IAIProvider so it can be injected wherever a provider is expected.
 */
@Injectable()
export class LlmGatewayService implements IAIProvider {
  private readonly logger = new Logger('LlmGateway');
  private readonly timeoutMs: number;

  constructor(
    @Inject(PROVIDER_CHAIN_TOKEN) private readonly chain: IAIProvider[],
    private readonly health: HealthTrackerService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    this.timeoutMs = config.get('ai', { infer: true }).requestTimeoutMs;
  }

  /** Reflects the primary (first non-mock) provider, or 'mock'. */
  get name(): string {
    return this.chain.find((p) => p.isLive)?.name ?? 'mock';
  }

  get isLive(): boolean {
    return this.chain.some((p) => p.isLive);
  }

  get capabilities(): ProviderCapabilities {
    return { chat: true, streaming: true, structured: true, embeddings: true };
  }

  get strategy(): 'fallback' | 'parallel' | 'refine' {
    return this.config.get('ai', { infer: true }).strategy;
  }

  /** Ops view of the active chain + provider health (for the admin/founder dashboards). */
  snapshot(): {
    strategy: string;
    live: boolean;
    providers: {
      name: string;
      isLive: boolean;
      available: boolean;
      capabilities: ProviderCapabilities;
    }[];
    health: ReturnType<HealthTrackerService['snapshot']>;
  } {
    return {
      strategy: this.strategy,
      live: this.isLive,
      providers: this.chain.map((p) => ({
        name: p.name,
        isLive: p.isLive,
        available: p.name === 'mock' || this.health.isAvailable(p.name),
        capabilities: p.capabilities,
      })),
      health: this.health.snapshot(),
    };
  }

  /** Providers eligible right now (healthy), in chain order. Mock always qualifies. */
  private eligible(): IAIProvider[] {
    const healthy = this.chain.filter(
      (p) => p.name === 'mock' || this.health.isAvailable(p.name),
    );
    return healthy.length ? healthy : this.chain;
  }

  // ───────────────────────── IAIProvider surface ─────────────────────────

  async generateText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): Promise<string> {
    return this.run(
      (p, signal) => p.generateText(messages, { ...opts, signal }),
      opts,
    );
  }

  generateStructuredOutput<T>(
    messages: AIMessage[],
    schema: Record<string, unknown>,
    opts?: GenOptions,
  ): Promise<T> {
    return this.run(
      (p, signal) =>
        p.generateStructuredOutput<T>(messages, schema, { ...opts, signal }),
      opts,
    );
  }

  async *streamText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): AsyncIterable<string> {
    let lastErr: unknown;
    for (const provider of this.eligible()) {
      const { signal, clear } = this.deadline(opts?.signal);
      let emitted = false;
      try {
        for await (const token of provider.streamText(messages, {
          ...opts,
          signal,
        })) {
          emitted = true;
          yield token;
        }
        this.health.recordSuccess(provider.name);
        clear();
        return;
      } catch (err) {
        clear();
        lastErr = err;
        this.note(provider.name, err);
        // Once tokens are out we can't cleanly restart on another provider, so stop and
        // surface the partial completion. Only fail over if nothing was emitted yet.
        if (emitted) throw this.terminal(lastErr);
      }
    }
    throw this.terminal(lastErr);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Capability-aware: first healthy, live, embeddings-capable provider, else mock-hashed.
    const candidates = this.eligible().filter((p) => p.capabilities.embeddings);
    for (const provider of candidates) {
      try {
        const vec = await provider.generateEmbedding(text);
        this.health.recordSuccess(provider.name);
        if (vec.length) return vec;
      } catch (err) {
        this.note(provider.name, err);
      }
    }
    // Guaranteed: the mock provider supports embeddings.
    const mock = this.chain.find((p) => p.name === 'mock');
    return mock ? mock.generateEmbedding(text) : [];
  }

  // ───────────────────────── strategies ─────────────────────────

  /** Fallback strategy: first healthy provider that succeeds wins; mock is the terminal. */
  private async run<T>(
    call: (p: IAIProvider, signal: AbortSignal) => Promise<T>,
    opts?: GenOptions,
  ): Promise<T> {
    let lastErr: unknown;
    for (const provider of this.eligible()) {
      try {
        const result = await this.tryProvider(call, provider, opts);
        this.health.recordSuccess(provider.name);
        return result;
      } catch (err) {
        lastErr = err;
        this.note(provider.name, err);
      }
    }
    throw this.terminal(lastErr);
  }

  /** One provider, with a single backoff retry on a transient error before giving up. */
  private async tryProvider<T>(
    call: (p: IAIProvider, signal: AbortSignal) => Promise<T>,
    provider: IAIProvider,
    opts?: GenOptions,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { signal, clear } = this.deadline(opts?.signal);
      try {
        return await call(provider, signal);
      } catch (err) {
        if (attempt === 0 && this.isRetryable(err) && !opts?.signal?.aborted) {
          await new Promise((r) => setTimeout(r, 300));
          continue; // same provider, one more time
        }
        throw err;
      } finally {
        clear();
      }
    }
    throw new Error('unreachable');
  }

  /** Retry only transient failures (network/timeout/5xx) — never 4xx/429/auth. */
  private isRetryable(err: unknown): boolean {
    const status = err instanceof AIProviderCallError ? err.status : undefined;
    return status === undefined || status >= 500;
  }

  /**
   * Refine strategy: a draft provider produces an answer, then a (possibly different)
   * provider critiques + rewrites it. Used by the orchestrator's critic loop.
   */
  async refineText(
    messages: AIMessage[],
    critiqueInstruction: string,
    opts?: GenOptions,
  ): Promise<string> {
    const draft = await this.generateText(messages, opts);
    const refinePrompt: AIMessage[] = [
      ...messages,
      { role: 'assistant', content: draft },
      { role: 'user', content: critiqueInstruction },
    ];
    return this.generateText(refinePrompt, opts);
  }

  /**
   * Parallel strategy: draft with up to N live providers concurrently, then a judge
   * synthesizes the single best answer from the successful drafts (mirrors the reference
   * repo). Degrades to fallback when fewer than two providers are live, and to the
   * longest draft if the judge fails.
   */
  async parallelText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): Promise<string> {
    const live = this.eligible()
      .filter((p) => p.isLive)
      .slice(0, 3);
    if (live.length < 2) return this.generateText(messages, opts);

    const settled = await Promise.allSettled(
      live.map((p) => {
        const { signal, clear } = this.deadline(opts?.signal);
        return p
          .generateText(messages, { ...opts, signal })
          .then((text) => {
            this.health.recordSuccess(p.name);
            return text;
          })
          .catch((err) => {
            this.note(p.name, err);
            throw err;
          })
          .finally(clear);
      }),
    );
    const drafts = settled
      .filter(
        (r): r is PromiseFulfilledResult<string> =>
          r.status === 'fulfilled' && !!r.value.trim(),
      )
      .map((r) => r.value);

    if (drafts.length === 0) return this.generateText(messages, opts);
    if (drafts.length === 1) return drafts[0];

    // Judge: synthesize the best answer from the drafts.
    const question =
      [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const judgePrompt: AIMessage[] = [
      {
        role: 'system',
        content:
          'You are a judge. Given a question and several candidate answers, synthesize the single ' +
          'best, most accurate and complete answer. Merge their strengths; drop errors. Output ONLY the answer.',
      },
      {
        role: 'user',
        content:
          `Question:\n${question}\n\n` +
          drafts.map((d, i) => `--- Candidate ${i + 1} ---\n${d}`).join('\n\n'),
      },
    ];
    try {
      const judged = await this.generateText(judgePrompt, {
        ...opts,
        temperature: 0.2,
      });
      return judged.trim() || drafts.sort((a, b) => b.length - a.length)[0];
    } catch {
      return drafts.sort((a, b) => b.length - a.length)[0]; // judge failed → longest draft
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Builds an AbortSignal that fires on timeout or when the caller aborts. */
  private deadline(external?: AbortSignal): {
    signal: AbortSignal;
    clear: () => void;
  } {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error('LLM request timed out')),
      this.timeoutMs,
    );
    const onAbort = () => controller.abort(external?.reason);
    if (external) {
      if (external.aborted) controller.abort(external.reason);
      else external.addEventListener('abort', onAbort, { once: true });
    }
    return {
      signal: controller.signal,
      clear: () => {
        clearTimeout(timer);
        external?.removeEventListener('abort', onAbort);
      },
    };
  }

  private note(provider: string, err: unknown): void {
    const status = err instanceof AIProviderCallError ? err.status : undefined;
    this.health.recordFailure(provider, status);
    this.logger.warn(
      `Provider "${provider}" failed: ${(err as Error).message} — failing over.`,
    );
  }

  private terminal(lastErr: unknown): Error {
    const msg =
      lastErr instanceof Error ? lastErr.message : 'all providers failed';
    return new Error(`LLM gateway exhausted all providers: ${msg}`);
  }
}
