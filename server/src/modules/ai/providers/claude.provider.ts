import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import {
  AIMessage,
  AIProviderCallError,
  AIProviderNotConfiguredError,
  GenOptions,
  IAIProvider,
  ProviderCapabilities,
} from '../interfaces/ai-provider.interface';
import { splitSystem } from './provider-utils';

/**
 * Anthropic Claude provider. Streaming via messages.stream, structured output via a
 * forced single tool (input_schema = the requested JSON schema), prompt caching on the
 * system block. Claude has no native embeddings → capabilities.embeddings = false.
 */
export class ClaudeProvider implements IAIProvider {
  readonly name = 'claude';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    structured: true,
    embeddings: false,
  };
  private readonly logger = new Logger('ClaudeProvider');
  private readonly client?: Anthropic;

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
    private readonly maxTokens: number,
  ) {
    if (apiKey) this.client = new Anthropic({ apiKey });
  }

  get isLive(): boolean {
    return !!this.client;
  }

  private ensure(): Anthropic {
    if (!this.client) throw new AIProviderNotConfiguredError('claude');
    return this.client;
  }

  private system(text: string): Anthropic.MessageCreateParams['system'] {
    if (!text) return undefined;
    // Prompt caching: cache the (often-large, stable) system prompt.
    return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
  }

  private mapTurns(turns: AIMessage[]): Anthropic.MessageParam[] {
    return turns.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));
  }

  async generateText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): Promise<string> {
    const client = this.ensure();
    const { system, turns } = splitSystem(messages, opts?.system);
    const model = opts?.model ?? this.defaultModel;
    try {
      const res = await client.messages.create(
        {
          model,
          max_tokens: opts?.maxTokens ?? this.maxTokens,
          temperature: opts?.temperature,
          top_p: opts?.topP,
          stop_sequences: opts?.stop,
          system: this.system(system),
          messages: this.mapTurns(turns),
        },
        { signal: opts?.signal },
      );
      opts?.onUsage?.(
        {
          promptTokens: res.usage.input_tokens,
          completionTokens: res.usage.output_tokens,
        },
        { provider: this.name, model },
      );
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
    } catch (err) {
      throw this.wrap(err);
    }
  }

  async *streamText(
    messages: AIMessage[],
    opts?: GenOptions,
  ): AsyncIterable<string> {
    const client = this.ensure();
    const { system, turns } = splitSystem(messages, opts?.system);
    const model = opts?.model ?? this.defaultModel;
    try {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: opts?.maxTokens ?? this.maxTokens,
          temperature: opts?.temperature,
          top_p: opts?.topP,
          stop_sequences: opts?.stop,
          system: this.system(system),
          messages: this.mapTurns(turns),
        },
        { signal: opts?.signal },
      );
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      opts?.onUsage?.(
        {
          promptTokens: final.usage.input_tokens,
          completionTokens: final.usage.output_tokens,
        },
        { provider: this.name, model },
      );
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
    const model = opts?.model ?? this.defaultModel;
    try {
      const res = await client.messages.create(
        {
          model,
          max_tokens: opts?.maxTokens ?? this.maxTokens,
          temperature: opts?.temperature,
          system: this.system(system),
          messages: this.mapTurns(turns),
          tools: [
            {
              name: 'respond',
              description:
                'Return the structured response in the required schema.',
              input_schema: schema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: 'tool', name: 'respond' },
        },
        { signal: opts?.signal },
      );
      opts?.onUsage?.(
        {
          promptTokens: res.usage.input_tokens,
          completionTokens: res.usage.output_tokens,
        },
        { provider: this.name, model },
      );
      const toolUse = res.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (!toolUse) throw new Error('Claude did not return a tool_use block.');
      return toolUse.input as T;
    } catch (err) {
      throw this.wrap(err);
    }
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    throw new AIProviderCallError(
      'claude',
      'Claude does not provide embeddings.',
      501,
    );
  }

  private wrap(err: unknown): AIProviderCallError {
    if (err instanceof AIProviderCallError) return err;
    const status = (err as { status?: number })?.status;
    return new AIProviderCallError('claude', (err as Error).message, status);
  }
}
