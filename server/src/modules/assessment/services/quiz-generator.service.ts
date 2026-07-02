import { Injectable, Logger } from '@nestjs/common';
import { AgentType, Difficulty, QuestionType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { BankQuestion, KNOWN_TOPICS, QUIZ_BANK } from '../quiz-bank';

export interface GeneratedQuestion {
  type: QuestionType;
  prompt: string;
  options: string[];
  answerIndex?: number;
  modelAnswer: string;
  keywords: string[];
  explanation: string;
  topic: string;
  difficulty: Difficulty;
  points: number;
  source?: string;
}

export interface DocChunk {
  text: string;
  headingPath?: string;
  keywords: string[];
}

const DIFF_POINTS: Record<Difficulty, number> = {
  [Difficulty.Beginner]: 1,
  [Difficulty.Intermediate]: 2,
  [Difficulty.Advanced]: 3,
};

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'is',
  'are',
  'for',
  'on',
  'with',
  'as',
  'by',
  'at',
  'be',
  'this',
  'that',
  'it',
  'from',
  'into',
  'which',
  'using',
  'used',
  'can',
]);

/** Raw AI question draft before sanitization. */
interface DraftQuestion {
  prompt?: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
}

/**
 * Builds quiz questions. Live AI writes real questions for THIS topic (or grounded
 * strictly in THIS document's excerpts); the deterministic paths — curated bank,
 * templated MCQs, cloze-from-chunks — are the offline fallback so a quiz can always
 * be generated.
 */
@Injectable()
export class QuizGeneratorService {
  private readonly logger = new Logger(QuizGeneratorService.name);

  constructor(private readonly ai: AiService) {}

  knownTopic(topic: string): boolean {
    return this.matchKey(topic) !== null;
  }

  /** Topic quiz: AI-written for this topic when live; bank/template offline. */
  async smartFromTopic(
    userId: string,
    topic: string,
    difficulty: Difficulty,
    count: number,
  ): Promise<GeneratedQuestion[]> {
    const generated = await this.aiQuestions(
      userId,
      topic,
      difficulty,
      count,
      `Write ${count} exam-quality multiple-choice questions on "${topic}" at ${difficulty} level. ` +
        'Test understanding and application, not trivia. Distractors must be plausible.',
    );
    return generated ?? this.fromTopic(topic, difficulty, count);
  }

  /** Document quiz: AI grounded ONLY in the excerpts when live; cloze offline. */
  async smartFromDocument(
    userId: string,
    topic: string,
    chunks: DocChunk[],
    difficulty: Difficulty,
    count: number,
  ): Promise<GeneratedQuestion[]> {
    const excerpts = chunks
      .map(
        (c, i) =>
          `[${i + 1}]${c.headingPath ? ` (${c.headingPath})` : ''} ${c.text}`,
      )
      .join('\n\n')
      .slice(0, 5000);
    const generated = await this.aiQuestions(
      userId,
      topic,
      difficulty,
      count,
      `Write ${count} multiple-choice questions at ${difficulty} level that are answerable ` +
        `ONLY from these excerpts of the learner's own document — never from outside knowledge:\n\n${excerpts}`,
    );
    return generated ?? this.fromDocument(topic, chunks, difficulty, count);
  }

  /** One structured call; sanitized hard; null → caller falls back. */
  private async aiQuestions(
    userId: string,
    topic: string,
    difficulty: Difficulty,
    count: number,
    instruction: string,
  ): Promise<GeneratedQuestion[] | null> {
    if (!this.ai.isLive) return null;
    try {
      const out = await this.ai.generateStructuredOutput<{
        questions: DraftQuestion[];
      }>(
        [
          {
            role: 'system',
            content:
              'You are a rigorous assessment writer. Every question has exactly 4 options, one ' +
              'correct answerIndex (0–3) and a one-sentence explanation of the correct answer.',
          },
          { role: 'user', content: instruction },
        ],
        {
          type: 'object',
          properties: {
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
                required: ['prompt', 'options', 'answerIndex'],
              },
            },
          },
          required: ['questions'],
        },
        {
          temperature: 0.4,
          meta: {
            userId,
            agentType: AgentType.Assessment,
            operation: 'quiz.questions',
          },
          mockFactory: () => ({ questions: [] }), // offline → deterministic path
        },
      );
      const usable = (out.questions ?? [])
        .filter(
          (q) =>
            q?.prompt &&
            q.prompt.trim().length >= 10 &&
            Array.isArray(q.options) &&
            q.options.filter((o) => o?.trim()).length === 4,
        )
        .slice(0, count)
        .map((q): GeneratedQuestion => {
          const answerIndex = Math.max(
            0,
            Math.min(3, Math.round(q.answerIndex ?? 0)),
          );
          const options = q.options!.map((o) => o.trim().slice(0, 160));
          return {
            type: QuestionType.Mcq,
            prompt: q.prompt!.trim().slice(0, 300),
            options,
            answerIndex,
            modelAnswer: options[answerIndex],
            keywords: this.keywords(`${q.prompt} ${options[answerIndex]}`),
            explanation: (q.explanation ?? '').trim().slice(0, 400),
            topic,
            difficulty,
            points: DIFF_POINTS[difficulty],
          };
        });
      // A degenerate generation (fewer than half usable) falls back entirely.
      return usable.length >= Math.max(1, Math.ceil(count / 2)) ? usable : null;
    } catch (err) {
      this.logger.warn(`AI quiz generation failed: ${(err as Error).message}`);
      return null;
    }
  }

  private keywords(text: string): string[] {
    return [
      ...new Set(
        (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
          (t) => t.length > 3 && !STOP.has(t),
        ),
      ),
    ].slice(0, 6);
  }

  fromTopic(
    topic: string,
    difficulty: Difficulty,
    count: number,
  ): GeneratedQuestion[] {
    const key = this.matchKey(topic);
    const curated = key ? this.fromBank(key, QUIZ_BANK[key], difficulty) : [];
    const out = [...curated];
    let i = 0;
    while (out.length < count) {
      out.push(this.templated(topic, difficulty, i++));
    }
    return out.slice(0, count);
  }

  fromDocument(
    topic: string,
    chunks: DocChunk[],
    difficulty: Difficulty,
    count: number,
  ): GeneratedQuestion[] {
    const out: GeneratedQuestion[] = [];
    const corpusKeywords = this.corpusKeywords(chunks);
    for (const chunk of chunks) {
      if (out.length >= count) break;
      const q = this.clozeFromChunk(chunk, corpusKeywords, difficulty);
      if (q) out.push(q);
    }
    // Top up with conceptual questions about the doc topic if chunks were too short.
    let i = 0;
    while (out.length < count) out.push(this.templated(topic, difficulty, i++));
    return out.slice(0, count);
  }

  // ── bank ──────────────────────────────────────────────────────────────────
  private fromBank(
    topic: string,
    bank: BankQuestion[],
    difficulty: Difficulty,
  ): GeneratedQuestion[] {
    // Prefer the requested difficulty, then fill with the rest (keeps quizzes full).
    const ordered = [...bank].sort(
      (a, b) =>
        this.diffDistance(a.difficulty, difficulty) -
        this.diffDistance(b.difficulty, difficulty),
    );
    return ordered.map((q) => this.materialize(q, topic));
  }

  private materialize(q: BankQuestion, topic: string): GeneratedQuestion {
    return {
      type: q.type,
      prompt: q.prompt,
      options: q.options ?? [],
      answerIndex: q.answerIndex,
      modelAnswer: q.modelAnswer ?? '',
      keywords: q.keywords ?? [],
      explanation: q.explanation,
      topic,
      difficulty: q.difficulty,
      points: DIFF_POINTS[q.difficulty],
    };
  }

  // ── templated (generic) ─────────────────────────────────────────────────────
  private templated(
    topic: string,
    difficulty: Difficulty,
    seed: number,
  ): GeneratedQuestion {
    const t = this.titleCase(topic);
    const templates = [
      {
        prompt: `Which statement best reflects a correct understanding of ${t}?`,
        options: [
          `${t} is a core concept applied to solve a specific class of problems`,
          `${t} is only relevant to advanced specialists`,
          `${t} has no practical applications`,
          `${t} is interchangeable with every other concept`,
        ],
        explanation: `${t} is a foundational idea — knowing when and why to apply it matters as much as the definition.`,
      },
      {
        prompt: `When learning ${t}, which approach builds the strongest understanding?`,
        options: [
          `Work a concrete example, then explain it in your own words`,
          `Memorize the definition only`,
          `Skip the fundamentals and copy solutions`,
          `Avoid practice problems`,
        ],
        explanation: `Active recall + worked examples beat passive memorization for ${t}.`,
      },
      {
        prompt: `A common mistake when applying ${t} is to…`,
        options: [
          `Use it without understanding the trade-offs`,
          `Always read the documentation`,
          `Test edge cases`,
          `Start from a simple example`,
        ],
        explanation: `Applying ${t} blindly — ignoring its trade-offs and edge cases — is the usual pitfall.`,
      },
    ];
    const tpl = templates[seed % templates.length];
    return {
      type: QuestionType.Mcq,
      prompt: tpl.prompt,
      options: tpl.options,
      answerIndex: 0,
      modelAnswer: '',
      keywords: [],
      explanation: tpl.explanation,
      topic,
      difficulty,
      points: DIFF_POINTS[difficulty],
    };
  }

  // ── cloze from a document chunk ─────────────────────────────────────────────
  private clozeFromChunk(
    chunk: DocChunk,
    corpusKeywords: string[],
    difficulty: Difficulty,
  ): GeneratedQuestion | null {
    const sentence = this.pickSentence(chunk.text);
    if (!sentence) return null;
    const target = this.salientTerm(sentence, chunk.keywords);
    if (!target) return null;

    const blanked = sentence.replace(
      new RegExp(`\\b${this.escape(target)}\\b`, 'i'),
      '_____',
    );
    const distractors = corpusKeywords
      .filter((k) => k.toLowerCase() !== target.toLowerCase())
      .slice(0, 3)
      .map((k) => this.titleCase(k));
    if (distractors.length < 3) return null;

    const options = this.placeAnswer(
      [this.titleCase(target), ...distractors],
      chunk.text.length,
    );
    return {
      type: QuestionType.Mcq,
      prompt: `Fill in the blank (from your document):\n\n"${blanked}"`,
      options,
      answerIndex: options.findIndex(
        (o) => o.toLowerCase() === target.toLowerCase(),
      ),
      modelAnswer: target,
      keywords: [target],
      explanation: `From the source: "${this.trim(sentence, 160)}"`,
      topic: this.titleCase(chunk.keywords[0] ?? 'document'),
      difficulty,
      points: DIFF_POINTS[difficulty],
      source: chunk.headingPath,
    };
  }

  private pickSentence(text: string): string | null {
    const sentences = text
      .replace(/\s+/g, ' ')
      .replace(/^…\s*/, '')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(
        (s) => s.length > 30 && s.length < 220 && this.terms(s).length >= 5,
      );
    return sentences[0] ?? null;
  }

  private salientTerm(sentence: string, keywords: string[]): string | null {
    const terms = this.terms(sentence);
    // Prefer a chunk keyword that appears in the sentence; else the longest content word.
    const kw = keywords.find((k) => terms.includes(k.toLowerCase()));
    if (kw) return kw;
    const longest = terms
      .filter((t) => t.length >= 5)
      .sort((a, b) => b.length - a.length)[0];
    return longest ?? null;
  }

  private corpusKeywords(chunks: DocChunk[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of chunks) {
      for (const k of c.keywords) {
        const key = k.toLowerCase();
        if (!seen.has(key) && key.length >= 4) {
          seen.add(key);
          out.push(k);
        }
      }
    }
    return out;
  }

  /** Deterministic answer placement (rotates by a stable seed) to avoid always-A. */
  private placeAnswer(opts: string[], seed: number): string[] {
    const idx = seed % opts.length;
    const rotated = [...opts];
    const [answer] = rotated.splice(0, 1);
    rotated.splice(idx, 0, answer);
    return rotated;
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private matchKey(topic: string): string | null {
    const t = topic.toLowerCase();
    return KNOWN_TOPICS.find((k) => t.includes(k) || k.includes(t)) ?? null;
  }
  private diffDistance(a: Difficulty, b: Difficulty): number {
    const order = [
      Difficulty.Beginner,
      Difficulty.Intermediate,
      Difficulty.Advanced,
    ];
    return Math.abs(order.indexOf(a) - order.indexOf(b));
  }
  private terms(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (t) => t.length > 2 && !STOP.has(t),
    );
  }
  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  private trim(s: string, n: number): string {
    return s.length > n ? `${s.slice(0, n)}…` : s;
  }
  private escape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
