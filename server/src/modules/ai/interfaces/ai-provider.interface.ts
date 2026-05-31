/** Provider-agnostic AI contract. Swap implementations via AI_PROVIDER env. */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Real token accounting reported by a provider so cost/usage logging is honest. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}

export interface GenOptions {
  /** Override the provider's default model for this call. */
  model?: string;
  /** System prompt (providers that separate it from the message list use this). */
  system?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  /** Hint the provider to return strict JSON (used by structured output). */
  responseFormat?: 'text' | 'json';
  /** Abort/timeout signal threaded from the gateway. */
  signal?: AbortSignal;
  /**
   * For mock structured output: a factory that builds the typed result from the
   * parsed input. Real providers ignore this and rely on `schema`.
   */
  mockFactory?: () => unknown;
  /** Invoked with real usage after a call completes (best-effort; ignored by mock). */
  onUsage?: (
    usage: TokenUsage,
    meta: { provider: string; model: string },
  ) => void;
  /**
   * Optional attribution; when present, AiService records an ai_usage_log row with the
   * real token counts captured from this call (estimated when the provider is mock).
   */
  meta?: { userId?: string; agentType?: string; operation?: string };
}

export interface ProviderCapabilities {
  chat: boolean;
  streaming: boolean;
  structured: boolean;
  embeddings: boolean;
}

export interface IAIProvider {
  readonly name: string;
  /** True when a real API key is configured and the provider can actually call out. */
  readonly isLive: boolean;
  readonly capabilities: ProviderCapabilities;
  generateText(messages: AIMessage[], opts?: GenOptions): Promise<string>;
  streamText(messages: AIMessage[], opts?: GenOptions): AsyncIterable<string>;
  generateStructuredOutput<T>(
    messages: AIMessage[],
    schema: Record<string, unknown>,
    opts?: GenOptions,
  ): Promise<T>;
  generateEmbedding(text: string): Promise<number[]>;
}

export const AI_PROVIDER_TOKEN = 'AI_PROVIDER_TOKEN';

export class AIProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `AI provider "${provider}" is selected but not configured. Set the API key in .env, ` +
        `or use AI_PROVIDER=mock to run without keys.`,
    );
    this.name = 'AIProviderNotConfiguredError';
  }
}

/** Thrown on a transient provider failure (rate limit / timeout) so the gateway can fail over. */
export class AIProviderCallError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AIProviderCallError';
  }
}
