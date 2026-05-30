import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';

/**
 * Embeds chunk texts via IAIProvider.generateEmbedding. With the MockAIProvider this is
 * a deterministic, L2-normalized hashed vector (stable per input), so cosine + keyword
 * retrieval both behave realistically with no API key. Batched sequentially to stay
 * within provider rate limits; swap to a batch endpoint for real providers.
 */
@Injectable()
export class EmbeddingService {
  constructor(private readonly ai: AiService) {}

  async embedAll(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const text of texts) {
      out.push(await this.ai.generateEmbedding(text));
    }
    return out;
  }

  get provider(): string {
    return this.ai.providerName;
  }
}
