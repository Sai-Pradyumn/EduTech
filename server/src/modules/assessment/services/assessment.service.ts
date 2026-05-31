import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AgentType,
  Difficulty,
  RoadmapStatus,
  SkillLevel,
} from '../../../common/enums';
import {
  PROGRESSION_EVENTS,
  QuizGradedEvent,
} from '../../progression/progression.events';
import { AiService } from '../../ai/ai.service';
import { KnowledgeService } from '../../rag/services/knowledge.service';
import { StudentProfileService } from '../../student-profile/student-profile.service';
import { Roadmap, RoadmapDocument } from '../../roadmap/schemas/roadmap.schema';
import { Quiz, QuizDocument } from '../schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptDocument,
} from '../schemas/quiz-attempt.schema';
import { GenerateQuizDto, SubmitAttemptDto } from '../dto/assessment.dto';
import {
  GeneratedQuestion,
  QuizGeneratorService,
} from './quiz-generator.service';
import { Evaluation, EvaluationService } from './evaluation.service';

export interface QuizView {
  id: string;
  title: string;
  topic: string;
  source: string;
  difficulty: Difficulty;
  questionCount: number;
  attemptCount: number;
  bestScore?: number;
  documentId?: string;
  createdAt: string;
}

export interface AttemptView {
  id: string;
  quizId: string;
  score: number;
  correctCount: number;
  total: number;
  weakTopics: string[];
  feedback: string;
  createdAt: string;
}

/** A question with answers hidden — what the student sees while taking the quiz. */
export interface TakeQuestion {
  type: string;
  prompt: string;
  options: string[];
  topic: string;
  difficulty: Difficulty;
  source?: string;
}
export interface TakeQuiz {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  questions: TakeQuestion[];
}

/** A graded question with the correct answer + explanation revealed (post-submit review). */
export interface ReviewQuestion extends TakeQuestion {
  answerIndex?: number;
  modelAnswer: string;
  explanation: string;
  yourAnswerIndex?: number;
  yourText: string;
  correct: boolean;
}

/** Orchestrates quiz generation, persistence, grading and stats. */
@Injectable()
export class AssessmentService {
  constructor(
    @InjectModel(Quiz.name) private readonly quizzes: Model<QuizDocument>,
    @InjectModel(QuizAttempt.name)
    private readonly attempts: Model<QuizAttemptDocument>,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    private readonly generator: QuizGeneratorService,
    private readonly evaluator: EvaluationService,
    private readonly profiles: StudentProfileService,
    private readonly knowledge: KnowledgeService,
    private readonly ai: AiService,
    private readonly events: EventEmitter2,
  ) {}

  async generate(userId: string, dto: GenerateQuizDto): Promise<QuizDocument> {
    const count = dto.count ?? 5;
    const difficulty =
      dto.difficulty ?? (await this.adaptiveDifficulty(userId));

    let questions: GeneratedQuestion[];
    let title: string;
    let topic: string;
    let documentId: Types.ObjectId | undefined;
    let roadmapId: Types.ObjectId | undefined;

    switch (dto.source) {
      case 'document': {
        if (!dto.documentId)
          throw new BadRequestException(
            'documentId is required for a document quiz.',
          );
        const chunks = await this.knowledge.sampleChunks(
          userId,
          dto.documentId,
          Math.max(count, 8),
        );
        if (chunks.length === 0)
          throw new BadRequestException(
            'That document has no indexed content yet.',
          );
        const doc = await this.knowledge.get(userId, dto.documentId);
        topic = doc.topic ?? doc.title;
        title = `Quiz · ${doc.title}`;
        questions = this.generator.fromDocument(
          topic,
          chunks,
          difficulty,
          count,
        );
        documentId = new Types.ObjectId(dto.documentId);
        break;
      }
      case 'weak_area': {
        const profile = await this.profiles.findByUserOrThrow(userId);
        const weak = profile.weakAreas.length
          ? profile.weakAreas
          : [profile.mainGoal];
        topic = weak.join(', ');
        title = `Weak-area drill · ${weak.slice(0, 3).join(', ')}`;
        questions = this.spread(weak, difficulty, count);
        break;
      }
      case 'roadmap': {
        const roadmap = await this.roadmaps.findOne({
          user: new Types.ObjectId(userId),
          status: RoadmapStatus.Active,
        });
        if (!roadmap)
          throw new BadRequestException('No active roadmap to quiz from.');
        const week = this.currentWeek(roadmap);
        const topics = week?.topics.length ? week.topics : [roadmap.goal];
        topic = topics.join(', ');
        title = `Roadmap check · ${week ? `Week ${week.weekNumber}` : roadmap.title}`;
        questions = this.spread(topics, difficulty, count);
        roadmapId = roadmap._id;
        break;
      }
      default: {
        if (!dto.topic)
          throw new BadRequestException('topic is required for a topic quiz.');
        topic = dto.topic.trim();
        title = `Quiz · ${this.titleCase(topic)}`;
        questions = this.generator.fromTopic(topic, difficulty, count);
      }
    }

    const quiz = await this.quizzes.create({
      user: new Types.ObjectId(userId),
      title,
      topic,
      source: dto.source,
      difficulty,
      questions,
      documentId,
      roadmapId,
    });
    await this.ai.logUsage({
      userId,
      agentType: AgentType.Assessment,
      operation: 'quiz.generate',
    });
    return quiz;
  }

  async list(userId: string): Promise<QuizView[]> {
    const quizzes = await this.quizzes
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean<QuizDocument[]>()
      .exec();
    return quizzes.map((q) => this.toView(q));
  }

  async get(userId: string, id: string): Promise<QuizDocument> {
    return this.ownedQuiz(userId, id);
  }

  /** Quiz with answers stripped — safe to hand to the client to take. */
  async getForTaking(userId: string, id: string): Promise<TakeQuiz> {
    return this.toTakeQuiz(await this.ownedQuiz(userId, id));
  }

  toTakeQuiz(quiz: QuizDocument): TakeQuiz {
    return {
      id: String(quiz._id),
      title: quiz.title,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      questions: quiz.questions.map((q) => ({
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        topic: q.topic,
        difficulty: q.difficulty,
        source: q.source,
      })),
    };
  }

  async submit(
    userId: string,
    quizId: string,
    dto: SubmitAttemptDto,
  ): Promise<{
    attempt: AttemptView;
    evaluation: Evaluation;
    review: ReviewQuestion[];
  }> {
    const quiz = await this.ownedQuiz(userId, quizId);
    const evaluation = this.evaluator.evaluate(quiz.questions, dto.answers);
    const review: ReviewQuestion[] = quiz.questions.map((q, i) => {
      const r = evaluation.results[i];
      return {
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        topic: q.topic,
        difficulty: q.difficulty,
        source: q.source,
        answerIndex: q.answerIndex,
        modelAnswer: q.modelAnswer,
        explanation: q.explanation,
        yourAnswerIndex: r?.answerIndex,
        yourText: r?.text ?? '',
        correct: r?.correct ?? false,
      };
    });

    const attempt = await this.attempts.create({
      user: new Types.ObjectId(userId),
      quiz: quiz._id,
      score: evaluation.score,
      correctCount: evaluation.correctCount,
      total: evaluation.total,
      results: evaluation.results,
      topicScores: evaluation.topicScores,
      weakTopics: evaluation.weakTopics,
      feedback: evaluation.feedback,
      durationMs: dto.durationMs ?? 0,
    });

    quiz.attemptCount += 1;
    quiz.bestScore = Math.max(quiz.bestScore ?? 0, evaluation.score);
    await quiz.save();

    // Feed detected weak areas back into the profile (powers tutor/roadmap personalization).
    if (evaluation.weakTopics.length) {
      await this.profiles
        .addWeakAreas(userId, evaluation.weakTopics)
        .catch(() => undefined);
    }
    await this.ai.logUsage({
      userId,
      agentType: AgentType.Assessment,
      operation: 'quiz.grade',
    });

    // Let the progression engine react (nudge / next step) autonomously.
    this.events.emit(PROGRESSION_EVENTS.quizGraded, {
      userId,
      quizId: String(quiz._id),
      quizTitle: quiz.title,
      topic: quiz.topic,
      score: evaluation.score,
      weakTopics: evaluation.weakTopics,
      topicScores: evaluation.topicScores.map((t) => ({
        topic: t.topic,
        severity: t.severity,
      })),
    } satisfies QuizGradedEvent);

    return { attempt: this.toAttemptView(attempt), evaluation, review };
  }

  /** Per-topic mastery (0..100 = 100 − avg severity) across all attempts. For analytics. */
  async topicMastery(
    userId: string,
  ): Promise<{ topic: string; mastery: number; answered: number }[]> {
    const attempts = await this.attempts
      .find({ user: new Types.ObjectId(userId) })
      .lean<QuizAttemptDocument[]>()
      .exec();
    const agg = new Map<
      string,
      { sevSum: number; n: number; answered: number }
    >();
    for (const a of attempts) {
      for (const t of a.topicScores) {
        const e = agg.get(t.topic) ?? { sevSum: 0, n: 0, answered: 0 };
        e.sevSum += t.severity;
        e.n += 1;
        e.answered += t.total;
        agg.set(t.topic, e);
      }
    }
    return [...agg.entries()]
      .map(([topic, { sevSum, n, answered }]) => ({
        topic,
        mastery: Math.round(100 - sevSum / n),
        answered,
      }))
      .sort((a, b) => b.answered - a.answered);
  }

  async listAttempts(userId: string): Promise<AttemptView[]> {
    const attempts = await this.attempts
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<QuizAttemptDocument[]>()
      .exec();
    return attempts.map((a) => this.toAttemptView(a));
  }

  async stats(userId: string): Promise<{
    quizzes: number;
    attempts: number;
    averageScore: number;
    masteredTopics: string[];
    weakTopics: { topic: string; severity: number }[];
  }> {
    const uid = new Types.ObjectId(userId);
    const [quizCount, attempts] = await Promise.all([
      this.quizzes.countDocuments({ user: uid }),
      this.attempts.find({ user: uid }).lean<QuizAttemptDocument[]>().exec(),
    ]);
    const avg = attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
      : 0;

    // Aggregate topic severity across attempts.
    const sev = new Map<string, { sum: number; n: number }>();
    for (const a of attempts) {
      for (const t of a.topicScores) {
        const e = sev.get(t.topic) ?? { sum: 0, n: 0 };
        e.sum += t.severity;
        e.n += 1;
        sev.set(t.topic, e);
      }
    }
    const ranked = [...sev.entries()]
      .map(([topic, { sum, n }]) => ({ topic, severity: Math.round(sum / n) }))
      .sort((a, b) => b.severity - a.severity);

    return {
      quizzes: quizCount,
      attempts: attempts.length,
      averageScore: avg,
      masteredTopics: ranked
        .filter((t) => t.severity === 0)
        .map((t) => t.topic)
        .slice(0, 6),
      weakTopics: ranked.filter((t) => t.severity >= 50).slice(0, 6),
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  /** Generate `count` questions spread across multiple topics (weak areas / roadmap week). */
  private spread(
    topics: string[],
    difficulty: Difficulty,
    count: number,
  ): GeneratedQuestion[] {
    const list = topics.length ? topics : ['general'];
    const per = Math.max(1, Math.ceil(count / list.length));
    const out: GeneratedQuestion[] = [];
    for (const t of list) {
      out.push(...this.generator.fromTopic(t.trim(), difficulty, per));
      if (out.length >= count) break;
    }
    return out.slice(0, count);
  }

  /** Nudge difficulty from the student's level + recent performance. */
  private async adaptiveDifficulty(userId: string): Promise<Difficulty> {
    const profile = await this.profiles.findByUser(userId);
    let level: Difficulty =
      profile?.currentSkillLevel === SkillLevel.Advanced
        ? Difficulty.Advanced
        : profile?.currentSkillLevel === SkillLevel.Intermediate
          ? Difficulty.Intermediate
          : Difficulty.Beginner;

    const recent = await this.attempts
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean<QuizAttemptDocument[]>()
      .exec();
    if (recent.length >= 2) {
      const avg = recent.reduce((s, a) => s + a.score, 0) / recent.length;
      if (avg >= 75) level = this.bump(level, 1);
      else if (avg < 40) level = this.bump(level, -1);
    }
    return level;
  }

  private bump(d: Difficulty, by: number): Difficulty {
    const order = [
      Difficulty.Beginner,
      Difficulty.Intermediate,
      Difficulty.Advanced,
    ];
    const i = Math.max(0, Math.min(order.length - 1, order.indexOf(d) + by));
    return order[i];
  }

  private currentWeek(
    roadmap: RoadmapDocument,
  ): { weekNumber: number; topics: string[] } | null {
    const done = new Set(roadmap.completedWeeks);
    const next =
      roadmap.weeklyPlan.find((w) => !done.has(w.weekNumber)) ??
      roadmap.weeklyPlan[0];
    return next ? { weekNumber: next.weekNumber, topics: next.topics } : null;
  }

  private async ownedQuiz(userId: string, id: string): Promise<QuizDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Quiz not found');
    const quiz = await this.quizzes.findOne({
      _id: id,
      user: new Types.ObjectId(userId),
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  private toView(q: QuizDocument): QuizView {
    return {
      id: String(q._id),
      title: q.title,
      topic: q.topic,
      source: q.source,
      difficulty: q.difficulty,
      questionCount: q.questions.length,
      attemptCount: q.attemptCount,
      bestScore: q.bestScore,
      documentId: q.documentId ? String(q.documentId) : undefined,
      createdAt:
        (q as QuizDocument & { createdAt?: Date }).createdAt?.toISOString() ??
        '',
    };
  }

  private toAttemptView(a: QuizAttemptDocument): AttemptView {
    return {
      id: String(a._id),
      quizId: String(a.quiz),
      score: a.score,
      correctCount: a.correctCount,
      total: a.total,
      weakTopics: a.weakTopics,
      feedback: a.feedback,
      createdAt:
        (
          a as QuizAttemptDocument & { createdAt?: Date }
        ).createdAt?.toISOString() ?? '',
    };
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
