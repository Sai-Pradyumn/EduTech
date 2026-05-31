import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SkillPassportService } from '../skill-passport/skill-passport.service';
import { ProjectsService } from '../projects/services/projects.service';
import { Resume, ResumeDocument } from './schemas/resume.schema';
import { ResumeAgent } from './resume.agents';
import { UpdateResumeDto } from './dto/resume.dto';

/** Phase 9 · ResumeService — generate/edit a resume from verified Skill Passport evidence. */
@Injectable()
export class ResumeService {
  constructor(
    @InjectModel(Resume.name) private readonly model: Model<ResumeDocument>,
    private readonly passport: SkillPassportService,
    private readonly projects: ProjectsService,
    private readonly agent: ResumeAgent,
  ) {}

  async ensure(userId: string): Promise<ResumeDocument> {
    const existing = await this.model
      .findOne({ user: new Types.ObjectId(userId) })
      .exec();
    if (existing) return existing;
    const pv = await this.passport.getMe(userId);
    return this.model.create({
      user: new Types.ObjectId(userId),
      headline: pv.identity.targetRole,
      skills: pv.identity.topSkills,
    });
  }

  getMe(userId: string): Promise<ResumeDocument> {
    return this.ensure(userId);
  }

  async patchMe(userId: string, dto: UpdateResumeDto): Promise<ResumeDocument> {
    const doc = await this.ensure(userId);
    if (dto.headline !== undefined) doc.headline = dto.headline;
    if (dto.summary !== undefined) doc.summary = dto.summary;
    if (dto.skills !== undefined) doc.skills = dto.skills;
    if (dto.highlights !== undefined) doc.highlights = dto.highlights;
    await doc.save();
    return doc;
  }

  async generate(userId: string): Promise<ResumeDocument> {
    const doc = await this.ensure(userId);
    const [pv, projects] = await Promise.all([
      this.passport.getMe(userId),
      this.projects.list(userId),
    ]);
    doc.headline = pv.identity.targetRole;
    doc.skills = [
      ...new Set([...pv.identity.topSkills, ...pv.skills.map((s) => s.skill)]),
    ].slice(0, 14);
    doc.summary = await this.agent.summary(
      userId,
      pv.identity.name,
      pv.identity.targetRole,
      pv.identity.topSkills,
      pv.proofSummary.verifiedEvents,
      pv.proofSummary.projectsCompleted,
    );
    doc.highlights = [
      `${pv.proofSummary.verifiedEvents} verified learning events on a public Skill Passport`,
      pv.proofSummary.quizzesPassed
        ? `Passed ${pv.proofSummary.quizzesPassed} assessments across core topics`
        : '',
      pv.proofSummary.simulationsPassed
        ? `Completed ${pv.proofSummary.simulationsPassed} mock interview/simulation rounds`
        : '',
      pv.proofSummary.mistakesResolved
        ? `Diagnosed & resolved ${pv.proofSummary.mistakesResolved} recurring weak areas`
        : '',
    ].filter(Boolean);
    doc.projects = projects
      .filter((p) => p.status !== 'planning')
      .slice(0, 4)
      .map((p) => ({
        title: p.title,
        bullets: [
          p.caseStudy
            ? p.caseStudy.split('. ')[0]
            : `Built ${p.title} with ${(p.techStack ?? []).slice(0, 3).join(', ') || 'a modern stack'}.`,
          ...(p.features ?? [])
            .slice(0, 2)
            .map((f) => `Implemented ${f.toLowerCase()}.`),
          p.aiReview?.overallScore
            ? `AI-reviewed ${p.aiReview.overallScore}/100 for quality & architecture.`
            : '',
        ].filter(Boolean),
      }));
    doc.generatedAt = new Date();
    await doc.save();
    return doc;
  }
}
