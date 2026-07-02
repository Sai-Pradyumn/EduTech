import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import {
  ConceptMapBlock,
  QuizBlock,
  StudyPlanBlock,
  VisualBlock,
} from '../../ai/types/agent.types';

/** What the model returns: a decision + (optionally) one grounded visual. */
interface VisualDraft {
  kind: 'none' | 'concept_map' | 'study_plan' | 'quiz';
  title?: string;
  nodes?: { id?: string; label?: string; group?: string }[];
  edges?: { from?: string; to?: string; label?: string }[];
  items?: { label?: string; minutes?: number; kind?: string }[];
  questions?: {
    prompt?: string;
    options?: string[];
    answerIndex?: number;
    explanation?: string;
  }[];
}

const MAX_NODES = 12;
const MAX_EDGES = 16;
const MAX_ITEMS = 6;
const MAX_QUESTIONS = 3;
const MAX_LABEL = 70;
const MAX_TITLE = 80;

/**
 * Visual intelligence for agent answers. A visual must (a) be generated FROM the
 * answer that was actually written — never a topic template — and (b) appear only
 * when it genuinely helps. Live: one structured call reads the question + answer
 * and either declines ("none") or produces one grounded visual; the result is
 * sanitized hard (counts, lengths, edge refs). Offline (and as the live path's
 * degenerate fallback): the visual is derived from the answer's own markdown
 * structure — headings/steps/bullets become nodes — and an unstructured or
 * non-explanatory answer gets NO visual rather than a canned one.
 */
@Injectable()
export class VisualComposerService {
  private readonly logger = new Logger(VisualComposerService.name);

  constructor(private readonly ai: AiService) {}

  async compose(
    question: string,
    answer: string,
    opts: { topic?: string; agentType: AgentType; userId?: string },
  ): Promise<VisualBlock[]> {
    const derived = this.deriveFromAnswer(question, answer, opts.topic);
    if (!this.ai.isLive) return derived;

    try {
      const draft = await this.ai.generateStructuredOutput<VisualDraft>(
        [
          {
            role: 'system',
            content:
              'You decide whether an answer benefits from ONE visual aid, and if so you build it ' +
              'STRICTLY from the answer content (never invent new material). Choose kind "none" ' +
              'unless a visual genuinely helps: "concept_map" when the answer explains a concept ' +
              'with distinct parts/relationships; "study_plan" when it lays out steps to learn or ' +
              'do something over time; "quiz" when the user is practicing or asked to be tested. ' +
              'Small talk, opinions, one-liners, errors and status replies get "none".',
          },
          {
            role: 'user',
            content: `Question:\n${question}\n\nAnswer:\n${answer.slice(0, 4000)}`,
          },
        ],
        {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['none', 'concept_map', 'study_plan', 'quiz'],
            },
            title: { type: 'string' },
            nodes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  label: { type: 'string' },
                  group: { type: 'string' },
                },
              },
            },
            edges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  label: { type: 'string' },
                },
              },
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  minutes: { type: 'number' },
                  kind: { type: 'string' },
                },
              },
            },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  prompt: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                  answerIndex: { type: 'number' },
                  explanation: { type: 'string' },
                },
              },
            },
          },
          required: ['kind'],
        },
        {
          temperature: 0.2,
          meta: {
            userId: opts.userId,
            agentType: opts.agentType,
            operation: 'visual.compose',
          },
          // Mock mode answers honestly with the structural derivation.
          mockFactory: (): VisualDraft => ({ kind: 'none' }),
        },
      );
      const block = this.sanitize(draft, opts.topic);
      if (block) return [block];
      // The model declined ("none") — respect it; a generation that failed
      // sanitization falls back to the structural derivation instead.
      return draft?.kind === 'none' ? [] : derived;
    } catch (err) {
      this.logger.warn(`Visual compose failed: ${(err as Error).message}`);
      return derived;
    }
  }

  // ───────────────────── sanitization (live path) ─────────────────────

  private sanitize(draft: VisualDraft, topic?: string): VisualBlock | null {
    if (!draft || draft.kind === 'none') return null;
    const title = this.trim(draft.title, MAX_TITLE) || this.trim(topic, MAX_TITLE) || 'Overview';

    if (draft.kind === 'concept_map') {
      const nodes = (draft.nodes ?? [])
        .filter((n) => n?.label?.trim())
        .slice(0, MAX_NODES)
        .map((n, i) => ({
          id: this.trim(n.id, 24) || `n${i}`,
          label: this.trim(n.label, MAX_LABEL)!,
          group: this.trim(n.group, 24) || 'concept',
        }));
      if (nodes.length < 3) return null;
      const ids = new Set(nodes.map((n) => n.id));
      const edges = (draft.edges ?? [])
        .filter((e) => e?.from && e?.to && ids.has(e.from) && ids.has(e.to))
        .slice(0, MAX_EDGES)
        .map((e) => ({
          from: e.from!,
          to: e.to!,
          ...(e.label ? { label: this.trim(e.label, 40)! } : {}),
        }));
      // A map with no valid relationships isn't a map.
      if (edges.length === 0) return null;
      return {
        type: 'concept_map',
        title,
        rootConcept: nodes[0].label,
        nodes,
        edges,
      } satisfies ConceptMapBlock;
    }

    if (draft.kind === 'study_plan') {
      const items = (draft.items ?? [])
        .filter((i) => i?.label?.trim())
        .slice(0, MAX_ITEMS)
        .map((i) => ({
          label: this.trim(i.label, MAX_LABEL)!,
          minutes: this.clampInt(i.minutes, 5, 120, 20),
          kind: ['learn', 'practice', 'revision'].includes(i.kind ?? '')
            ? (i.kind as 'learn' | 'practice' | 'revision')
            : 'learn',
        }));
      if (items.length < 2) return null;
      return { type: 'study_plan', title, items } satisfies StudyPlanBlock;
    }

    if (draft.kind === 'quiz') {
      const questions = (draft.questions ?? [])
        .filter(
          (q) =>
            q?.prompt?.trim() &&
            Array.isArray(q.options) &&
            q.options.filter((o) => o?.trim()).length === 4,
        )
        .slice(0, MAX_QUESTIONS)
        .map((q) => ({
          prompt: this.trim(q.prompt, 200)!,
          options: q.options!.map((o) => this.trim(o, 120)!),
          answerIndex: this.clampInt(q.answerIndex, 0, 3, 0),
          explanation: this.trim(q.explanation, 300) ?? '',
        }));
      if (questions.length === 0) return null;
      return { type: 'quiz', title, questions } satisfies QuizBlock;
    }

    return null;
  }

  // ─────────────── structural derivation (offline path) ───────────────

  /**
   * Builds a concept map from the answer's OWN structure. Dynamic per response
   * (the nodes are this answer's actual sections), and empty when the answer
   * has no structure or the question doesn't call for a visual.
   */
  private deriveFromAnswer(
    question: string,
    answer: string,
    topic?: string,
  ): VisualBlock[] {
    if (!this.wantsVisual(question)) return [];

    const sections: string[] = [];
    for (const line of answer.split('\n')) {
      const heading = /^#{2,4}\s+(.{3,80})$/.exec(line.trim());
      const numbered = /^\d+\.\s+(.{3,90})$/.exec(line.trim());
      const bullet = /^[-*]\s+(.{3,90})$/.exec(line.trim());
      const text = (heading ?? numbered ?? bullet)?.[1];
      if (text) sections.push(this.stripMd(text));
    }
    const unique = [...new Set(sections)].slice(0, 8);
    if (unique.length < 3) return [];

    const root = this.trim(topic, MAX_LABEL) || 'This answer';
    const nodes = [
      { id: 'root', label: this.titleCase(root), group: 'root' },
      ...unique.map((label, i) => ({
        id: `n${i}`,
        label: this.trim(label, MAX_LABEL)!,
        group: 'concept',
      })),
    ];
    return [
      {
        type: 'concept_map',
        title: `${this.titleCase(root)} — mapped from this answer`,
        rootConcept: this.titleCase(root),
        nodes,
        edges: unique.map((_, i) => ({ from: 'root', to: `n${i}` })),
      } satisfies ConceptMapBlock,
    ];
  }

  /** Only explanatory/process/compare questions warrant a diagram. */
  private wantsVisual(question: string): boolean {
    return /\b(explain|how|what|why|difference|vs\.?|versus|compare|steps?|process|architecture|design|structure|work(s|ing)?|overview|breakdown|roadmap|plan)\b/i.test(
      question,
    );
  }

  private stripMd(s: string): string {
    return s
      .replace(/\*\*|__|`|\*|_/g, '')
      .replace(/\[(.+?)\]\(.*?\)/g, '$1')
      .replace(/[.:]+$/, '')
      .trim();
  }

  private trim(s: string | undefined, max: number): string | undefined {
    const t = s?.trim();
    if (!t) return undefined;
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  }

  private clampInt(
    n: number | undefined,
    min: number,
    max: number,
    dflt: number,
  ): number {
    if (typeof n !== 'number' || !Number.isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  private titleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
