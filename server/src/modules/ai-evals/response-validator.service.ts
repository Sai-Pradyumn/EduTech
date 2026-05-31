import { Injectable, Logger } from '@nestjs/common';
import { AgentType, Intent } from '../../common/enums';
import { AgentResponse, VisualBlock } from '../ai/types/agent.types';

/**
 * Guards every structured AI response: validates shape, repairs missing fields,
 * clamps values. A broken AI payload must never crash the app.
 */
@Injectable()
export class ResponseValidatorService {
  private readonly logger = new Logger(ResponseValidatorService.name);

  /** Returns a safe AgentResponse, repairing/falling back as needed. */
  validate(
    candidate: Partial<AgentResponse> | undefined,
    fallback: { agentType: AgentType; intent: Intent; answer: string },
  ): AgentResponse {
    if (
      !candidate ||
      typeof candidate.answer !== 'string' ||
      candidate.answer.trim() === ''
    ) {
      this.logger.warn('Agent response missing/empty answer — using fallback.');
      candidate = { ...candidate, answer: fallback.answer };
    }

    const visualBlocks = Array.isArray(candidate?.visualBlocks)
      ? candidate.visualBlocks.filter((b) => this.isVisualBlock(b))
      : [];

    return {
      agentType: candidate?.agentType ?? fallback.agentType,
      intent: candidate?.intent ?? fallback.intent,
      mode: candidate?.mode ?? (visualBlocks.length ? 'mixed' : 'text'),
      answer: candidate?.answer ?? fallback.answer,
      actions: Array.isArray(candidate?.actions) ? candidate.actions : [],
      visualBlocks,
      sources: Array.isArray(candidate?.sources) ? candidate.sources : [],
      confidence: this.clamp(candidate?.confidence ?? 0.8),
      followUpQuestions: Array.isArray(candidate?.followUpQuestions)
        ? candidate.followUpQuestions
        : [],
      recommendedNextActions: Array.isArray(candidate?.recommendedNextActions)
        ? candidate.recommendedNextActions
        : [],
    };
  }

  private isVisualBlock(b: unknown): b is VisualBlock {
    return (
      typeof b === 'object' &&
      b !== null &&
      typeof (b as { type?: unknown }).type === 'string'
    );
  }

  private clamp(n: number): number {
    if (Number.isNaN(n)) return 0.8;
    return Math.max(0, Math.min(1, n));
  }
}
