import { Injectable } from '@nestjs/common';
import { AgentType, Intent } from '../../../common/enums';
import {
  AgentResponse,
  QuizBlock,
  VisualBlock,
} from '../../ai/types/agent.types';
import { AssessmentService } from '../../assessment/services/assessment.service';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';
import { LlmComposerService } from '../core/llm-composer.service';
import { personaFor } from '../prompts/personas';

/**
 * Assessment agent — turns "quiz me on X" into a real, persisted adaptive quiz, returned
 * as a QuizBlock and openable in the Quiz Studio to take + get graded. Difficulty adapts
 * to the student's level and recent scores; a document id in context produces a
 * doc-grounded quiz.
 */
@Injectable()
export class AssessmentAgentService implements IAgent {
  readonly type = AgentType.Assessment;

  constructor(
    private readonly assessment: AssessmentService,
    private readonly composer: LlmComposerService,
  ) {}

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    const documentId = this.readDocumentId(ctx.request.context);
    const topic = this.extractTopic(ctx.request.message);

    ctx.emit({
      type: 'thinking',
      messageId: '',
      label: 'Choosing difficulty from your level & recent scores',
    });
    ctx.emit({
      type: 'tool_call',
      messageId: '',
      tool: 'assessment.generate',
      label: documentId
        ? 'Generating a quiz from your document'
        : `Generating a quiz on ${topic}`,
    });

    const quiz = await this.assessment.generate(ctx.request.userId, {
      source: documentId ? 'document' : 'topic',
      topic,
      documentId,
      count: 5,
    });

    ctx.emit({
      type: 'tool_result',
      messageId: '',
      tool: 'assessment.generate',
      summary: `${quiz.questions.length} ${quiz.difficulty} questions ready`,
    });

    const fallback = [
      `Here's a **${quiz.difficulty}** quiz on **${this.titleCase(quiz.topic)}** — ${quiz.questions.length} questions.`,
      '',
      'Answer below, or open it in the Quiz Studio to take it properly and get graded with weak-area feedback.',
    ].join('\n');
    const system =
      `${personaFor(AgentType.Assessment)}\n` +
      `A ${quiz.difficulty} quiz on "${quiz.topic}" with ${quiz.questions.length} questions was just generated for the student. ` +
      `Write a short, encouraging 1–2 sentence intro framing what it tests. Do NOT list the questions.`;
    const answer = await this.composer.streamAnswer(ctx, {
      system,
      fallback,
      agentType: AgentType.Assessment,
      operation: 'assessment.intro',
      temperature: 0.5,
    });

    const block = this.toQuizBlock(quiz.title, quiz.questions);
    ctx.emit({ type: 'visual_block', messageId: '', block });

    return {
      agentType: AgentType.Assessment,
      intent: Intent.QuizGeneration,
      mode: 'mixed',
      answer,
      actions: [
        {
          id: 'take',
          label: 'Open in Quiz Studio',
          kind: 'open_route',
          payload: { route: '/app/quizzes', quizId: String(quiz._id) },
        },
        {
          id: 'harder',
          label: 'Make it harder',
          kind: 'custom',
          payload: { topic, difficulty: 'advanced' },
        },
        {
          id: 'doc-quiz',
          label: 'Quiz me from my notes',
          kind: 'custom',
          payload: { source: 'document' },
        },
      ],
      visualBlocks: [block],
      confidence: 0.9,
      followUpQuestions: [
        `Quiz me on a harder ${topic} topic`,
        `Explain the ${topic} questions I might miss`,
      ],
      recommendedNextActions: [
        'Take the quiz in the Quiz Studio for graded feedback',
        ctx.roadmap
          ? `Tie this to your roadmap: ${ctx.roadmap.currentWeekFocus ?? ctx.roadmap.title}`
          : 'Generate a roadmap to structure your practice',
      ],
    };
  }

  private toQuizBlock(
    title: string,
    questions: {
      prompt: string;
      options: string[];
      answerIndex?: number;
      explanation: string;
    }[],
  ): QuizBlock {
    return {
      type: 'quiz',
      title,
      questions: questions.map((q) => ({
        prompt: q.prompt,
        options: q.options,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
      })),
    } satisfies VisualBlock;
  }

  private readDocumentId(
    context?: Record<string, unknown>,
  ): string | undefined {
    const ids = context?.['documentIds'];
    if (Array.isArray(ids) && typeof ids[0] === 'string') return ids[0];
    const single = context?.['documentId'];
    return typeof single === 'string' ? single : undefined;
  }

  private extractTopic(message: string): string {
    const cleaned = message
      .toLowerCase()
      .replace(/^(can you |please )?(quiz|test) me (on|about)\s+/i, '')
      .replace(
        /^(generate|create|make) (a |an )?(quiz|test|mcq[s]?) (on|about|for)\s+/i,
        '',
      )
      .replace(/\b(quiz|test) me\b/i, '')
      .replace(/[?.!]+$/, '')
      .trim();
    return cleaned || message.trim() || 'general concepts';
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
