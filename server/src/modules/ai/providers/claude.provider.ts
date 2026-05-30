import { Injectable } from '@nestjs/common';
import {
  AIMessage,
  AIProviderNotConfiguredError,
  GenOptions,
  IAIProvider,
} from '../interfaces/ai-provider.interface';

/**
 * Placeholder Anthropic Claude provider. Wire the @anthropic-ai/sdk here and read
 * CLAUDE_API_KEY. Throws a clear error until configured.
 */
@Injectable()
export class ClaudeProvider implements IAIProvider {
  readonly name = 'claude';
  constructor(private readonly apiKey: string) {}

  private ensure(): void {
    if (!this.apiKey) throw new AIProviderNotConfiguredError('claude');
    throw new AIProviderNotConfiguredError('claude');
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
