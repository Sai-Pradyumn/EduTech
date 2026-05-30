/** Provider-agnostic AI contract. Swap implementations via AI_PROVIDER env. */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenOptions {
  temperature?: number;
  maxTokens?: number;
  /**
   * For mock structured output: a factory that builds the typed result from the
   * parsed input. Real providers ignore this and rely on `schema`.
   */
  mockFactory?: () => unknown;
}

export interface IAIProvider {
  readonly name: string;
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
