import {
  Content,
  GenerationConfig,
  GoogleGenerativeAI,
} from '@google/generative-ai';
import { Logger } from '@nestjs/common';
import {
  AIMessage,
  AIProviderCallError,
  AIProviderNotConfiguredError,
  GenOptions,
  IAIProvider,
  ProviderCapabilities,
} from '../interfaces/ai-provider.interface';
import { jsonSchemaInstruction, parseJsonLoose, splitSystem } from './provider-utils';

const EMBED_MODEL = 'text-embedding-004';

/**
 * Google Gemini provider. Streaming via generateContentStream, JSON mode for structured
 * output, and text-embedding-004 embeddings. Usage read from response.usageMetadata.
 */
export class GeminiProvider implements IAIProvider {
  readonly name = 'gemini';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    structured: true,
    embeddings: true,
  };
  private readonly logger = new Logger('GeminiProvider');
  private readonly client?: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
    private readonly maxTokens: number,
  ) {
    if (apiKey) this.client = new GoogleGenerativeAI(apiKey);
  }

  get isLive(): boolean {
    return !!this.client;
  }

  private ensure(): GoogleGenerativeAI {
    if (!this.client) throw new AIProviderNotConfiguredError('gemini');
    return this.client;
  }

  private mapTurns(turns: AIMessage[]): Content[] {
    return turns.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  }

  private genConfig(opts?: GenOptions, json = false): GenerationConfig {
    const cfg: GenerationConfig = {
      temperature: opts?.temperature,
      topP: opts?.topP,
      stopSequences: opts?.stop,
      maxOutputTokens: opts?.maxTokens ?? this.maxTokens,
    };
    if (json) cfg.responseMimeType = 'application/json';
    return cfg;
  }

  async generateText(messages: AIMessage[], opts?: GenOptions): Promise<string> {
    const client = this.ensure();
    const { system, turns } = splitSystem(messages, opts?.system);
    const modelName = opts?.model ?? this.defaultModel;
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: system || undefined,
      });
      const res = await model.generateContent(
        { contents: this.mapTurns(turns), generationConfig: this.genConfig(opts) },
        { signal: opts?.signal },
      );
      this.reportUsage(res.response, opts, modelName);
      return res.response.text();
    } catch (err) {
      throw this.wrap(err);
    }
  }

  async *streamText(messages: AIMessage[], opts?: GenOptions): AsyncIterable<string> {
    const client = this.ensure();
    const { system, turns } = splitSystem(messages, opts?.system);
    const modelName = opts?.model ?? this.defaultModel;
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: system || undefined,
      });
      const res = await model.generateContentStream(
        { contents: this.mapTurns(turns), generationConfig: this.genConfig(opts) },
        { signal: opts?.signal },
      );
      for await (const chunk of res.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
      const final = await res.response;
      this.reportUsage(final, opts, modelName);
    } catch (err) {
      throw this.wrap(err);
    }
  }

  async generateStructuredOutput<T>(
    messages: AIMessage[],
    schema: Record<string, unknown>,
    opts?: GenOptions,
  ): Promise<T> {
    const client = this.ensure();
    const { system, turns } = splitSystem(messages, opts?.system);
    const modelName = opts?.model ?? this.defaultModel;
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: [system, jsonSchemaInstruction(schema)].filter(Boolean).join('\n\n'),
      });
      const res = await model.generateContent(
        { contents: this.mapTurns(turns), generationConfig: this.genConfig(opts, true) },
        { signal: opts?.signal },
      );
      this.reportUsage(res.response, opts, modelName);
      return parseJsonLoose<T>(res.response.text());
    } catch (err) {
      throw this.wrap(err);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const client = this.ensure();
    try {
      const model = client.getGenerativeModel({ model: EMBED_MODEL });
      const res = await model.embedContent(text);
      return res.embedding.values ?? [];
    } catch (err) {
      throw this.wrap(err);
    }
  }

  private reportUsage(
    response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } },
    opts: GenOptions | undefined,
    model: string,
  ): void {
    const u = response.usageMetadata;
    if (u) {
      opts?.onUsage?.(
        { promptTokens: u.promptTokenCount ?? 0, completionTokens: u.candidatesTokenCount ?? 0 },
        { provider: this.name, model },
      );
    }
  }

  private wrap(err: unknown): AIProviderCallError {
    if (err instanceof AIProviderCallError) return err;
    const status = (err as { status?: number })?.status;
    return new AIProviderCallError('gemini', (err as Error).message, status);
  }
}
