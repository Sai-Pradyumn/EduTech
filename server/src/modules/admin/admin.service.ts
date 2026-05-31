import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums';
import { AiService } from '../ai/ai.service';
import { LearningIntelligenceService } from '../learning-intelligence/learning-intelligence.service';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  KnowledgeDocument,
  KnowledgeDocumentDocument,
} from '../rag/schemas/knowledge-document.schema';
import { Roadmap, RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import { Quiz, QuizDocument } from '../assessment/schemas/quiz.schema';

export interface AdminStudentRow {
  userId: string;
  name: string;
  email: string;
  goal: string;
  skillLevel: string;
  onboarded: boolean;
  health: number;
  readiness: number;
  quizzes: number;
  lastActiveAt?: string;
}

export interface AdminDocumentRow {
  id: string;
  title: string;
  owner: string;
  source: string;
  status: string;
  chunkCount: number;
  tokenCount: number;
  language: string;
  createdAt?: string;
}

export interface AdminRoadmapRow {
  id: string;
  title: string;
  goal: string;
  owner: string;
  status: string;
  progressPercentage: number;
  weeks: number;
  completedWeeks: number;
  createdAt?: string;
}

export interface AdminQuizRow {
  id: string;
  title: string;
  topic: string;
  owner: string;
  difficulty: string;
  source: string;
  questionCount: number;
  attemptCount: number;
  bestScore?: number;
  createdAt?: string;
}

const STUDENT_CAP = 200;
const BROWSE_CAP = 200;

/**
 * Admin Command Center (Phase 3 · A7): platform-operator analytics + student roster for the
 * legacy admin shell. Read-only; reuses the AI usage facade, the LI engine and profiles.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(KnowledgeDocument.name)
    private readonly documents: Model<KnowledgeDocumentDocument>,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    @InjectModel(Quiz.name) private readonly quizzes: Model<QuizDocument>,
    private readonly ai: AiService,
    private readonly intelligence: LearningIntelligenceService,
    private readonly profiles: StudentProfileService,
  ) {}

  /** AI usage by agent with latency + estimated cost. */
  analytics() {
    return this.ai.agentAnalytics();
  }

  /** Every student on the platform with goal, skill level and learning health. */
  async students(): Promise<AdminStudentRow[]> {
    const students = await this.users
      .find({ role: Role.Student })
      .select('name email isOnboarded lastActiveAt')
      .sort({ createdAt: -1 })
      .limit(STUDENT_CAP)
      .lean<
        {
          _id: Types.ObjectId;
          name: string;
          email: string;
          isOnboarded: boolean;
          lastActiveAt?: Date;
        }[]
      >()
      .exec();

    return Promise.all(
      students.map(async (s) => {
        const id = String(s._id);
        const [profile, li] = await Promise.all([
          this.profiles.findByUser(id),
          this.intelligence.overview(id),
        ]);
        return {
          userId: id,
          name: s.name,
          email: s.email,
          goal: profile?.mainGoal || '—',
          skillLevel: profile?.currentSkillLevel || '—',
          onboarded: s.isOnboarded,
          health: li.healthScore,
          readiness: li.readinessScore,
          quizzes: li.momentum.attempts,
          lastActiveAt: s.lastActiveAt
            ? new Date(s.lastActiveAt).toISOString()
            : undefined,
        };
      }),
    );
  }

  /** Every knowledge document across the platform with ingestion status + owner. */
  async documentsBrowse(): Promise<AdminDocumentRow[]> {
    const docs = await this.documents
      .find()
      .sort({ createdAt: -1 })
      .limit(BROWSE_CAP)
      .lean<
        {
          _id: Types.ObjectId;
          user: Types.ObjectId;
          title: string;
          source: string;
          status: string;
          chunkCount: number;
          tokenCount: number;
          language: string;
          createdAt?: Date;
        }[]
      >()
      .exec();
    const names = await this.ownerNames(docs.map((d) => d.user));
    return docs.map((d) => ({
      id: String(d._id),
      title: d.title,
      owner: names.get(String(d.user)) ?? '—',
      source: d.source,
      status: d.status,
      chunkCount: d.chunkCount ?? 0,
      tokenCount: d.tokenCount ?? 0,
      language: d.language ?? 'en',
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
    }));
  }

  /** Every generated roadmap across students with progress + owner. */
  async roadmapsBrowse(): Promise<AdminRoadmapRow[]> {
    const rows = await this.roadmaps
      .find()
      .select(
        'title goal user status progressPercentage weeklyPlan completedWeeks createdAt',
      )
      .sort({ createdAt: -1 })
      .limit(BROWSE_CAP)
      .lean<
        {
          _id: Types.ObjectId;
          user: Types.ObjectId;
          title: string;
          goal: string;
          status: string;
          progressPercentage: number;
          weeklyPlan: unknown[];
          completedWeeks: number[];
          createdAt?: Date;
        }[]
      >()
      .exec();
    const names = await this.ownerNames(rows.map((r) => r.user));
    return rows.map((r) => ({
      id: String(r._id),
      title: r.title,
      goal: r.goal,
      owner: names.get(String(r.user)) ?? '—',
      status: r.status,
      progressPercentage: r.progressPercentage ?? 0,
      weeks: r.weeklyPlan?.length ?? 0,
      completedWeeks: r.completedWeeks?.length ?? 0,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    }));
  }

  /** Every generated quiz across students with attempt stats + owner. */
  async quizzesBrowse(): Promise<AdminQuizRow[]> {
    const rows = await this.quizzes
      .find()
      .select(
        'title topic user difficulty source questions attemptCount bestScore createdAt',
      )
      .sort({ createdAt: -1 })
      .limit(BROWSE_CAP)
      .lean<
        {
          _id: Types.ObjectId;
          user: Types.ObjectId;
          title: string;
          topic: string;
          difficulty: string;
          source: string;
          questions: unknown[];
          attemptCount: number;
          bestScore?: number;
          createdAt?: Date;
        }[]
      >()
      .exec();
    const names = await this.ownerNames(rows.map((r) => r.user));
    return rows.map((r) => ({
      id: String(r._id),
      title: r.title,
      topic: r.topic,
      owner: names.get(String(r.user)) ?? '—',
      difficulty: r.difficulty,
      source: r.source,
      questionCount: r.questions?.length ?? 0,
      attemptCount: r.attemptCount ?? 0,
      bestScore: r.bestScore,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    }));
  }

  /** Resolve a set of owner ObjectIds to display names in a single query. */
  private async ownerNames(
    ids: Types.ObjectId[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.map((id) => String(id)))];
    if (!unique.length) return new Map();
    const owners = await this.users
      .find({ _id: { $in: unique } })
      .select('name email')
      .lean<{ _id: Types.ObjectId; name: string; email: string }[]>()
      .exec();
    return new Map(owners.map((o) => [String(o._id), o.name || o.email]));
  }
}
