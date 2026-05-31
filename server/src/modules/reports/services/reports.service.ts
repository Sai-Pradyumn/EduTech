import { Injectable } from '@nestjs/common';
import { OrgRole } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { LearningIntelligenceService } from '../../learning-intelligence/learning-intelligence.service';
import { MembershipService } from '../../tenancy/services/membership.service';

export interface StudentOutcomeRow {
  userId: string;
  name: string;
  email: string;
  health: number;
  readiness: number;
  quizzes: number;
  projects: number;
  activeDays: number;
  topWeakness: string;
}

export interface StudentOutcomesReport {
  generatedAt: string;
  organizationId: string;
  studentCount: number;
  avgHealth: number;
  avgReadiness: number;
  rows: StudentOutcomeRow[];
}

export interface WeakTopicRow {
  topic: string;
  affectedStudents: number;
  avgSeverity: number;
}

export interface AiUsageRow {
  agentType: string;
  count: number;
}

export interface AiUsageReport {
  generatedAt: string;
  totalCalls: number;
  totalTokens: number;
  avgLatencyMs: number;
  rows: AiUsageRow[];
}

const STUDENT_CAP = 200;

/**
 * Enterprise reports (Phase 4 · B16): read-only org outcome aggregation built on the
 * Learning-Intelligence engine + membership roster + AI usage logs. Owns no schemas.
 * CSV export is real; PDF export + placement-readiness scoring are 🧱 / future.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly memberships: MembershipService,
    private readonly intelligence: LearningIntelligenceService,
    private readonly ai: AiService,
  ) {}

  /** Per-student outcomes for every student in the organization. */
  async studentOutcomes(orgId: string): Promise<StudentOutcomesReport> {
    const members = await this.memberships.listMembers(orgId);
    const students = members
      .filter((m) => m.orgRole === OrgRole.Student)
      .slice(0, STUDENT_CAP);

    const rows: StudentOutcomeRow[] = await Promise.all(
      students.map(async (s) => {
        const li = await this.intelligence.overview(s.userId);
        return {
          userId: s.userId,
          name: s.name,
          email: s.email,
          health: li.healthScore,
          readiness: li.readinessScore,
          quizzes: li.momentum.attempts,
          projects: li.momentum.projects,
          activeDays: li.momentum.activeDays,
          topWeakness: li.weaknesses[0]?.topic ?? '—',
        };
      }),
    );
    rows.sort((a, b) => b.health - a.health);

    const avg = (key: 'health' | 'readiness') =>
      rows.length
        ? Math.round(rows.reduce((sum, r) => sum + r[key], 0) / rows.length)
        : 0;

    return {
      generatedAt: new Date().toISOString(),
      organizationId: orgId,
      studentCount: rows.length,
      avgHealth: avg('health'),
      avgReadiness: avg('readiness'),
      rows,
    };
  }

  /** Aggregated weak topics across the organization's students. */
  async weakTopics(orgId: string): Promise<WeakTopicRow[]> {
    const members = await this.memberships.listMembers(orgId);
    const students = members
      .filter((m) => m.orgRole === OrgRole.Student)
      .slice(0, STUDENT_CAP);
    const acc = new Map<string, { total: number; count: number }>();
    await Promise.all(
      students.map(async (s) => {
        const li = await this.intelligence.overview(s.userId);
        for (const w of li.weaknesses) {
          const entry = acc.get(w.topic) ?? { total: 0, count: 0 };
          entry.total += w.severity;
          entry.count += 1;
          acc.set(w.topic, entry);
        }
      }),
    );
    return [...acc.entries()]
      .map(([topic, v]) => ({
        topic,
        affectedStudents: v.count,
        avgSeverity: Math.round(v.total / v.count),
      }))
      .sort(
        (a, b) =>
          b.affectedStudents - a.affectedStudents ||
          b.avgSeverity - a.avgSeverity,
      );
  }

  /** Platform AI usage by agent (admin / operator report). */
  async aiUsage(): Promise<AiUsageReport> {
    const summary = await this.ai.usageSummary();
    return {
      generatedAt: new Date().toISOString(),
      totalCalls: summary.totalCalls,
      totalTokens: summary.totalTokens,
      avgLatencyMs: summary.avgLatencyMs,
      rows: summary.byAgent.map((a) => ({
        agentType: a.agentType,
        count: a.count,
      })),
    };
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  studentsCsv(report: StudentOutcomesReport): string {
    return this.toCsv(
      [
        'Name',
        'Email',
        'Health',
        'Readiness',
        'Quizzes',
        'Projects',
        'Active days',
        'Top weakness',
      ],
      report.rows.map((r) => [
        r.name,
        r.email,
        r.health,
        r.readiness,
        r.quizzes,
        r.projects,
        r.activeDays,
        r.topWeakness,
      ]),
    );
  }

  weakTopicsCsv(rows: WeakTopicRow[]): string {
    return this.toCsv(
      ['Topic', 'Affected students', 'Avg severity'],
      rows.map((r) => [r.topic, r.affectedStudents, r.avgSeverity]),
    );
  }

  aiUsageCsv(report: AiUsageReport): string {
    return this.toCsv(
      ['Agent', 'Calls'],
      report.rows.map((r) => [r.agentType, r.count]),
    );
  }

  /** RFC-4180-ish CSV: quote fields containing comma/quote/newline, double interior quotes. */
  private toCsv(headers: string[], rows: (string | number)[][]): string {
    const esc = (v: string | number): string => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers, ...rows].map((row) => row.map(esc).join(',')).join('\r\n');
  }
}
