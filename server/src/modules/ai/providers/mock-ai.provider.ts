import { Injectable } from '@nestjs/common';
import {
  AIMessage,
  GenOptions,
  IAIProvider,
  ProviderCapabilities,
} from '../interfaces/ai-provider.interface';

/**
 * Deterministic, realistic mock provider — runs with zero API keys.
 * - streamText splits text into word chunks to simulate token streaming.
 * - generateStructuredOutput returns the caller-provided mockFactory() result,
 *   so agents stay in control of domain-shaped output (e.g. roadmaps).
 * - generateEmbedding returns a deterministic normalized vector from token hashes,
 *   so the keyword/cosine fallback in RAG works without an embedding API.
 */
@Injectable()
export class MockAIProvider implements IAIProvider {
  readonly name = 'mock';
  readonly isLive = false;
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    structured: true,
    embeddings: true,
  };
  private static readonly EMBED_DIM = 256;

  async generateText(
    messages: AIMessage[],
    _opts?: GenOptions,
  ): Promise<string> {
    const last = messages[messages.length - 1]?.content ?? '';
    return `Here's a clear, structured explanation based on your question: "${last.slice(0, 80)}".`;
  }

  async *streamText(
    messages: AIMessage[],
    _opts?: GenOptions,
  ): AsyncIterable<string> {
    const full = await this.generateText(messages, _opts);
    for (const token of full.split(/(\s+)/)) {
      // Small jitter to look like real token streaming; deterministic enough for dev.
      await new Promise((r) => setTimeout(r, 18));
      yield token;
    }
  }

  async generateStructuredOutput<T>(
    _messages: AIMessage[],
    _schema: Record<string, unknown>,
    opts?: GenOptions,
  ): Promise<T> {
    if (opts?.mockFactory) return opts.mockFactory() as T;
    return {} as T;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const vec = new Array<number>(MockAIProvider.EMBED_DIM).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const tok of tokens) {
      let h = 2166136261;
      for (let i = 0; i < tok.length; i++) {
        h ^= tok.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      vec[Math.abs(h) % MockAIProvider.EMBED_DIM] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
