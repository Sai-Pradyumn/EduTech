import { Injectable } from '@nestjs/common';
import { AgentType, Intent, TutorMode } from '../../../common/enums';
import {
  AgentAction,
  AgentResponse,
  ConceptMapBlock,
  PracticeBlock,
  QuizBlock,
  StudyPlanBlock,
  VisualBlock,
  WeaknessAnalysisBlock,
} from '../../ai/types/agent.types';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';
import { LlmComposerService } from '../core/llm-composer.service';
import { ToolAugmentationService } from '../core/tool-augmentation.service';
import { personaFor } from '../prompts/personas';

/** Small topic-knowledge library so explanations/analogies feel specific, not generic. */
const TOPIC_LIBRARY: Record<string, { analogy: string; pillars: string[]; mistakes: string[] }> = {
  closure: {
    analogy: 'A closure is like a backpack a function carries — it keeps the variables it needs even after leaving the place they were created.',
    pillars: ['Lexical scope', 'Function returning a function', 'Captured variables', 'Private state'],
    mistakes: ['Assuming the variable is copied (it’s referenced)', 'Creating closures in loops with var', 'Memory leaks from long-lived closures'],
  },
  recursion: {
    analogy: 'Recursion is like Russian nesting dolls — each call opens a smaller version of the same problem until the smallest one (base case).',
    pillars: ['Base case', 'Recursive case', 'Call stack', 'Reducing the problem'],
    mistakes: ['Missing/incorrect base case', 'Not reducing toward the base case', 'Stack overflow on deep recursion'],
  },
  promise: {
    analogy: 'A Promise is a restaurant buzzer — you get a token now and it lights up later when your food (value) is ready or the order fails (rejects).',
    pillars: ['Pending/fulfilled/rejected', 'then/catch', 'async/await', 'Error propagation'],
    mistakes: ['Forgetting to return inside then', 'Unhandled rejections', 'Mixing callbacks and promises'],
  },
  'react hooks': {
    analogy: 'Hooks are like labeled drawers React opens for your component in the same order every render — that’s why order matters.',
    pillars: ['useState', 'useEffect & deps', 'Rules of hooks', 'Custom hooks'],
    mistakes: ['Conditional hooks', 'Wrong/empty dependency arrays', 'Stale closures in effects'],
  },
  sql: {
    analogy: 'A JOIN is like matching two guest lists by a shared column to see who belongs to both events.',
    pillars: ['SELECT/WHERE', 'JOINs', 'Indexes', 'Aggregation & GROUP BY'],
    mistakes: ['Cartesian joins (missing ON)', 'SELECT * everywhere', 'No indexes on filtered columns'],
  },
  'big o': {
    analogy: 'Big-O is the “speed limit sign” of an algorithm — it tells you how cost grows as input grows, ignoring small details.',
    pillars: ['Time vs space', 'Common classes (O(1)…O(n²))', 'Dominant term', 'Best/avg/worst'],
    mistakes: ['Counting constants', 'Confusing time and space', 'Ignoring hidden costs (sorting inside a loop)'],
  },
};

@Injectable()
export class TutorAgentService implements IAgent {
  readonly type = AgentType.Tutor;

  constructor(
    private readonly composer: LlmComposerService,
    private readonly toolAug: ToolAugmentationService,
  ) {}

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    const mode = (ctx.request.context?.['mode'] as TutorMode) ?? TutorMode.Explain;
    const topic = this.extractTopic(ctx.request.message);
    const know = this.lookup(topic);

    ctx.emit({ type: 'thinking', messageId: '', label: 'Loading your profile & roadmap' });
    ctx.emit({ type: 'thinking', messageId: '', label: `Reading the question in ${mode} mode` });

    // Transparency: show a tool call when we tailor to weak areas.
    const weakHit = this.matchesWeakArea(topic, ctx);
    if (weakHit) {
      ctx.emit({ type: 'tool_call', messageId: '', tool: 'weakness.analyze', label: `Tailoring to your weak area: ${weakHit}` });
      ctx.emit({ type: 'tool_result', messageId: '', tool: 'weakness.analyze', summary: `Boosting depth on ${weakHit}` });
    }

    ctx.emit({ type: 'thinking', messageId: '', label: 'Composing explanation & visual blocks' });

    // Deterministic answer is the offline fallback; the composer streams a real LLM answer
    // when a key is configured, grounded in the learner context + this topic seed.
    const fallback = this.buildAnswer(topic, mode, know, ctx);
    const seed = know
      ? `\nTopic seed — analogy: ${know.analogy}\nPillars: ${know.pillars.join(', ')}\nCommon mistakes: ${know.mistakes.join('; ')}`
      : '';
    // Actor→critic→tool: optionally pull live data (the student's notes/mastery) first.
    const toolNote = await this.toolAug.augment(ctx);
    const system = `${personaFor(AgentType.Tutor)}\nTeaching mode: ${mode}.${seed}${toolNote ? `\n\n${toolNote}` : ''}`;
    const answer = await this.composer.streamAnswer(ctx, {
      system,
      fallback,
      agentType: AgentType.Tutor,
      operation: 'tutor.explain',
      temperature: 0.5,
    });

    const visualBlocks = this.buildVisualBlocks(topic, mode, know, weakHit);
    for (const block of visualBlocks) {
      ctx.emit({ type: 'visual_block', messageId: '', block });
    }

    return {
      agentType: AgentType.Tutor,
      intent: Intent.ConceptExplanation,
      mode: 'mixed',
      answer,
      actions: this.buildActions(topic),
      visualBlocks,
      confidence: know ? 0.92 : 0.78,
      followUpQuestions: [
        `Can you give me a harder example of ${topic}?`,
        `Where is ${topic} used in real projects?`,
        `Quiz me on ${topic}.`,
      ],
      recommendedNextActions: [
        `Practice ${topic} with 3 problems`,
        ctx.roadmap ? `Continue your roadmap: ${ctx.roadmap.currentWeekFocus ?? ctx.roadmap.title}` : 'Generate a roadmap to structure your learning',
      ],
    };
  }

  private extractTopic(message: string): string {
    const cleaned = message
      .toLowerCase()
      .replace(/^(can you |please )?(explain|teach me|what is|what are|how does|help me with|tell me about)\s+/i, '')
      .replace(/[?.!]+$/, '')
      .trim();
    return cleaned || message.trim() || 'this concept';
  }

  private lookup(topic: string) {
    const key = Object.keys(TOPIC_LIBRARY).find((k) => topic.includes(k));
    return key ? TOPIC_LIBRARY[key] : null;
  }

  private matchesWeakArea(topic: string, ctx: AgentRuntimeContext): string | null {
    const weak = ctx.profile?.weakAreas ?? [];
    return weak.find((w) => topic.includes(w.toLowerCase()) || w.toLowerCase().includes(topic)) ?? null;
  }

  private buildAnswer(
    topic: string,
    mode: TutorMode,
    know: { analogy: string; pillars: string[]; mistakes: string[] } | null,
    ctx: AgentRuntimeContext,
  ): string {
    const name = ctx.profile?.fullName?.split(' ')[0];
    const greeting = name ? `${name}, ` : '';

    if (mode === TutorMode.Socratic) {
      return [
        `${greeting}let's reason through **${topic}** together — I'll guide with questions.`,
        '',
        `1. In your own words, what problem do you think **${topic}** is trying to solve?`,
        `2. Where have you seen something *similar* before?`,
        `3. If you had to explain it to a friend in one sentence, what would you say?`,
        '',
        '_Answer any one and I’ll build on it._',
      ].join('\n');
    }

    if (mode === TutorMode.Interview) {
      return [
        `**Interview drill — ${topic}**`,
        '',
        `Q: Explain ${topic} and when you'd use it.`,
        '',
        'Take a shot first. A strong answer covers: the core idea, a concrete example, trade-offs, and a common pitfall. Reply and I’ll grade it like an interviewer.',
      ].join('\n');
    }

    const analogy = know?.analogy ?? `Think of **${topic}** as a tool you reach for when a specific kind of problem shows up — let's make that concrete.`;
    const pillars = (know?.pillars ?? ['Core idea', 'How it works', 'When to use it', 'A worked example'])
      .map((p, i) => `${i + 1}. **${p}**`)
      .join('\n');
    const mistakes = (know?.mistakes ?? ['Skipping the fundamentals', 'Memorizing instead of understanding'])
      .map((m) => `- ${m}`)
      .join('\n');

    return [
      `### ${this.titleCase(topic)}`,
      '',
      `**Simple idea.** ${analogy}`,
      '',
      `**Step by step.**`,
      pillars,
      '',
      `**Common mistakes.**`,
      mistakes,
      '',
      `**Try this.** ${this.practicePrompt(topic)}`,
    ].join('\n');
  }

  private buildVisualBlocks(
    topic: string,
    mode: TutorMode,
    know: { pillars: string[] } | null,
    weakHit: string | null,
  ): VisualBlock[] {
    const blocks: VisualBlock[] = [];
    const pillars = know?.pillars ?? ['Core idea', 'How it works', 'When to use it', 'Example'];

    const conceptMap: ConceptMapBlock = {
      type: 'concept_map',
      title: `${this.titleCase(topic)} — concept map`,
      rootConcept: this.titleCase(topic),
      nodes: [
        { id: 'root', label: this.titleCase(topic), group: 'root' },
        ...pillars.map((p, i) => ({ id: `n${i}`, label: p, group: 'pillar' })),
      ],
      edges: pillars.map((_, i) => ({ from: 'root', to: `n${i}` })),
    };
    blocks.push(conceptMap);

    const studyPlan: StudyPlanBlock = {
      type: 'study_plan',
      title: `Master ${topic} in 3 sittings`,
      items: [
        { label: `Understand: ${pillars[0]}`, minutes: 20, kind: 'learn' },
        { label: `Practice: 3 problems on ${topic}`, minutes: 30, kind: 'practice' },
        { label: `Recall: explain ${topic} from memory`, minutes: 10, kind: 'revision' },
      ],
    };
    blocks.push(studyPlan);

    if (mode === TutorMode.Practice || mode === TutorMode.Exam) {
      blocks.push(this.quizBlock(topic));
    } else {
      const practice: PracticeBlock = {
        type: 'practice',
        title: 'Practice task',
        prompt: this.practicePrompt(topic),
        hint: 'Start by writing what you already know, then fill the gaps.',
      };
      blocks.push(practice);
    }

    if (weakHit) {
      const weakness: WeaknessAnalysisBlock = {
        type: 'weakness_analysis',
        title: 'Why we’re going deeper here',
        weaknesses: [{ topic: weakHit, severity: 70, note: 'Flagged in your profile — extra reps recommended.' }],
      };
      blocks.push(weakness);
    }

    return blocks;
  }

  private quizBlock(topic: string): QuizBlock {
    return {
      type: 'quiz',
      title: `Quick quiz: ${topic}`,
      questions: [
        {
          prompt: `Which statement best describes ${topic}?`,
          options: [
            `It’s a core concept used to solve a specific class of problems`,
            'It’s only relevant to advanced users',
            'It has no real-world use',
            'It’s the same as everything else',
          ],
          answerIndex: 0,
          explanation: `${this.titleCase(topic)} is a foundational tool — knowing when to apply it matters as much as the definition.`,
        },
      ],
    };
  }

  private buildActions(topic: string): AgentAction[] {
    return [
      { id: 'visual', label: 'Explain visually', kind: 'explain_visually', payload: { topic } },
      { id: 'simpler', label: 'Teach in simpler way', kind: 'simpler', payload: { topic } },
      { id: 'quiz', label: 'Give me a quiz', kind: 'generate_quiz', payload: { topic } },
      { id: 'interview', label: 'Ask as interviewer', kind: 'ask_interviewer', payload: { topic } },
      { id: 'notes', label: 'Generate notes', kind: 'generate_notes', payload: { topic } },
    ];
  }

  private practicePrompt(topic: string): string {
    return `Write a tiny example that uses ${topic}, then change one thing and predict what happens before running it.`;
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
