import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { AgentType } from '../../../common/enums';
import { HybridRetrieverService } from '../../rag/vector/hybrid-retriever.service';
import { ChunkHit } from '../../rag/vector/vector-store.interface';
import { StudentProfileService } from '../../student-profile/student-profile.service';
import { ContextEngineService } from './context-engine.service';

/**
 * Hermetic spec for the Context Engine: fake mongoose models, no DB. Verifies the
 * contract the app depends on — per-query relevance, token budgeting, snapshot
 * caching + invalidation, and per-source failure isolation.
 */

type Doc = Record<string, unknown>;

/** Chainable fake for `.find().sort().limit().lean().exec()` (+ findOne). */
function fakeModel(docs: Doc[] | Doc | null, opts?: { fail?: boolean }) {
  const exec = jest.fn(() =>
    opts?.fail
      ? Promise.reject(new Error('source down'))
      : Promise.resolve(docs),
  );
  const chain: Record<string, unknown> = { exec };
  for (const m of ['sort', 'limit', 'lean']) chain[m] = jest.fn(() => chain);
  return {
    find: jest.fn(() => chain),
    findOne: jest.fn(() => chain),
    exec,
  } as unknown as Model<never> & { find: jest.Mock; findOne: jest.Mock };
}

const VALID_ID = '507f1f77bcf86cd799439011';

function build(over: Partial<Record<string, unknown>> = {}) {
  const profiles = {
    findByUser: jest.fn().mockResolvedValue({ fullName: 'Demo Student' }),
  } as unknown as StudentProfileService;

  const roadmaps = fakeModel(null);
  const memories = fakeModel(
    (over.memories as Doc[]) ?? [
      { kind: 'preference', content: 'prefers visual explanations', weight: 5 },
      {
        kind: 'fact',
        content: 'is preparing for campus placements',
        weight: 3,
      },
    ],
  );
  const mistakes = fakeModel(
    (over.mistakes as Doc[]) ?? [
      {
        concept: 'recursion base cases',
        topic: 'DSA',
        mistakeType: 'misconception',
        severity: 80,
        frequency: 3,
        correction: 'trace the call stack by hand',
      },
      {
        concept: 'CSS flexbox alignment',
        topic: 'frontend',
        mistakeType: 'weak_recall',
        severity: 40,
        frequency: 1,
        correction: '',
      },
    ],
  );
  const twins = fakeModel(
    (over.twins as Doc) ?? {
      readiness: 62,
      health: 71,
      retentionRisk: 30,
      burnoutRisk: 20,
      pace: 'steady',
    },
  );
  const plans = fakeModel(
    (over.plans as Doc) ?? {
      date: new Date().toISOString().slice(0, 10),
      mode: 'normal',
      items: [
        {
          title: 'Revise recursion',
          kind: 'revision',
          done: false,
          estimateMinutes: 20,
          reason: 'weak area',
        },
        {
          title: 'Quiz: arrays',
          kind: 'quiz',
          done: true,
          estimateMinutes: 10,
        },
      ],
    },
  );
  const courses = fakeModel(
    (over.courses as Doc[]) ?? [
      {
        title: 'Intro to TypeScript',
        status: 'draft',
        modules: [{}, {}],
        goal: 'learn TS',
      },
    ],
  );

  const retriever = {
    retrieve: jest
      .fn()
      .mockResolvedValue((over.knowledgeHits as ChunkHit[]) ?? []),
  } as unknown as HybridRetrieverService & { retrieve: jest.Mock };

  const engine = new ContextEngineService(
    profiles,
    roadmaps as never,
    (over.memoriesModel as never) ?? (memories as never),
    (over.mistakesModel as never) ?? (mistakes as never),
    twins as never,
    plans as never,
    courses as never,
    (over.retriever as never) ?? retriever,
  );
  return {
    engine,
    profiles,
    memories,
    mistakes,
    twins,
    plans,
    courses,
    retriever,
  };
}

describe('ContextEngineService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('aggregates every signal into query-relevant facts', async () => {
    const { engine } = build();
    const ctx = await engine.load(VALID_ID, 'why does recursion confuse me?');
    const sources = new Set(ctx.facts.map((f) => f.source));
    expect(ctx.profile).toBeTruthy();
    expect(sources.has('mistake')).toBe(true);
    // The recursion mistake must outrank the flexbox one for a recursion question.
    const mistakeTexts = ctx.facts
      .filter((f) => f.source === 'mistake')
      .map((f) => f.text);
    expect(mistakeTexts[0]).toContain('recursion');
  });

  it('surfaces the plan when the learner asks what to do today', async () => {
    const { engine } = build();
    const ctx = await engine.load(VALID_ID, 'what should I do today?');
    const planFacts = ctx.facts.filter((f) => f.source === 'plan');
    expect(planFacts.length).toBeGreaterThan(0);
    expect(planFacts.some((f) => f.text.includes("Today's plan"))).toBe(true);
  });

  it('agent affinity nudges relevant sources up (doubt solver → mistakes)', async () => {
    const { engine } = build();
    const ctx = await engine.load(VALID_ID, 'help', AgentType.DoubtSolver);
    expect(ctx.facts.some((f) => f.source === 'mistake')).toBe(true);
  });

  it('respects the fact cap (never floods the prompt)', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      kind: 'fact',
      content: `long-lived learner fact number ${i} with some extra words`,
      weight: 60 - i,
    }));
    const { engine } = build({ memories: many });
    const ctx = await engine.load(VALID_ID, 'tell me about learner facts');
    expect(ctx.facts.length).toBeLessThanOrEqual(14);
  });

  it('caches the snapshot per user (warm loads hit no sources)', async () => {
    const { engine, mistakes } = build();
    await engine.load(VALID_ID, 'first');
    await engine.load(VALID_ID, 'second, different query');
    expect(mistakes.find).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces a re-aggregation (progression events call this)', async () => {
    const { engine, mistakes } = build();
    await engine.load(VALID_ID, 'first');
    engine.onProgression({ userId: VALID_ID });
    await engine.load(VALID_ID, 'after event');
    expect(mistakes.find).toHaveBeenCalledTimes(2);
  });

  it('one failing source degrades to nothing — never a failed turn', async () => {
    const broken = fakeModel(null, { fail: true });
    const { engine } = build({ mistakesModel: broken });
    const ctx = await engine.load(VALID_ID, 'why does recursion confuse me?');
    expect(ctx.profile).toBeTruthy();
    expect(ctx.facts.some((f) => f.source === 'memory')).toBe(true);
    expect(ctx.facts.some((f) => f.source === 'mistake')).toBe(false);
  });

  it('fuses RAG hits from the learner corpus as cited knowledge facts', async () => {
    const hits: Partial<ChunkHit>[] = [
      {
        chunkId: 'c1',
        documentId: 'd1',
        documentTitle: 'My DBMS notes',
        headingPath: 'Normalization',
        text: 'Third normal form removes transitive dependencies between non-key attributes.',
        score: 0.8,
      },
    ];
    const { engine, retriever } = build({ knowledgeHits: hits });
    const ctx = await engine.load(VALID_ID, 'explain third normal form');
    expect(retriever.retrieve).toHaveBeenCalledWith(
      'explain third normal form',
      { userId: VALID_ID },
      expect.any(Number),
    );
    const knowledge = ctx.facts.filter((f) => f.source === 'knowledge');
    expect(knowledge.length).toBe(1);
    expect(knowledge[0].text).toContain('My DBMS notes');
    expect(knowledge[0].text).toContain('transitive dependencies');
  });

  it('retrieval is per-turn — the snapshot cache never serves stale knowledge', async () => {
    const { engine, retriever } = build();
    await engine.load(VALID_ID, 'first question');
    await engine.load(VALID_ID, 'second question');
    // Snapshot sources were cached (1 fetch), but retrieval ran for each turn.
    expect(retriever.retrieve).toHaveBeenCalledTimes(2);
  });

  it('a broken retriever degrades to no knowledge facts, never a failed turn', async () => {
    const broken = {
      retrieve: jest.fn().mockRejectedValue(new Error('vector store down')),
    };
    const { engine } = build({ retriever: broken });
    const ctx = await engine.load(VALID_ID, 'explain recursion');
    expect(ctx.facts.length).toBeGreaterThan(0);
    expect(ctx.facts.some((f) => f.source === 'knowledge')).toBe(false);
  });

  it('keeps the back-compat memories view (kind parsed out)', async () => {
    const { engine } = build();
    const ctx = await engine.load(VALID_ID, 'visual explanations placements');
    expect(ctx.memories.length).toBeGreaterThan(0);
    expect(typeof ctx.memories[0].kind).toBe('string');
    expect(typeof ctx.memories[0].content).toBe('string');
    expect(ctx.memories[0].content).not.toMatch(/^\(/);
  });
});
