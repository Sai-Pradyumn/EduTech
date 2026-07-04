import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SkillTwinService } from '../skill-twin/skill-twin.service';
import { LedgerService } from '../ledger/ledger.service';
import { CertificatesService } from '../certificates/services/certificates.service';
import { ProjectsService } from '../projects/services/projects.service';
import { StudentProfileService } from '../student-profile/student-profile.service';
import { UsersService } from '../users/users.service';
import {
  LedgerEntryDocument,
  VerificationLevel,
} from '../ledger/schemas/ledger-entry.schema';
import {
  PassportVisibility,
  SkillPassport,
  SkillPassportDocument,
} from './schemas/skill-passport.schema';
import {
  SkillEvidence,
  SkillEvidenceDocument,
} from './schemas/skill-evidence.schema';
import { AddEvidenceDto, UpdatePassportDto } from './dto/skill-passport.dto';

export interface PassportSkill {
  skill: string;
  mastery: number;
  confidence: number;
  evidenceCount: number;
  lastPracticed: string | null;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PassportProject {
  id: string;
  title: string;
  stack: string[];
  features: string[];
  difficulty: string;
  status: string;
  aiScore: number | null;
  mentorStatus: 'approved' | 'changes_requested' | 'pending' | null;
  githubUrl: string | null;
  demoUrl: string | null;
}

export interface PassportTimelineItem {
  id: string;
  kind: string;
  title: string;
  detail: string;
  score: number | null;
  verificationLevel: VerificationLevel;
  visibleOnPassport: boolean;
  at: string;
}

export interface PassportView {
  username: string;
  identity: {
    name: string;
    headline: string;
    targetRole: string;
    currentLevel: string;
    readinessScore: number;
    healthScore: number;
    topSkills: string[];
    pace: string;
    projectedDaysToGoal: number | null;
  };
  skills: PassportSkill[];
  proofSummary: {
    totalEvents: number;
    verifiedEvents: number;
    quizzesPassed: number;
    projectsCompleted: number;
    simulationsPassed: number;
    certificatesIssued: number;
    mentorApprovals: number;
    vivaPassed: number;
    mistakesResolved: number;
  };
  projects: PassportProject[];
  certificates: {
    id: string;
    title: string;
    skill: string;
    score: number;
    verificationId: string;
    issuedAt: string;
  }[];
  manualEvidence: {
    id: string;
    skill: string;
    sourceType: string;
    summary: string;
    score: number | null;
    url: string | null;
    verificationLevel: string;
  }[];
  timeline: PassportTimelineItem[];
  visibility: PassportVisibility;
  publicSettings: SkillPassport['publicSettings'];
  lastComputedAt: string | null;
}

/**
 * Phase 9 · Skill Passport — the learner's living, verified profile. Blends the Skill Twin
 * (mastery / readiness), the Proof Ledger (verified events), certificates, projects and manual
 * evidence into one explainable, shareable view. Owns identity + sharing-setting persistence and
 * a tiny cached snapshot; everything else is computed on read.
 */
@Injectable()
export class SkillPassportService {
  constructor(
    @InjectModel(SkillPassport.name)
    private readonly passportModel: Model<SkillPassportDocument>,
    @InjectModel(SkillEvidence.name)
    private readonly evidenceModel: Model<SkillEvidenceDocument>,
    private readonly twin: SkillTwinService,
    private readonly ledger: LedgerService,
    private readonly certs: CertificatesService,
    private readonly projects: ProjectsService,
    private readonly profiles: StudentProfileService,
    private readonly users: UsersService,
  ) {}

  // ───────────────────────── identity / persistence ─────────────────────────

  /** Find-or-create the passport doc for a user, generating a unique public username. */
  async ensure(userId: string): Promise<SkillPassportDocument> {
    const existing = await this.passportModel
      .findOne({ user: new Types.ObjectId(userId) })
      .exec();
    if (existing) return existing;
    const user = await this.users.findByIdOrThrow(userId);
    const profile = await this.profiles.findByUser(userId);
    const username = await this.uniqueUsername(user.name, userId);
    return this.passportModel.create({
      user: new Types.ObjectId(userId),
      username,
      headline: profile?.mainGoal
        ? this.toHeadline(profile.mainGoal)
        : `Aspiring ${profile?.careerTarget ?? 'developer'}`,
      targetRole: this.deriveTargetRole(profile),
      visibility: 'private',
    });
  }

  private async uniqueUsername(name: string, userId: string): Promise<string> {
    const base =
      (name || 'learner')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 28) || 'learner';
    const suffix = userId.slice(-4);
    let candidate = `${base}-${suffix}`;
    let n = 1;
    // Extremely unlikely to collide, but stay safe.
    while (await this.passportModel.exists({ username: candidate })) {
      candidate = `${base}-${suffix}-${n++}`;
    }
    return candidate;
  }

  private toHeadline(goal: string): string {
    return goal.length > 120 ? `${goal.slice(0, 117)}…` : goal;
  }

  private deriveTargetRole(profile: { mainGoal?: string } | null): string {
    const goal = profile?.mainGoal ?? '';
    const m = goal.match(
      /(full[- ]?stack|mern|backend|frontend|ai engineer|data analyst|devops|mobile)[a-z ]*developer?/i,
    );
    if (m) return this.titleCase(m[0]);
    if (/mern/i.test(goal)) return 'MERN Developer';
    return 'Full Stack Developer';
  }

  // ───────────────────────── read / compute ─────────────────────────

  async getMe(userId: string): Promise<PassportView> {
    const doc = await this.ensure(userId);
    return this.buildView(userId, doc, false);
  }

  async getPublicByUsername(username: string): Promise<PassportView> {
    const doc = await this.passportModel
      .findOne({ username: username.toLowerCase().trim() })
      .exec();
    if (!doc || doc.visibility === 'private')
      throw new NotFoundException('This profile is private or does not exist.');
    return this.buildView(String(doc.user), doc, true);
  }

  private async buildView(
    userId: string,
    doc: SkillPassportDocument,
    publicOnly: boolean,
  ): Promise<PassportView> {
    const [
      twin,
      ledgerEntries,
      summary,
      certificates,
      projects,
      profile,
      user,
      manualEvidence,
    ] = await Promise.all([
      this.twin.compute(userId),
      publicOnly ? this.ledger.listPublic(userId) : this.ledger.list(userId),
      this.ledger.summary(userId),
      this.certs.listMine(userId),
      this.projects.list(userId),
      this.profiles.findByUser(userId),
      this.users.findByIdOrThrow(userId),
      this.evidenceModel
        .find({ user: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .exec(),
    ]);

    const verifiedOnly = publicOnly && doc.publicSettings.verifiedOnly;

    // ── skill graph ──
    const skillEvidence = new Map<
      string,
      { count: number; last: Date | null }
    >();
    for (const e of ledgerEntries) {
      for (const sk of e.skills ?? []) {
        const cur = skillEvidence.get(sk) ?? { count: 0, last: null };
        cur.count += 1;
        if (!cur.last || e.at > cur.last) cur.last = e.at;
        skillEvidence.set(sk, cur);
      }
    }
    for (const ev of manualEvidence) {
      const cur = skillEvidence.get(ev.skill) ?? { count: 0, last: null };
      cur.count += 1;
      skillEvidence.set(ev.skill, cur);
    }
    const riskByConcept = new Map(
      twin.weaknessRoots.map((w) => [w.concept.toLowerCase(), w.severity]),
    );
    let skills: PassportSkill[] = twin.skills.map((s) => {
      const ev = skillEvidence.get(s.skill) ?? { count: 0, last: null };
      const severity = riskByConcept.get(s.skill.toLowerCase()) ?? 0;
      const confidence = clamp(
        Math.round(
          s.mastery * 0.6 + Math.min(ev.count, 5) * 8 - severity * 0.2,
        ),
      );
      return {
        skill: s.skill,
        mastery: s.mastery,
        confidence,
        evidenceCount: ev.count,
        lastPracticed: ev.last ? ev.last.toISOString() : null,
        riskLevel: severity >= 65 ? 'high' : severity >= 35 ? 'medium' : 'low',
      };
    });
    if (verifiedOnly) skills = skills.filter((s) => s.evidenceCount > 0);

    // ── proof summary ──
    const kindCount = (k: string) =>
      summary.byKind.find((b) => b.kind === k)?.count ?? 0;
    const proofSummary = {
      totalEvents: summary.total,
      verifiedEvents: summary.verifiedCount,
      quizzesPassed: kindCount('quiz_passed'),
      projectsCompleted: projects.filter((p) => p.status === 'completed')
        .length,
      simulationsPassed: kindCount('simulation_finished'),
      certificatesIssued: certificates.length,
      mentorApprovals:
        kindCount('project_mentor_approved') +
        kindCount('mentor_feedback_added'),
      vivaPassed: kindCount('voice_viva_passed'),
      mistakesResolved: kindCount('mistake_resolved'),
    };

    // ── projects ──
    let projectViews: PassportProject[] = projects.map((p) => ({
      id: String(p._id),
      title: p.title,
      stack: p.techStack ?? [],
      features: (p.features ?? []).slice(0, 5),
      difficulty: p.difficulty,
      status: p.status,
      aiScore: p.aiReview?.overallScore ?? null,
      mentorStatus: p.mentorReview
        ? p.mentorReview.decision
        : p.submission?.submittedAt
          ? 'pending'
          : null,
      githubUrl: p.submission?.githubUrl ?? null,
      demoUrl: p.submission?.demoUrl ?? null,
    }));
    if (publicOnly && !doc.publicSettings.showProjects) projectViews = [];

    // ── timeline ──
    let timeline: PassportTimelineItem[] = ledgerEntries.map(
      (e: LedgerEntryDocument) => ({
        id: String(e._id),
        kind: e.kind,
        title: e.title,
        detail: e.detail,
        score: e.score ?? null,
        verificationLevel: e.verificationLevel,
        visibleOnPassport: e.visibleOnPassport,
        at: e.at.toISOString(),
      }),
    );
    if (verifiedOnly)
      timeline = timeline.filter(
        (t) => t.verificationLevel !== 'self' && t.verificationLevel !== 'ai',
      );
    if (publicOnly && !doc.publicSettings.showTimeline)
      timeline = timeline.slice(0, 0);

    let certViews = certificates.map((c) => ({
      id: c.id,
      title: c.title,
      skill: c.skill,
      score: c.score,
      verificationId: c.verificationId,
      issuedAt: c.issuedAt,
    }));
    if (publicOnly && !doc.publicSettings.showCertificates) certViews = [];

    let manualViews = manualEvidence
      .filter(
        (e) =>
          (!publicOnly || e.visibleOnPassport) &&
          (!verifiedOnly || e.verificationLevel !== 'self'),
      )
      .map((e) => ({
        id: String(e._id),
        skill: e.skill,
        sourceType: e.sourceType,
        summary: e.summary,
        score: e.score ?? null,
        url: e.url ?? null,
        verificationLevel: e.verificationLevel,
      }));

    // ── identity ──
    const hideScores = publicOnly && !doc.publicSettings.showScores;
    const identity = {
      name: user.name,
      headline: doc.headline || twin.headline,
      targetRole: doc.targetRole || this.deriveTargetRole(profile),
      currentLevel: profile?.currentSkillLevel ?? 'beginner',
      readinessScore: hideScores ? 0 : twin.readinessScore,
      healthScore: hideScores ? 0 : twin.healthScore,
      topSkills: [...skills]
        .sort((a, b) => b.mastery - a.mastery)
        .slice(0, 6)
        .map((s) => s.skill),
      pace: twin.pace,
      projectedDaysToGoal: twin.projectedDaysToGoal,
    };
    if (hideScores) {
      skills = skills.map((s) => ({ ...s, mastery: 0, confidence: 0 }));
      manualViews = manualViews.map((m) => ({ ...m, score: null }));
      timeline = timeline.map((t) => ({ ...t, score: null }));
    }

    return {
      username: doc.username,
      identity,
      skills,
      proofSummary,
      projects: projectViews,
      certificates: certViews,
      manualEvidence: manualViews,
      timeline,
      visibility: doc.visibility,
      publicSettings: doc.publicSettings,
      lastComputedAt: doc.lastComputedAt?.toISOString() ?? null,
    };
  }

  // ───────────────────────── mutations ─────────────────────────

  async patchMe(userId: string, dto: UpdatePassportDto): Promise<PassportView> {
    const doc = await this.ensure(userId);
    if (dto.headline !== undefined) doc.headline = dto.headline;
    if (dto.targetRole !== undefined) doc.targetRole = dto.targetRole;
    if (dto.visibility !== undefined) doc.visibility = dto.visibility;
    if (dto.publicSettings)
      Object.assign(doc.publicSettings, dto.publicSettings);
    await doc.save();
    return this.buildView(userId, doc, false);
  }

  async recompute(userId: string): Promise<PassportView> {
    const doc = await this.ensure(userId);
    const twin = await this.twin.compute(userId);
    doc.readinessScore = twin.readinessScore;
    doc.skillSnapshots = twin.skills.map((s) => ({
      skill: s.skill,
      mastery: s.mastery,
      confidence: clamp(Math.round(s.mastery * 0.7)),
      evidence: 0,
    }));
    doc.lastComputedAt = new Date();
    await doc.save();
    return this.buildView(userId, doc, false);
  }

  async setVisibility(
    userId: string,
    visibility: PassportVisibility,
  ): Promise<PassportView> {
    const doc = await this.ensure(userId);
    doc.visibility = visibility;
    if (visibility !== 'private' && !doc.publishedAt)
      doc.publishedAt = new Date();
    await doc.save();
    return this.buildView(userId, doc, false);
  }

  // ───────────────────────── manual evidence ─────────────────────────

  async addEvidence(
    userId: string,
    dto: AddEvidenceDto,
  ): Promise<SkillEvidenceDocument> {
    const verificationLevel =
      dto.sourceType === 'certificate'
        ? 'certificate'
        : dto.sourceType === 'mentor'
          ? 'mentor'
          : 'self';
    const created = await this.evidenceModel.create({
      user: new Types.ObjectId(userId),
      skill: dto.skill,
      sourceType: dto.sourceType,
      summary: dto.summary,
      score: dto.score,
      url: dto.url,
      verificationLevel,
    });
    await this.ledger.record(userId, {
      kind: 'evidence_added',
      title: `Added evidence: ${dto.skill}`,
      detail: dto.summary,
      score: dto.score,
      skills: [dto.skill],
      verificationLevel:
        verificationLevel === 'certificate' ? 'certificate' : 'self',
    });
    return created;
  }

  /** Phase 9 · Project Review 2.0 — promote a reviewed project into verified passport evidence. */
  async addProjectEvidence(
    userId: string,
    projectId: string,
  ): Promise<SkillEvidenceDocument> {
    const project = await this.projects.get(userId, projectId);
    const skill = project.techStack[0] ?? 'Project delivery';
    const score = project.aiReview?.overallScore;
    const verificationLevel =
      project.mentorReview?.decision === 'approved'
        ? 'mentor'
        : project.aiReview?.reviewedAt
          ? 'ai'
          : 'self';
    const created = await this.evidenceModel.create({
      user: new Types.ObjectId(userId),
      skill,
      sourceType: 'project',
      sourceId: projectId,
      summary:
        `${project.title} — ${project.caseStudy || project.summary || project.goal}`.slice(
          0,
          280,
        ),
      score,
      verificationLevel,
      url: project.submission?.demoUrl || project.submission?.githubUrl,
    });
    await this.ledger.record(userId, {
      kind:
        verificationLevel === 'mentor'
          ? 'project_mentor_approved'
          : 'project_ai_reviewed',
      title: `Project proof added: ${project.title}`,
      detail:
        project.caseStudy?.slice(0, 200) ||
        `Added ${project.title} to your Skill Passport.`,
      score,
      skills: (project.techStack ?? []).slice(0, 4),
      verificationLevel: verificationLevel === 'mentor' ? 'mentor' : 'ai',
      evidenceRef: projectId,
    });
    return created;
  }

  listEvidence(userId: string): Promise<SkillEvidenceDocument[]> {
    return this.evidenceModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async removeEvidence(userId: string, id: string): Promise<{ ok: true }> {
    // A malformed evidence id is a bad request, not a 500 from a failed cast.
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid evidence id');
    await this.evidenceModel
      .deleteOne({
        _id: new Types.ObjectId(id),
        user: new Types.ObjectId(userId),
      })
      .exec();
    return { ok: true };
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
