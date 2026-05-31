import { Injectable, OnModuleInit } from '@nestjs/common';
import { AssessmentService } from '../../assessment/services/assessment.service';
import { RagAnswerService } from '../../rag/services/rag-answer.service';
import { AgentToolRegistryService } from './agent-tool-registry.service';

/**
 * Registers Asta's built-in, READ-ONLY agent tools by wrapping existing services. These
 * are the functions an LLM agent may call (validated by AgentToolRegistryService.safeCall).
 * userId is always supplied by the server (trusted), never by the model.
 */
@Injectable()
export class ToolsRegistrarService implements OnModuleInit {
  constructor(
    private readonly registry: AgentToolRegistryService,
    private readonly rag: RagAnswerService,
    private readonly assessment: AssessmentService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'search_my_notes',
      description:
        'Search the student’s own uploaded documents and return a grounded, cited snippet.',
      readOnly: true,
      argKeys: ['query'],
      run: async (args) => {
        const userId = (args['userId'] as string | undefined) ?? '';
        const query = ((args['query'] as string | undefined) ?? '').slice(
          0,
          300,
        );
        if (!userId || !query) return { found: false };
        const r = await this.rag.answer(query, { userId });
        return {
          found: r.groundedness !== 'insufficient',
          answer: r.answer.slice(0, 800),
          sources: r.citations
            .slice(0, 3)
            .map((c) => `${c.documentTitle} — ${c.locator}`),
        };
      },
    });

    this.registry.register({
      name: 'get_learner_snapshot',
      description:
        'Get the student’s topic mastery and weakest topics from their quiz history.',
      readOnly: true,
      argKeys: [],
      run: async (args) => {
        const userId = (args['userId'] as string | undefined) ?? '';
        if (!userId) return { mastery: [] };
        const mastery = await this.assessment.topicMastery(userId);
        const sorted = [...mastery].sort((a, b) => a.mastery - b.mastery);
        return {
          weakest: sorted
            .slice(0, 3)
            .map((m) => ({ topic: m.topic, mastery: m.mastery })),
          strongest: [...sorted]
            .reverse()
            .slice(0, 3)
            .map((m) => ({ topic: m.topic, mastery: m.mastery })),
        };
      },
    });
  }
}
