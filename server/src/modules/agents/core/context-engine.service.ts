import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType, RoadmapStatus } from '../../../common/enums';
import { estimateTokens } from '../../ai/gateway/pricing';
import {
  Course,
  CourseDocument,
} from '../../course-builder/schemas/course.schema';
import {
  DailyPlan,
  DailyPlanDocument,
} from '../../daily-plan/schemas/daily-plan.schema';
import {
  Mistake,
  MistakeDocument,
} from '../../mistakes/schemas/mistake.schema';
import { PROGRESSION_EVENTS } from '../../progression/progression.events';
import { Roadmap, RoadmapDocument } from '../../roadmap/schemas/roadmap.schema';
import {
  SkillTwinSnapshot,
  SkillTwinSnapshotDocument,
} from '../../skill-twin/schemas/skill-twin-snapshot.schema';
import { HybridRetrieverService } from '../../rag/vector/hybrid-retriever.service';
import { StudentProfileService } from '../../student-profile/student-profile.service';
import { StudentProfileDocument } from '../../student-profile/schemas/student-profile.schema';
import {
  AgentMemory,
  AgentMemoryDocument,
} from '../schemas/agent-memory.schema';
import { MemoryItem, RoadmapContext } from './agent.interface';

/** One selectable piece of learner context, scored per query at selection time. */
export interface ContextFact {
  source:
    | 'memory'
    | 'mistake'
    | 'mastery'
    | 'plan'
    | 'course'
    | 'knowledge'
    | 'path';
  text: string;
  /** Query-independent importance in [0,1] (severity, weight, recency…). */
  salience: number;
}

/** A cached, full aggregation of everything the app knows about one learner. */
interface UserSnapshot {
  at: number;
  profile: StudentProfileDocument | null;
  roadmap: RoadmapContext | null;
  facts: (ContextFact & { terms: Set<string> })[];
}

export interface EngineContext {
  profile: StudentProfileDocument | null;
  roadmap: RoadmapContext | null;
  /** Query-relevant facts, highest score first, within the token budget. */
  facts: ContextFact[];
  /** Back-compat view of the selected memory facts. */
  memories: MemoryItem[];
}

const SNAPSHOT_TTL_MS = 60_000;
const MAX_CACHED_USERS = 500;
const SOURCE_TIMEOUT_MS = 1_500;
/** Hard cap on the prompt space the facts block may take. */
const FACT_TOKEN_BUDGET = 640;
const MAX_FACTS = 14;
/** Facts every turn gets even with zero lexical overlap (top salience). */
const MIN_FACTS = 6;
/** Per-turn semantic retrieval over the learner's documents (tier 2). */
const KNOWLEDGE_TOP_K = 4;
const KNOWLEDGE_MAX_FACTS = 3;
const KNOWLEDGE_SNIPPET_CHARS = 300;

/** Which sources matter most to each agent (light nudge, not a filter). */
const AGENT_AFFINITY: Partial<Record<AgentType, ContextFact['source'][]>> = {
  [AgentType.DoubtSolver]: ['mistake', 'memory', 'knowledge'],
  [AgentType.Assessment]: ['mistake', 'mastery'],
  [AgentType.Career]: ['mastery', 'course', 'path'],
  [AgentType.Mentor]: ['plan', 'mastery', 'mistake', 'path'],
  [AgentType.Tutor]: ['mistake', 'course', 'knowledge'],
  [AgentType.ContentCreator]: ['course', 'knowledge'],
  [AgentType.Rag]: ['knowledge', 'memory'],
  [AgentType.Roadmap]: ['plan', 'mastery', 'path'],
};

/**
 * Context Engine — "what do we know about this learner, and what of it matters to
 * THIS message?"
 *
 * Optimisation model: fetch-once, select-per-turn. One parallel aggregation of every
 * personalization signal (profile, roadmap, memories, open mistakes, skill twin,
 * daily plan, courses) is cached per user for a short TTL, so warm agent turns cost
 * zero context queries. Selection then runs entirely in memory: every signal is a
 * scored fact (lexical overlap with the query × salience × agent affinity) and the
 * winners fill a fixed token budget. Progression events invalidate the cache so
 * fresh activity (a graded quiz, a completed week) shows up immediately.
 */
@Injectable()
export class ContextEngineService {
  private readonly logger = new Logger(ContextEngineService.name);
  private readonly cache = new Map<string, UserSnapshot>();

  constructor(
    private readonly profiles: StudentProfileService,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    @InjectModel(AgentMemory.name)
    private readonly memories: Model<AgentMemoryDocument>,
    @InjectModel(Mistake.name)
    private readonly mistakes: Model<MistakeDocument>,
    @InjectModel(SkillTwinSnapshot.name)
    private readonly twins: Model<SkillTwinSnapshotDocument>,
    @InjectModel(DailyPlan.name)
    private readonly plans: Model<DailyPlanDocument>,
    @InjectModel(Course.name) private readonly courses: Model<CourseDocument>,
    private readonly retriever: HybridRetrieverService,
  ) {}

  // ───────────────────────── public API ─────────────────────────

  async load(
    userId: string,
    query?: string,
    agentType?: AgentType,
  ): Promise<EngineContext> {
    // Tier 1 (cached activity snapshot) and tier 2 (per-turn semantic retrieval over
    // the learner's documents — relevance depends on the query, so never cached) run
    // in parallel, then fuse into one scored pool.
    const [snapshot, knowledge] = await Promise.all([
      this.snapshot(userId),
      this.guard('knowledge', () => this.fetchKnowledge(userId, query), []),
    ]);
    const pool = knowledge.length
      ? {
          ...snapshot,
          facts: [
            ...snapshot.facts,
            ...knowledge.map((f) => ({
              ...f,
              terms: new Set(this.tokenize(f.text)),
            })),
          ],
        }
      : snapshot;
    const selected = this.select(pool, query, agentType);
    return {
      profile: snapshot.profile,
      roadmap: snapshot.roadmap,
      facts: selected.map(({ source, text, salience }) => ({
        source,
        text,
        salience,
      })),
      memories: selected
        .filter((f) => f.source === 'memory')
        .map((f) => this.toMemoryItem(f.text)),
    };
  }

  /** Drop a user's snapshot so the next turn re-aggregates. */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  // Fresh activity should be visible on the very next agent turn. (The emitter
  // runs without wildcards, so each progression event is bound explicitly.)
  @OnEvent(PROGRESSION_EVENTS.quizGraded)
  @OnEvent(PROGRESSION_EVENTS.weekCompleted)
  @OnEvent(PROGRESSION_EVENTS.projectSubmitted)
  @OnEvent(PROGRESSION_EVENTS.flowRepairCompleted)
  onProgression(payload: { userId?: string }): void {
    if (payload?.userId) this.invalidate(payload.userId);
  }

  // ───────────────────────── aggregation (cached) ─────────────────────────

  private async snapshot(userId: string): Promise<UserSnapshot> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < SNAPSHOT_TTL_MS) return hit;

    const [profile, roadmap, memory, mistake, mastery, plan, course] =
      await Promise.all([
        this.guard('profile', () => this.profiles.findByUser(userId), null),
        this.guard('roadmap', () => this.fetchRoadmap(userId), null),
        this.guard('memories', () => this.fetchMemories(userId), []),
        this.guard('mistakes', () => this.fetchMistakes(userId), []),
        this.guard('mastery', () => this.fetchMastery(userId), []),
        this.guard('plan', () => this.fetchPlan(userId), []),
        this.guard('courses', () => this.fetchCourses(userId), []),
      ]);

    const path = this.pathFacts(profile, roadmap, mistake);
    const snapshot: UserSnapshot = {
      at: Date.now(),
      profile,
      roadmap,
      facts: [
        ...memory,
        ...mistake,
        ...mastery,
        ...plan,
        ...course,
        ...path,
      ].map((f) => ({ ...f, terms: new Set(this.tokenize(f.text)) })),
    };

    this.cache.set(userId, snapshot);
    // Simple LRU-ish bound: Maps iterate in insertion order, oldest first.
    if (this.cache.size > MAX_CACHED_USERS) {
      for (const oldest of this.cache.keys()) {
        this.cache.delete(oldest);
        break;
      }
    }
    return snapshot;
  }

  /** One source failing or stalling degrades to "no facts", never a failed turn. */
  private async guard<T>(
    name: string,
    fetch: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await Promise.race([
        fetch(),
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`context source "${name}" timed out`)),
            SOURCE_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (err) {
      this.logger.warn(
        `Context source "${name}" skipped: ${(err as Error).message}`,
      );
      return fallback;
    }
  }

  private async fetchRoadmap(userId: string): Promise<RoadmapContext | null> {
    const active = await this.roadmaps
      .findOne({
        user: new Types.ObjectId(userId),
        status: RoadmapStatus.Active,
      })
      .sort({ updatedAt: -1 })
      .exec();
    if (!active) return null;
    const currentWeek = active.weeklyPlan.find(
      (w) => !active.completedWeeks.includes(w.weekNumber),
    );
    return {
      id: active.id as string,
      title: active.title,
      goal: active.goal,
      progressPercentage: active.progressPercentage,
      currentWeekFocus: currentWeek?.focus,
      totalWeeks: active.weeklyPlan.length,
    };
  }

  private async fetchMemories(userId: string): Promise<ContextFact[]> {
    const docs = await this.memories
      .find({ user: new Types.ObjectId(userId) })
      .sort({ weight: -1, updatedAt: -1 })
      .limit(40)
      .lean()
      .exec();
    const maxWeight = Math.max(1, ...docs.map((d) => d.weight ?? 1));
    return docs.map((d) => ({
      source: 'memory' as const,
      text: `(${d.kind}) ${d.content}`,
      salience: 0.35 + 0.45 * ((d.weight ?? 1) / maxWeight),
    }));
  }

  private async fetchMistakes(userId: string): Promise<ContextFact[]> {
    const docs = await this.mistakes
      .find({ user: new Types.ObjectId(userId), status: { $ne: 'resolved' } })
      .sort({ severity: -1, frequency: -1 })
      .limit(12)
      .lean()
      .exec();
    return docs.map((d) => ({
      source: 'mistake' as const,
      text:
        `Struggles with "${d.concept}"${d.topic ? ` (${d.topic})` : ''} — ` +
        `${String(d.mistakeType).replace(/_/g, ' ')}, severity ${d.severity}/100, seen ${d.frequency}×` +
        (d.correction ? `. Fix: ${d.correction}` : ''),
      salience: 0.3 + 0.6 * ((d.severity ?? 50) / 100),
    }));
  }

  private async fetchMastery(userId: string): Promise<ContextFact[]> {
    const snap = await this.twins
      .findOne({ user: new Types.ObjectId(userId) })
      .sort({ at: -1 })
      .lean()
      .exec();
    if (!snap) return [];
    return [
      {
        source: 'mastery' as const,
        text:
          `Skill twin: readiness ${snap.readiness}/100, learning health ${snap.health}/100, ` +
          `retention risk ${snap.retentionRisk}/100, burnout risk ${snap.burnoutRisk}/100, pace "${snap.pace}". ` +
          'Signals for interview readiness, progress and workload questions.',
        salience: 0.55,
      },
    ];
  }

  private async fetchPlan(userId: string): Promise<ContextFact[]> {
    const plan = await this.plans
      .findOne({ user: new Types.ObjectId(userId) })
      .sort({ date: -1 })
      .lean()
      .exec();
    if (!plan) return [];
    const isToday = plan.date === new Date().toISOString().slice(0, 10);
    const open = plan.items.filter((i) => !i.done).slice(0, 5);
    const done = plan.items.length - plan.items.filter((i) => !i.done).length;
    const label = isToday ? "Today's plan" : `Last plan (${plan.date})`;
    const facts: ContextFact[] = [
      {
        source: 'plan' as const,
        text: `${label}: ${done}/${plan.items.length} items done, mode "${plan.mode}".`,
        salience: isToday ? 0.6 : 0.35,
      },
    ];
    for (const item of open) {
      facts.push({
        source: 'plan' as const,
        text: `${label} → pending: "${item.title}" (${item.kind.replace(/_/g, ' ')}, ~${item.estimateMinutes}m)${item.reason ? ` — ${item.reason}` : ''}`,
        salience: isToday ? 0.5 : 0.3,
      });
    }
    return facts;
  }

  /**
   * Tier-2 source: hybrid semantic retrieval (dense embeddings + keyword RRF +
   * rerank) over everything the learner has uploaded to their knowledge base.
   * Real corpus data with provenance — grounded in their documents, not templates.
   */
  private async fetchKnowledge(
    userId: string,
    query?: string,
  ): Promise<ContextFact[]> {
    if (!query || this.tokenize(query).length === 0) return [];
    const hits = await this.retriever.retrieve(
      query,
      { userId },
      KNOWLEDGE_TOP_K,
    );
    return hits
      .filter((h) => h.score > 0)
      .slice(0, KNOWLEDGE_MAX_FACTS)
      .map((h) => {
        const snippet =
          h.text.length > KNOWLEDGE_SNIPPET_CHARS
            ? `${h.text.slice(0, KNOWLEDGE_SNIPPET_CHARS)}…`
            : h.text;
        return {
          source: 'knowledge' as const,
          text: `From their document "${h.documentTitle}"${h.headingPath ? ` › ${h.headingPath}` : ''}: ${snippet}`,
          salience: 0.35 + 0.5 * Math.min(1, h.score),
        };
      });
  }

  /**
   * Forward-guidance facts so every agent can recommend the learner's next step
   * without extra queries: derived from signals the snapshot already fetched.
   */
  private pathFacts(
    profile: StudentProfileDocument | null,
    roadmap: RoadmapContext | null,
    mistakes: ContextFact[],
  ): ContextFact[] {
    const facts: ContextFact[] = [];
    if (roadmap?.currentWeekFocus) {
      facts.push({
        source: 'path',
        text:
          `Next step on their roadmap "${roadmap.title}" (${roadmap.progressPercentage}% done): ` +
          `the current week's focus is "${roadmap.currentWeekFocus}". When they ask what to do ` +
          'or learn next, steer them here first.',
        salience: 0.62,
      });
    } else if (!roadmap && profile?.mainGoal) {
      facts.push({
        source: 'path',
        text:
          `They have no active roadmap yet. When they ask for direction, recommend generating ` +
          `a roadmap for their goal "${profile.mainGoal}".`,
        salience: 0.55,
      });
    }
    if (mistakes.length > 0 && roadmap) {
      facts.push({
        source: 'path',
        text:
          'They have open mistakes to repair (listed under struggles). A short repair session ' +
          'is the highest-value suggestion after the current roadmap week.',
        salience: 0.5,
      });
    }
    return facts;
  }

  private async fetchCourses(userId: string): Promise<ContextFact[]> {
    const docs = await this.courses
      .find({ user: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean()
      .exec();
    return docs.map((d) => ({
      source: 'course' as const,
      text: `Building course "${d.title}" (${d.status}, ${d.modules?.length ?? 0} modules) — goal: ${d.goal}`,
      salience: d.status === 'published' ? 0.35 : 0.45,
    }));
  }

  // ───────────────────────── selection (in-memory) ─────────────────────────

  private select(
    snapshot: UserSnapshot,
    query?: string,
    agentType?: AgentType,
  ): UserSnapshot['facts'] {
    const queryTerms = new Set(this.tokenize(query ?? ''));
    const affinity = new Set((agentType && AGENT_AFFINITY[agentType]) ?? []);

    const scored = snapshot.facts
      .map((fact) => {
        const overlap = this.overlap(queryTerms, fact.terms);
        const score =
          0.55 * overlap +
          0.35 * fact.salience +
          (affinity.has(fact.source) ? 0.1 : 0);
        return { fact, score, overlap };
      })
      .sort((a, b) => b.score - a.score);

    const picked: UserSnapshot['facts'] = [];
    let budget = FACT_TOKEN_BUDGET;
    for (const { fact, overlap } of scored) {
      if (picked.length >= MAX_FACTS) break;
      const cost = estimateTokens(fact.text);
      if (cost > budget) continue;
      // After the guaranteed minimum, only spend budget on facts the query touches
      // or that are important on their own.
      if (picked.length >= MIN_FACTS && overlap === 0 && fact.salience < 0.5)
        continue;
      picked.push(fact);
      budget -= cost;
    }
    return picked;
  }

  private toMemoryItem(text: string): MemoryItem {
    const m = /^\((\w+)\)\s*(.*)$/.exec(text);
    return m ? { kind: m[1], content: m[2] } : { kind: 'fact', content: text };
  }

  private tokenize(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (t) => t.length > 2,
    );
  }

  private overlap(queryTerms: Set<string>, factTerms: Set<string>): number {
    if (queryTerms.size === 0) return 0;
    let hit = 0;
    for (const t of queryTerms) if (factTerms.has(t)) hit++;
    return hit / queryTerms.size;
  }
}
