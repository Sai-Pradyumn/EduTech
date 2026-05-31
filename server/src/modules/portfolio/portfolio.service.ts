import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SkillPassportService } from '../skill-passport/skill-passport.service';
import { ProjectsService } from '../projects/services/projects.service';
import { Portfolio, PortfolioDocument, PortfolioStatus } from './schemas/portfolio.schema';
import { PortfolioBuilderAgent } from './portfolio.agent';
import { UpdatePortfolioDto } from './dto/portfolio.dto';

/**
 * Phase 9 · Portfolio Builder — generates an editable, public-facing portfolio from the learner's
 * verified evidence (Skill Passport + projects + certificates), with AI-written copy and a public
 * route at /p/:username (reusing the Skill Passport username).
 */
@Injectable()
export class PortfolioService {
  constructor(
    @InjectModel(Portfolio.name) private readonly model: Model<PortfolioDocument>,
    private readonly passport: SkillPassportService,
    private readonly projects: ProjectsService,
    private readonly agent: PortfolioBuilderAgent,
  ) {}

  async ensure(userId: string): Promise<PortfolioDocument> {
    const existing = await this.model.findOne({ user: new Types.ObjectId(userId) }).exec();
    if (existing) return existing;
    const pv = await this.passport.getMe(userId);
    return this.model.create({
      user: new Types.ObjectId(userId),
      username: pv.username,
      title: `${pv.identity.name} — ${pv.identity.targetRole}`,
      tagline: pv.identity.headline,
      targetRole: pv.identity.targetRole,
      skills: pv.identity.topSkills,
      status: 'draft',
    });
  }

  async getMe(userId: string): Promise<PortfolioDocument> {
    return this.ensure(userId);
  }

  async patchMe(userId: string, dto: UpdatePortfolioDto): Promise<PortfolioDocument> {
    const doc = await this.ensure(userId);
    if (dto.title !== undefined) doc.title = dto.title;
    if (dto.tagline !== undefined) doc.tagline = dto.tagline;
    if (dto.about !== undefined) doc.about = dto.about;
    if (dto.targetRole !== undefined) doc.targetRole = dto.targetRole;
    if (dto.skills !== undefined) doc.skills = dto.skills;
    if (dto.links !== undefined) doc.links = dto.links;
    if (dto.theme !== undefined) doc.theme = dto.theme;
    if (dto.publicSettings) Object.assign(doc.publicSettings, dto.publicSettings);
    await doc.save();
    return doc;
  }

  /** Regenerate the portfolio from current evidence (AI copy + project case studies). */
  async generate(userId: string): Promise<PortfolioDocument> {
    const doc = await this.ensure(userId);
    const [pv, projects] = await Promise.all([this.passport.getMe(userId), this.projects.list(userId)]);

    doc.title = `${pv.identity.name} — ${pv.identity.targetRole}`;
    doc.tagline = pv.identity.headline;
    doc.targetRole = pv.identity.targetRole;
    doc.skills = pv.identity.topSkills;
    doc.about = await this.agent.about(userId, pv.identity.name, pv.identity.targetRole, pv.identity.topSkills, pv.proofSummary.verifiedEvents);

    // Build case studies for completed/submitted projects (cap to keep it tight).
    const featured = projects.filter((p) => p.status !== 'planning').slice(0, 4);
    const built = [];
    for (const p of featured) {
      const caseStudy = await this.agent.caseStudy(userId, p.title, p.techStack ?? [], p.features ?? [], p.aiReview?.overallScore ?? null);
      built.push({
        projectId: String(p._id),
        title: p.title,
        caseStudy,
        stack: p.techStack ?? [],
        highlights: (p.features ?? []).slice(0, 4),
        githubUrl: p.submission?.githubUrl,
        demoUrl: p.submission?.demoUrl,
        visible: true,
      });
    }
    doc.projects = built;
    doc.generatedAt = new Date();
    await doc.save();
    return doc;
  }

  /** Add a single reviewed project (with its case study) to the portfolio. */
  async addProject(userId: string, projectId: string): Promise<PortfolioDocument> {
    const doc = await this.ensure(userId);
    const project = await this.projects.get(userId, projectId);
    const caseStudy = project.caseStudy || (await this.agent.caseStudy(userId, project.title, project.techStack ?? [], project.features ?? [], project.aiReview?.overallScore ?? null));
    const entry = {
      projectId,
      title: project.title,
      caseStudy,
      stack: project.techStack ?? [],
      highlights: (project.features ?? []).slice(0, 4),
      githubUrl: project.submission?.githubUrl,
      demoUrl: project.submission?.demoUrl,
      visible: true,
    };
    const idx = doc.projects.findIndex((p) => p.projectId === projectId);
    if (idx >= 0) doc.projects[idx] = entry;
    else doc.projects.push(entry);
    await doc.save();
    return doc;
  }

  async setStatus(userId: string, status: PortfolioStatus): Promise<PortfolioDocument> {
    const doc = await this.ensure(userId);
    doc.status = status;
    if (status === 'published' && !doc.publishedAt) doc.publishedAt = new Date();
    await doc.save();
    return doc;
  }

  /** Public view (only when published) — merges live certificates/timeline from the passport. */
  async getPublic(username: string): Promise<Record<string, unknown>> {
    const doc = await this.model.findOne({ username: username.toLowerCase().trim() }).exec();
    if (!doc || doc.status !== 'published') throw new NotFoundException('This portfolio is not published or does not exist.');
    let certificates: { id: string; title: string; verificationId: string }[] = [];
    let timeline: { title: string; at: string }[] = [];
    try {
      const pv = await this.passport.getPublicByUsername(username);
      if (doc.publicSettings.showCertificates) certificates = pv.certificates.map((c) => ({ id: c.id, title: c.title, verificationId: c.verificationId }));
      if (doc.publicSettings.showTimeline) timeline = pv.timeline.slice(0, 8).map((t) => ({ title: t.title, at: t.at }));
    } catch {
      // Passport may be private even when the portfolio is public — that's fine.
    }
    return {
      username: doc.username,
      title: doc.title,
      tagline: doc.tagline,
      about: doc.about,
      targetRole: doc.targetRole,
      skills: doc.skills,
      projects: doc.publicSettings.showProjects ? doc.projects.filter((p) => p.visible) : [],
      links: doc.publicSettings.showContact ? doc.links : [],
      theme: doc.theme,
      certificates,
      timeline,
    };
  }
}
