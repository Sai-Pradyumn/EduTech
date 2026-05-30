import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';

const CONCURRENCY = 5;

/**
 * Embeds chunk texts via the LLM gateway (AiService.generateEmbedding). With a live,
 * embeddings-capable provider these are real dense vectors; with no key the gateway
 * returns deterministic L2-normalized hashed vectors, so cosine + keyword retrieval both
 * behave realistically offline. Embedded with bounded concurrency to stay within rate
 * limits while keeping ingestion fast.
 */
@Injectable()
export class EmbeddingService {
  constructor(private readonly ai: AiService) {}

  async embedAll(texts: string[]): Promise<number[][]> {
    const out: number[][] = new Array(texts.length);
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < texts.length) {
        const i = cursor++;
        out[i] = await this.ai.generateEmbedding(texts[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker));
    return out;
  }

  get provider(): string {
    return this.ai.providerName;
  }
}
