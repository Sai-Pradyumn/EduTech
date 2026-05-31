import { Injectable } from '@nestjs/common';
import { AgentType, INTENT_AGENT_MAP, Intent } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';

interface IntentRule {
  intent: Intent;
  keywords: string[];
}

/** Keyword-scored intent classifier — the fast, offline, always-available fallback. */
const RULES: IntentRule[] = [
  {
    intent: Intent.RoadmapGeneration,
    keywords: ['roadmap', 'learning path', 'plan to learn', 'study plan for'],
  },
  {
    intent: Intent.QuizGeneration,
    keywords: ['quiz', 'test me', 'mcq', 'questions on', 'assessment'],
  },
  {
    intent: Intent.ProjectPlanning,
    keywords: ['project', 'build an app', 'build a', 'architecture for'],
  },
  {
    intent: Intent.DocumentQuestion,
    keywords: ['from my notes', 'document', 'pdf', 'uploaded', 'according to'],
  },
  {
    intent: Intent.CareerGuidance,
    keywords: [
      'career',
      'resume',
      'job',
      'interview prep',
      'placement',
      'internship',
      'skill gap',
      'am i ready',
      'how ready',
    ],
  },
  {
    intent: Intent.MentorReview,
    keywords: [
      'review my progress',
      'how am i doing',
      'plan my week',
      'am i on track',
      'mentor',
    ],
  },
  {
    intent: Intent.VoicePractice,
    keywords: ['speak', 'voice', 'pronounce', 'mock interview out loud'],
  },
  {
    intent: Intent.ContentGeneration,
    keywords: [
      'generate notes',
      'make notes',
      'study notes',
      'flashcards',
      'flash cards',
      'cheat sheet',
      'cheatsheet',
      'study material',
      'summarize this topic',
    ],
  },
  {
    intent: Intent.DoubtSolving,
    keywords: [
      'error',
      'bug',
      "doesn't work",
      "isn't working",
      'not working',
      'why is',
      'fix this',
      'stuck on',
      'undefined',
      'cannot read',
      'is not a function',
      'throws',
      'exception',
      'traceback',
      'stack trace',
      'cors',
      'crash',
      'failing',
    ],
  },
  {
    intent: Intent.ConceptExplanation,
    keywords: [
      'explain',
      'what is',
      'how does',
      'teach me',
      'understand',
      'difference between',
    ],
  },
];

export interface Classification {
  intent: Intent;
  entities: { topic?: string; difficulty?: string; documentScoped?: boolean };
  confidence: number;
}

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: Object.values(Intent) },
    topic: { type: 'string', description: 'the main subject/topic, if any' },
    difficulty: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', ''],
    },
    documentScoped: {
      type: 'boolean',
      description:
        'true if the question is about the user’s uploaded documents',
    },
    confidence: {
      type: 'number',
      description: '0..1 confidence in the intent',
    },
  },
  required: ['intent', 'confidence'],
} as const;

@Injectable()
export class AgentRouterService {
  constructor(private readonly ai: AiService) {}

  /** Synchronous keyword classifier (kept for callers that don't await + as fallback). */
  classifyIntent(message: string, hint?: Intent): Intent {
    if (hint) return hint;
    const text = message.toLowerCase();
    let best: { intent: Intent; score: number } = {
      intent: Intent.GeneralChat,
      score: 0,
    };
    for (const rule of RULES) {
      const score = rule.keywords.reduce(
        (s, kw) => s + (text.includes(kw) ? kw.length : 0),
        0,
      );
      if (score > best.score) best = { intent: rule.intent, score };
    }
    return best.score > 0 ? best.intent : Intent.ConceptExplanation;
  }

  /**
   * Best-effort classification: a live LLM extracts intent + entities (topic/difficulty/
   * document scope) with a confidence; on no key, low confidence, or any failure we fall
   * back to the deterministic keyword rules. Entities are threaded into agent context.
   */
  async classify(message: string, hint?: Intent): Promise<Classification> {
    if (hint) return { intent: hint, entities: {}, confidence: 1 };
    if (this.ai.isLive) {
      try {
        const raw = await this.ai.generateStructuredOutput<{
          intent: Intent;
          topic?: string;
          difficulty?: string;
          documentScoped?: boolean;
          confidence: number;
        }>(
          [
            {
              role: 'system',
              content:
                'Classify the student message into one learning intent and extract entities. ' +
                'Respond only with the JSON object.',
            },
            { role: 'user', content: message },
          ],
          CLASSIFY_SCHEMA,
          { temperature: 0 },
        );
        if (
          raw?.intent &&
          Object.values(Intent).includes(raw.intent) &&
          (raw.confidence ?? 0) >= 0.45
        ) {
          return {
            intent: raw.intent,
            entities: {
              topic: raw.topic?.trim() || undefined,
              difficulty: raw.difficulty || undefined,
              documentScoped: raw.documentScoped,
            },
            confidence: raw.confidence,
          };
        }
      } catch {
        /* fall through to keyword rules */
      }
    }
    return {
      intent: this.classifyIntent(message),
      entities: {},
      confidence: 0.5,
    };
  }

  selectAgent(intent: Intent): AgentType {
    return INTENT_AGENT_MAP[intent];
  }
}
