import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  AIMessage,
  AIProviderCallError,
  AIProviderNotConfiguredError,
  GenOptions,
  IAIProvider,
  ProviderCapabilities,
} from '../interfaces/ai-provider.interface';
import { jsonSchemaInstruction, parseJsonLoose } from './provider-utils';

export interface OpenAICompatibleConfig {
  /** Provider key, e.g. 'openai' | 'groq' | 'mistral' | 'openrouter' | 'deepseek'. */
  name: string;
  label: string;
  apiKey: string;
  model: string;
  /** Custom base URL — omit for OpenAI itself. Groq/Mistral/OpenRouter/DeepSeek set this. */
  baseURL?: string;
  extraHeaders?: Record<string, string>;
  /** Whether this endpoint exposes /embeddings (true only for OpenAI by default). */
  embeddings?: boolean;
  embeddingModel?: string;
}

/**
 * One adapter for every OpenAI-compatible /chat/completions endpoint — OpenAI, Groq,
 * Mistral, OpenRouter, DeepSeek — via the `openai` SDK with a custom baseURL + headers.
 * Mirrors the reference repo's single `createOpenAiCompatibleProvider`. Streaming, JSON
 * structured output, real token usage; embeddings only where the endpoint supports them.
 */
export class OpenAICompatibleProvider implements IAIProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  private readonly logger: Logger;
  private readonly client?: OpenAI;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(
    private readonly cfg: OpenAICompatibleConfig,
    private readonly maxTokens: number,
  ) {
    this.name = cfg.name;
    this.model = cfg.model;
    this.embeddingModel = cfg.embeddingModel ?? 'text-embedding-3-small';
    this.logger = new Logger(`${cfg.label}Provider`);
    this.capabilities = {
      chat: true,
      streaming: true,
      structured: true,
      embeddings: !!cfg.embeddings,
    };
    if (cfg.apiKey) {
      this.client = new OpenAI({
        apiKey: cfg.apiKey,
        baseURL: cfg.baseURL,
        defaultHeaders: cfg.extraHeaders,
      });
    }
  }

  get isLive(): boolean {
    return !!this.client;
  }

  private ensure(): OpenAI {
    if (!this.client) throw new AIProviderNotConfiguredError(this.name);
    return this.client;
  }

  private mapMessages(
    messages: AIMessage[],
    systemOverride?: string,
    extraSystem?: string,
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const sys = [systemOverride, extraSystem].filter(Boolean).join('\n\n');
    if (sys) out.push({ role: 'system', content: sys });
    for (const m of messages) out.push({ role: m.role, content: m.content });
    return out;
  }

  async generateText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): Promise<string> {
    const client = this.ensure();
    const model = opts?.model ?? this.model;
    try {
      const res = await client.chat.completions.create(
        {
          model,
          messages: this.mapMessages(messages, opts?.system),
          temperature: opts?.temperature,
          top_p: opts?.topP,
          stop: opts?.stop,
          max_tokens: opts?.maxTokens ?? this.maxTokens,
        },
        { signal: opts?.signal },
      );
      this.reportUsage(res.usage, opts, model);
      return res.choices[0]?.message?.content ?? '';
    } catch (err) {
      throw this.wrap(err);
    }
  }

  async *streamText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): AsyncIterable<string> {
    const client = this.ensure();
    const model = opts?.model ?? this.model;
    try {
      const stream = await client.chat.completions.create(
        {
          model,
          messages: this.mapMessages(messages, opts?.system),
          temperature: opts?.temperature,
          top_p: opts?.topP,
          stop: opts?.stop,
          max_tokens: opts?.maxTokens ?? this.maxTokens,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal: opts?.signal },
      );
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
        if (chunk.usage) this.reportUsage(chunk.usage, opts, model);
      }
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
    const model = opts?.model ?? this.model;
    try {
      const res = await client.chat.completions.create(
        {
          model,
          messages: this.mapMessages(
            messages,
            opts?.system,
            jsonSchemaInstruction(schema),
          ),
          temperature: opts?.temperature,
          max_tokens: opts?.maxTokens ?? this.maxTokens,
          response_format: { type: 'json_object' },
        },
        { signal: opts?.signal },
      );
      this.reportUsage(res.usage, opts, model);
      return parseJsonLoose<T>(res.choices[0]?.message?.content ?? '');
    } catch (err) {
      throw this.wrap(err);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.capabilities.embeddings) {
      throw new AIProviderCallError(
        this.name,
        `${this.cfg.label} has no embeddings endpoint.`,
        501,
      );
    }
    const client = this.ensure();
    try {
      const res = await client.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });
      return res.data[0]?.embedding ?? [];
    } catch (err) {
      throw this.wrap(err);
    }
  }

  private reportUsage(
    usage:
      | { prompt_tokens?: number; completion_tokens?: number }
      | undefined
      | null,
    opts: GenOptions | undefined,
    model: string,
  ): void {
    if (usage) {
      opts?.onUsage?.(
        {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
        },
        { provider: this.name, model },
      );
    }
  }

  private wrap(err: unknown): AIProviderCallError {
    if (err instanceof AIProviderCallError) return err;
    const status = (err as { status?: number })?.status;
    return new AIProviderCallError(this.name, (err as Error).message, status);
  }
}
