import { Injectable } from '@nestjs/common';
import {
  AIMessage,
  AIProviderNotConfiguredError,
  GenOptions,
  IAIProvider,
} from '../interfaces/ai-provider.interface';

/**
 * Placeholder Gemini provider. Wire the Google Generative AI SDK here and read
 * GEMINI_API_KEY. Throws a clear error until configured.
 */
@Injectable()
export class GeminiProvider implements IAIProvider {
  readonly name = 'gemini';
  constructor(private readonly apiKey: string) {}

  private ensure(): void {
    if (!this.apiKey) throw new AIProviderNotConfiguredError('gemini');
    throw new AIProviderNotConfiguredError('gemini');
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
