import { Injectable } from '@nestjs/common';
import { AgentType, Intent } from '../../../common/enums';
import {
  AgentResponse,
  ConceptMapBlock,
  SourceReference,
  VisualBlock,
} from '../../ai/types/agent.types';
import { Citation } from '../../rag/services/citation.service';
import { RagAnswerService } from '../../rag/services/rag-answer.service';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';

/**
 * RAG agent — answers strictly from the student's uploaded knowledge base, with inline
 * citations and an honest refusal when the corpus doesn't cover the question. Runs through
 * the standard Agent OS pipeline (orchestrator → validate → persist → stream), so its
 * answer streams over the same `agent:*` events and its citations persist as `sources`.
 */
@Injectable()
export class RagAgentService implements IAgent {
  readonly type = AgentType.Rag;

  constructor(private readonly ragAnswer: RagAnswerService) {}

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    const documentIds = this.readDocumentIds(ctx.request.context);
    const scopeLabel = documentIds?.length
      ? `${documentIds.length} selected doc(s)`
      : 'all your documents';

    ctx.emit({
      type: 'thinking',
      messageId: '',
      label: `Searching ${scopeLabel}`,
    });
    ctx.emit({
      type: 'tool_call',
      messageId: '',
      tool: 'rag.retrieve',
      label: 'Hybrid retrieval (dense + keyword + RRF)',
    });

    const result = await this.ragAnswer.answer(ctx.request.message, {
      userId: ctx.request.userId,
      documentIds,
    });

    ctx.emit({
      type: 'tool_result',
      messageId: '',
      tool: 'rag.retrieve',
      summary: result.citations.length
        ? `${result.citations.length} passage(s) · ${result.groundedness} (${Math.round(result.confidence * 100)}%)`
        : 'No matching passages — answering honestly',
    });
    ctx.emit({
      type: 'thinking',
      messageId: '',
      label: 'Grounding the answer in your sources',
    });

    const answer = this.withSourceList(result.answer, result.citations);
    await this.stream(answer, ctx);

    const visualBlocks = this.buildBlocks(result.citations);
    for (const block of visualBlocks)
      ctx.emit({ type: 'visual_block', messageId: '', block });

    return {
      agentType: AgentType.Rag,
      intent: Intent.DocumentQuestion,
      mode: 'mixed',
      answer,
      actions: [
        {
          id: 'ask-all',
          label: 'Ask across all docs',
          kind: 'custom',
          payload: { scope: 'all' },
        },
        { id: 'quiz', label: 'Quiz me on this', kind: 'generate_quiz' },
        {
          id: 'summary',
          label: 'Summarize the source',
          kind: 'generate_notes',
        },
      ],
      visualBlocks,
      sources: this.toSources(result.citations),
      confidence: result.confidence,
      followUpQuestions: this.followUps(result.suggestedNextTopic),
      recommendedNextActions:
        result.groundedness === 'insufficient'
          ? [
              'Upload a document that covers this topic',
              'Rephrase the question with more specifics',
            ]
          : [
              'Open a citation to read the source passage',
              'Generate a quiz from this document',
            ],
    };
  }

  private readDocumentIds(
    context?: Record<string, unknown>,
  ): string[] | undefined {
    const raw = context?.['documentIds'];
    if (Array.isArray(raw))
      return raw.filter((x): x is string => typeof x === 'string');
    return undefined;
  }

  private withSourceList(answer: string, citations: Citation[]): string {
    if (citations.length === 0) return answer;
    const list = citations
      .map((c) => `[${c.n}] ${c.documentTitle} — ${c.locator}`)
      .join('\n');
    return `${answer}\n\n**Sources**\n${list}`;
  }

  private toSources(citations: Citation[]): SourceReference[] {
    return citations.map((c) => ({
      documentId: c.documentId,
      chunkId: c.chunkId,
      title: `${c.documentTitle} · ${c.locator}`,
      snippet: c.snippet,
      score: c.score,
    }));
  }

  private buildBlocks(citations: Citation[]): VisualBlock[] {
    if (citations.length === 0) return [];
    const map: ConceptMapBlock = {
      type: 'concept_map',
      title: 'Where this answer comes from',
      rootConcept: 'Answer',
      nodes: [
        { id: 'root', label: 'Answer', group: 'root' },
        ...citations.map((c) => ({
          id: `c${c.n}`,
          label: `[${c.n}] ${c.locator}`,
          group: 'source',
        })),
      ],
      edges: citations.map((c) => ({
        from: 'root',
        to: `c${c.n}`,
        label: c.documentTitle,
      })),
    };
    return [map];
  }

  private followUps(nextTopic?: string): string[] {
    const base = [
      'What else do my documents say about this?',
      'Give me a 1-line summary with the source.',
    ];
    if (nextTopic)
      base.unshift(`Tell me more about ${nextTopic} from my notes.`);
    return base.slice(0, 3);
  }

  private async stream(text: string, ctx: AgentRuntimeContext): Promise<void> {
    for (const token of text.split(/(\s+)/)) {
      ctx.emit({ type: 'chunk', messageId: '', delta: token });
      await new Promise((r) => setTimeout(r, 6));
    }
  }
}
