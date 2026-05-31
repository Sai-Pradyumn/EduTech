import { Injectable } from '@nestjs/common';
import { Difficulty, QuestionType } from '../../../common/enums';
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

/**
 * Builds quiz questions deterministically (no AI key needed): curated bank for known
 * topics, templated conceptual MCQs for any topic, and cloze MCQs grounded in document
 * chunks for document-source quizzes.
 */
@Injectable()
export class QuizGeneratorService {
  knownTopic(topic: string): boolean {
    return this.matchKey(topic) !== null;
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
