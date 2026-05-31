import { Injectable } from '@nestjs/common';
import { SkillPassportService } from '../skill-passport/skill-passport.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { SkillTwinService } from '../skill-twin/skill-twin.service';
import { LedgerService } from '../ledger/ledger.service';
import { ResumeService } from '../resume/resume.service';
import { ApplicationService } from '../resume/application.service';

/**
 * Phase 9 · Privacy, Export & Reset — gives the learner real control over the proof/outcome data
 * Phase 9 creates: export everything as JSON, take the public profile/portfolio private in one click,
 * reset the Skill Twin, and clear the application tracker. All scoped to the requesting user.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly passport: SkillPassportService,
    private readonly portfolio: PortfolioService,
    private readonly twin: SkillTwinService,
    private readonly ledger: LedgerService,
    private readonly resume: ResumeService,
    private readonly applications: ApplicationService,
  ) {}

  /** A summary of what is currently public + data counts (drives the privacy settings page). */
  async settings(userId: string): Promise<Record<string, unknown>> {
    const [pv, pf, ledgerSummary] = await Promise.all([
      this.passport.getMe(userId),
      this.portfolio.getMe(userId),
      this.ledger.summary(userId),
    ]);
    return {
      passport: { username: pv.username, visibility: pv.visibility, publicSettings: pv.publicSettings },
      portfolio: { username: pf.username, status: pf.status },
      proof: { total: ledgerSummary.total, public: ledgerSummary.publicCount },
    };
  }

  /** Export the learner's outcome data as a single JSON object. */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const [passport, portfolio, ledger, resume, applications, evidence] = await Promise.all([
      this.passport.getMe(userId),
      this.portfolio.getMe(userId),
      this.ledger.list(userId, 500),
      this.resume.getMe(userId),
      this.applications.list(userId),
      this.passport.listEvidence(userId),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      skillPassport: passport,
      portfolio,
      resume,
      proofLedger: ledger.map((e) => ({ kind: e.kind, title: e.title, detail: e.detail, score: e.score ?? null, skills: e.skills, verificationLevel: e.verificationLevel, at: e.at.toISOString() })),
      manualEvidence: evidence.map((e) => ({ skill: e.skill, summary: e.summary, sourceType: e.sourceType, verificationLevel: e.verificationLevel })),
      applications: applications.map((a) => ({ company: a.company, role: a.role, status: a.status, matchScore: a.matchScore })),
    };
  }

  /** Take everything public → private (passport + portfolio). */
  async makePrivate(userId: string): Promise<{ ok: true }> {
    await this.passport.setVisibility(userId, 'private');
    await this.portfolio.setStatus(userId, 'draft');
    return { ok: true };
  }

  async resetSkillTwin(userId: string): Promise<{ clearedMistakes: number }> {
    return this.twin.resetMemory(userId);
  }

  async clearApplications(userId: string): Promise<{ deleted: number }> {
    return this.applications.clearAll(userId);
  }
}
