import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '../../common/enums';
import { AiService } from '../ai/ai.service';

/** Phase 9 · ResumeAgent — writes a resume summary grounded in verified evidence (LLM + fallback). */
@Injectable()
export class ResumeAgent {
  private readonly logger = new Logger(ResumeAgent.name);
  constructor(private readonly ai: AiService) {}

  async summary(userId: string, name: string, role: string, skills: string[], proofCount: number, projectCount: number): Promise<string> {
    const fallback =
      `${role} in the making with verifiable proof of work — ${proofCount} tracked learning events and ${projectCount} project(s). ` +
      `Core strengths: ${skills.slice(0, 5).join(', ') || 'a fast-growing foundation'}. Focused, consistent, and ready to contribute from day one.`;
    if (!this.ai.isLive) return fallback;
    try {
      const out = await this.ai.generateText(
        [
          { role: 'system', content: 'Write a 2-sentence first-person-free resume summary for the given candidate. Concrete, ATS-friendly, no buzzword soup, no markdown.' },
          { role: 'user', content: `Target role: ${role}. Skills: ${skills.join(', ')}. Verified events: ${proofCount}. Projects: ${projectCount}.` },
        ],
        { temperature: 0.5, maxTokens: 150, meta: { userId, agentType: AgentType.Career, operation: 'resume.summary' } },
      );
      return out?.trim() || fallback;
    } catch (err) {
      this.logger.warn(`Resume summary failed: ${(err as Error).message}`);
      return fallback;
    }
  }
}

export interface JdAnalysis {
  coverLetter: string;
  tailoredSummary: string;
}

/** Phase 9 · ApplicationAgent — writes a tailored cover letter for a pasted JD (LLM + fallback). */
@Injectable()
export class ApplicationAgent {
  private readonly logger = new Logger(ApplicationAgent.name);
  constructor(private readonly ai: AiService) {}

  async tailor(userId: string, name: string, company: string, role: string, matched: string[], missing: string[]): Promise<JdAnalysis> {
    const fallback: JdAnalysis = {
      tailoredSummary: `${role} candidate with verified strengths in ${matched.slice(0, 4).join(', ') || 'core fundamentals'}, actively closing ${missing.slice(0, 2).join(' and ') || 'remaining gaps'}.`,
      coverLetter:
        `Dear ${company} team,\n\n` +
        `I'm excited to apply for the ${role} role. My strongest, verifiable skills — ${matched.slice(0, 5).join(', ') || 'the fundamentals this role needs'} — map directly to what you're looking for, and I back every claim with real, tracked project and assessment evidence.\n\n` +
        (missing.length ? `I'm actively closing the gaps you value most (${missing.slice(0, 3).join(', ')}) through focused, daily practice.\n\n` : '') +
        `I'd welcome the chance to show how I work.\n\nBest regards,\n${name}`,
    };
    if (!this.ai.isLive) return fallback;
    try {
      const out = await this.ai.generateStructuredOutput<JdAnalysis>(
        [
          { role: 'system', content: 'Write a short, sincere cover letter (<= 140 words) and a 1-sentence tailored summary for this candidate and role. Honest about gaps. Return JSON {coverLetter, tailoredSummary}. No markdown.' },
          { role: 'user', content: `Candidate: ${name}. Company: ${company}. Role: ${role}. Matched skills: ${matched.join(', ')}. Missing: ${missing.join(', ')}.` },
        ],
        { type: 'object', properties: { coverLetter: { type: 'string' }, tailoredSummary: { type: 'string' } }, required: ['coverLetter', 'tailoredSummary'] },
        { temperature: 0.55, meta: { userId, agentType: AgentType.Career, operation: 'application.tailor' }, mockFactory: () => fallback },
      );
      return { coverLetter: out.coverLetter || fallback.coverLetter, tailoredSummary: out.tailoredSummary || fallback.tailoredSummary };
    } catch (err) {
      this.logger.warn(`JD tailor failed: ${(err as Error).message}`);
      return fallback;
    }
  }
}
