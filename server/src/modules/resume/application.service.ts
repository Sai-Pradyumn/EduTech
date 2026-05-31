import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SkillPassportService } from '../skill-passport/skill-passport.service';
import { CareerReadinessService } from '../career-readiness/career-readiness.service';
import { Application, ApplicationDocument, ApplicationStatus } from './schemas/application.schema';
import { ApplicationAgent } from './resume.agents';
import { AnalyzeJdDto, CreateApplicationDto, UpdateApplicationDto } from './dto/resume.dto';
import { detectSkills } from './skill-vocab';

export interface JdMatch {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  tailoredSummary: string;
  coverLetter: string;
  prepPlan: string;
}

/** Phase 9 · ApplicationService — analyze a pasted JD against verified skills, tailor, and track. */
@Injectable()
export class ApplicationService {
  constructor(
    @InjectModel(Application.name) private readonly model: Model<ApplicationDocument>,
    private readonly passport: SkillPassportService,
    private readonly readiness: CareerReadinessService,
    private readonly agent: ApplicationAgent,
  ) {}

  /** Match a pasted JD against the learner's verified skills — no scraping, deterministic detection. */
  async analyzeJd(userId: string, dto: AnalyzeJdDto): Promise<JdMatch> {
    const [pv, analysis] = await Promise.all([this.passport.getMe(userId), this.readiness.getMe(userId)]);
    const learnerSkills = new Set<string>([
      ...pv.identity.topSkills,
      ...pv.skills.filter((s) => s.mastery > 0 || s.evidenceCount > 0).map((s) => s.skill),
      ...analysis.skillGaps.filter((g) => g.met).map((g) => g.skill),
    ].map((s) => s.toLowerCase()));

    const jdSkills = detectSkills(dto.jdText);
    const matched = jdSkills.filter((s) => [...learnerSkills].some((l) => l === s.toLowerCase() || l.includes(s.toLowerCase()) || s.toLowerCase().includes(l)));
    const missing = jdSkills.filter((s) => !matched.includes(s));
    const matchScore = jdSkills.length ? Math.round((matched.length / jdSkills.length) * 100) : analysis.readinessScore;

    const tailored = await this.agent.tailor(userId, pv.identity.name, dto.company, dto.role, matched, missing);
    const prepPlan =
      (analysis.blockers[0] ? `Before applying: ${analysis.blockers[0].title} — ${analysis.blockers[0].impact} ` : '') +
      (missing.length ? `Close these JD gaps fast: ${missing.slice(0, 4).join(', ')}. Build one project that uses them and add it to your passport.` : 'You match the core requirements — tailor your resume and apply.');

    return { matchScore, matchedSkills: matched, missingSkills: missing, tailoredSummary: tailored.tailoredSummary, coverLetter: tailored.coverLetter, prepPlan };
  }

  async create(userId: string, dto: CreateApplicationDto): Promise<ApplicationDocument> {
    const match = await this.analyzeJd(userId, dto);
    return this.model.create({
      user: new Types.ObjectId(userId),
      company: dto.company,
      role: dto.role,
      jdText: dto.jdText,
      status: 'saved',
      ...match,
    });
  }

  list(userId: string): Promise<ApplicationDocument[]> {
    return this.model.find({ user: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(60).exec();
  }

  async update(userId: string, id: string, dto: UpdateApplicationDto): Promise<ApplicationDocument> {
    const app = await this.model.findOne({ _id: new Types.ObjectId(id), user: new Types.ObjectId(userId) }).exec();
    if (!app) throw new NotFoundException('Application not found');
    if (dto.status !== undefined) app.status = dto.status as ApplicationStatus;
    if (dto.notes !== undefined) app.notes = dto.notes;
    await app.save();
    return app;
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    await this.model.deleteOne({ _id: new Types.ObjectId(id), user: new Types.ObjectId(userId) }).exec();
    return { ok: true };
  }

  /** Privacy — delete the learner's entire application tracker. */
  async clearAll(userId: string): Promise<{ deleted: number }> {
    const res = await this.model.deleteMany({ user: new Types.ObjectId(userId) }).exec();
    return { deleted: res.deletedCount ?? 0 };
  }
}
