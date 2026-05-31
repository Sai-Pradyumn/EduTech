import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Role } from '../../common/enums';
import { planById } from '../billing/plans';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Organization,
  OrganizationDocument,
} from '../tenancy/schemas/organization.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../billing/schemas/subscription.schema';
import { Cohort, CohortDocument } from '../cohort/schemas/cohort.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Quiz, QuizDocument } from '../assessment/schemas/quiz.schema';
import { Roadmap, RoadmapDocument } from '../roadmap/schemas/roadmap.schema';
import { AiService } from '../ai/ai.service';

export interface FounderDashboard {
  generatedAt: string;
  totals: {
    organizations: number;
    users: number;
    students: number;
    mentors: number;
    cohorts: number;
  };
  subscriptions: {
    active: number;
    estMrrInr: number;
    byPlan: { plan: string; count: number }[];
  };
  ai: {
    totalCalls: number;
    totalTokens: number;
    estCostUsd: number;
    byAgent: { agentType: string; count: number }[];
  };
  adoption: { feature: string; users: number; pct: number }[];
  topCohorts: {
    name: string;
    organization: string;
    students: number;
    mentors: number;
  }[];
  signups: { date: string; count: number }[];
  churnRisk: { inactiveStudents: number; thresholdDays: number };
  systemHealth: { db: string; uptimeSec: number; memoryMb: number };
}

const COST_PER_1K_TOKENS_USD = 0.002; // placeholder rate (revenue/cost modelling is 🧱)
const CHURN_THRESHOLD_DAYS = 14;
const SIGNUP_WINDOW_DAYS = 14;

/**
 * Founder / operator dashboard (Phase 4 · B17): platform-wide aggregates across every org.
 * Read-only; reuses the AI usage facade + raw Mongoose models for counts. MRR + AI cost are
 * estimates from the plan catalog + a placeholder token rate (real revenue modelling is 🧱).
 */
@Injectable()
export class FounderService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Organization.name)
    private readonly orgs: Model<OrganizationDocument>,
    @InjectModel(Subscription.name)
    private readonly subs: Model<SubscriptionDocument>,
    @InjectModel(Cohort.name) private readonly cohorts: Model<CohortDocument>,
    @InjectModel(Project.name)
    private readonly projects: Model<ProjectDocument>,
    @InjectModel(Quiz.name) private readonly quizzes: Model<QuizDocument>,
    @InjectModel(Roadmap.name)
    private readonly roadmaps: Model<RoadmapDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly ai: AiService,
  ) {}

  async overview(): Promise<FounderDashboard> {
    const [organizations, users, students, mentors, cohortCount] =
      await Promise.all([
        this.orgs.countDocuments().exec(),
        this.users.countDocuments().exec(),
        this.users.countDocuments({ role: Role.Student }).exec(),
        this.users.countDocuments({ role: Role.Mentor }).exec(),
        this.cohorts.countDocuments().exec(),
      ]);

    const subscriptions = await this.subscriptionStats();
    const aiSummary = await this.ai.usageSummary();
    const adoption = await this.adoption(Math.max(students, 1));
    const topCohorts = await this.topCohorts();
    const signups = await this.signups();

    const inactiveStudents = await this.users
      .countDocuments({
        role: Role.Student,
        $or: [
          { lastActiveAt: { $exists: false } },
          { lastActiveAt: { $lt: this.daysAgo(CHURN_THRESHOLD_DAYS) } },
        ],
      })
      .exec();

    return {
      generatedAt: new Date().toISOString(),
      totals: { organizations, users, students, mentors, cohorts: cohortCount },
      subscriptions,
      ai: {
        totalCalls: aiSummary.totalCalls,
        totalTokens: aiSummary.totalTokens,
        estCostUsd:
          Math.round(
            (aiSummary.totalTokens / 1000) * COST_PER_1K_TOKENS_USD * 100,
          ) / 100,
        byAgent: aiSummary.byAgent,
      },
      adoption,
      topCohorts,
      signups,
      churnRisk: { inactiveStudents, thresholdDays: CHURN_THRESHOLD_DAYS },
      systemHealth: {
        db:
          ['disconnected', 'connected', 'connecting', 'disconnecting'][
            this.connection.readyState
          ] ?? 'unknown',
        uptimeSec: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };
  }

  private async subscriptionStats(): Promise<
    FounderDashboard['subscriptions']
  > {
    const byPlanRaw = await this.subs.aggregate<{ _id: string; count: number }>(
      [
        { $match: { status: 'active' } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ],
    );
    const byPlan = byPlanRaw.map((p) => ({ plan: p._id, count: p.count }));
    const active = byPlan.reduce((sum, p) => sum + p.count, 0);
    const estMrrInr = byPlan.reduce(
      (sum, p) => sum + planById(p.plan).priceInr * p.count,
      0,
    );
    return { active, estMrrInr, byPlan };
  }

  private async adoption(
    studentCount: number,
  ): Promise<FounderDashboard['adoption']> {
    const [roadmapUsers, quizUsers, projectUsers] = await Promise.all([
      this.roadmaps.distinct('user').exec(),
      this.quizzes.distinct('user').exec(),
      this.projects.distinct('user').exec(),
    ]);
    const pct = (n: number) => Math.round((n / studentCount) * 100);
    return [
      {
        feature: 'Roadmap',
        users: roadmapUsers.length,
        pct: pct(roadmapUsers.length),
      },
      {
        feature: 'Quizzes',
        users: quizUsers.length,
        pct: pct(quizUsers.length),
      },
      {
        feature: 'Projects',
        users: projectUsers.length,
        pct: pct(projectUsers.length),
      },
    ];
  }

  private async topCohorts(): Promise<FounderDashboard['topCohorts']> {
    const list = await this.cohorts
      .find()
      .populate<{ organization: { name: string } }>('organization', 'name')
      .lean()
      .exec();
    return list
      .map((c) => ({
        name: c.name,
        organization:
          (c.organization as { name?: string } | undefined)?.name ?? '—',
        students: (c.students as Types.ObjectId[] | undefined)?.length ?? 0,
        mentors: (c.mentors as Types.ObjectId[] | undefined)?.length ?? 0,
      }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 5);
  }

  private async signups(): Promise<FounderDashboard['signups']> {
    const since = this.daysAgo(SIGNUP_WINDOW_DAYS);
    const raw = await this.users.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return raw.map((r) => ({ date: r._id, count: r.count }));
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
