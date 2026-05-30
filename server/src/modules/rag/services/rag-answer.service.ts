import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { AgentType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { ChunkHit, RetrievalScope } from '../vector/vector-store.interface';
import { termOverlap, tokenize } from '../vector/scoring';
import { HybridRetrieverService } from '../vector/hybrid-retriever.service';
import { Citation, CitationService } from './citation.service';

export type Groundedness = 'grounded' | 'partial' | 'insufficient';

export interface GroundedAnswer {
  answer: string; // markdown, inline [n] citations
  citations: Citation[];
  confidence: number; // 0..1
  groundedness: Groundedness;
  suggestedNextTopic?: string;
}

const REFUSAL = "I don't know from the provided content.";

/**
 * Strictly-grounded answering. Answers ONLY from retrieved chunks, cites every claim,
 * refuses (no model guess) when retrieval is empty or weak, and surfaces a confidence
 * band. The grounded composition is deterministic so the anti-hallucination contract is
 * testable end-to-end with the MockAIProvider (no keys). A real provider swaps the
 * compose step for a grounded generation call + marker validation — the retrieval,
 * citation, refusal and confidence logic are unchanged.
 */
@Injectable()
export class RagAnswerService {
  private readonly topK: number;
  private readonly minScore: number;

  constructor(
    private readonly retriever: HybridRetrieverService,
    private readonly citations: CitationService,
    private readonly ai: AiService,
    @Inject(ConfigService) config: ConfigService<AppConfig, true>,
  ) {
    this.topK = config.get('rag.topK', { infer: true });
    this.minScore = config.get('rag.minScore', { infer: true });
  }

  async answer(question: string, scope: RetrievalScope): Promise<GroundedAnswer> {
    const hits = await this.retriever.retrieve(question, scope, this.topK);
    await this.ai.logUsage({ userId: scope.userId, agentType: AgentType.Rag, operation: 'rag.answer' });

    if (hits.length === 0 || hits[0].score < this.minScore) {
      return {
        answer: `${REFUSAL}\n\n_Try uploading a document that covers this, or rephrase the question._`,
        citations: [],
        confidence: Math.min(0.34, hits[0]?.score ?? 0),
        groundedness: 'insufficient',
      };
    }

    const citations = this.citations.build(hits);
    const queryTerms = tokenize(question);
    const answer = this.compose(question, hits, queryTerms);
    const confidence = this.confidence(hits, answer);
    const groundedness: Groundedness =
      confidence < 0.35 ? 'insufficient' : confidence <= 0.6 ? 'partial' : 'grounded';

    return {
      answer,
      citations,
      confidence,
      groundedness,
      suggestedNextTopic: hits[0].headingPath?.split(' ▸ ').pop(),
    };
  }

  /** Compose a grounded answer: one cited point per retrieved chunk, best sentence first. */
  private compose(question: string, hits: ChunkHit[], queryTerms: string[]): string {
    const points = hits.map((h, i) => {
      const sentence = this.bestSentence(h.text, queryTerms);
      return `- ${sentence} [${i + 1}]`;
    });

    const covered = hits.some((h) => termOverlap(queryTerms, h.text) >= 0.5);
    const lines = [
      `Here's what your ${hits.length > 1 ? 'documents say' : 'document says'} about this:`,
      '',
      ...points,
    ];
    if (!covered) {
      lines.push(
        '',
        `_Note: the documents only partially address "${question.replace(/[_*`]/g, '').slice(0, 120)}". The points above are the closest grounded matches — anything beyond them isn't in your sources._`,
      );
    }
    return lines.join('\n');
  }

  /** Pick the sentence in a chunk with the highest overlap with the question. */
  private bestSentence(text: string, queryTerms: string[]): string {
    const sentences = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && !s.startsWith('…'));
    if (sentences.length === 0) return text.replace(/\s+/g, ' ').trim().slice(0, 220);
    let best = sentences[0];
    let bestScore = -1;
    for (const s of sentences) {
      const score = termOverlap(queryTerms, s);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best.length > 280 ? `${best.slice(0, 280)}…` : best;
  }

  /** Confidence = blend of top similarity, #1↔#k margin, citation coverage, answer/context overlap. */
  private confidence(hits: ChunkHit[], answer: string): number {
    const top = hits[0].score;
    const margin = top - hits[hits.length - 1].score;
    const markers = (answer.match(/\[\d+]/g) ?? []).length;
    const coverage = Math.min(1, markers / hits.length);
    const context = hits.map((h) => h.text).join(' ');
    const overlap = termOverlap(tokenize(answer), context);
    const blended = 0.5 * top + 0.2 * Math.max(0, margin) + 0.15 * coverage + 0.15 * overlap;
    return Math.max(0, Math.min(1, Math.round(blended * 100) / 100));
  }
}
