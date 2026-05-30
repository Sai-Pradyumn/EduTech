import { Injectable } from '@nestjs/common';
import {
  AIMessage,
  AIProviderNotConfiguredError,
  GenOptions,
  IAIProvider,
} from '../interfaces/ai-provider.interface';

/**
 * Placeholder OpenAI provider. Wire the official SDK here and read OPENAI_API_KEY.
 * Until then it throws a clear, actionable error so misconfig is obvious.
 */
@Injectable()
export class OpenAIProvider implements IAIProvider {
  readonly name = 'openai';
  constructor(private readonly apiKey: string) {}

  private ensure(): void {
    if (!this.apiKey) throw new AIProviderNotConfiguredError('openai');
    // TODO(phase-x): instantiate the OpenAI SDK client with this.apiKey.
    throw new AIProviderNotConfiguredError('openai');
  }

  async generateText(_messages: AIMessage[], _opts?: GenOptions): Promise<string> {
    this.ensure();
    return '';
  }

  async *streamText(_messages: AIMessage[], _opts?: GenOptions): AsyncIterable<string> {
    this.ensure();
    yield '';
  }

  async generateStructuredOutput<T>(
    _messages: AIMessage[],
    _schema: Record<string, unknown>,
    _opts?: GenOptions,
  ): Promise<T> {
    this.ensure();
    return {} as T;
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    this.ensure();
    return [];
  }
}
