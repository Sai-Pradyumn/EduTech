import { Injectable } from '@nestjs/common';
import { AgentType, CareerTarget, Intent, SkillLevel } from '../../../common/enums';
import { AgentResponse, SkillGapBlock, StudyPlanBlock, VisualBlock } from '../../ai/types/agent.types';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';
import { LlmComposerService } from '../core/llm-composer.service';
import { personaFor } from '../prompts/personas';

const TARGET: Record<CareerTarget, { label: string; bar: number; focus: string[] }> = {
  [CareerTarget.Internship]: { label: 'an internship', bar: 70, focus: ['DSA basics', '1 solid project', 'resume', 'communication'] },
  [CareerTarget.FullTime]: { label: 'a full-time SDE role', bar: 85, focus: ['DSA depth', '2–3 strong projects', 'system design basics', 'behavioral stories'] },
  [CareerTarget.Freelancing]: { label: 'freelancing', bar: 80, focus: ['a niche skill', 'a portfolio', 'client communication', 'delivery process'] },
  [CareerTarget.Startup]: { label: 'a startup role', bar: 80, focus: ['full-stack breadth', 'shipping speed', 'ownership stories', 'a launched project'] },
  [CareerTarget.HigherStudies]: { label: 'higher studies', bar: 80, focus: ['fundamentals depth', 'research/projects', 'GRE/exam prep', 'SOP'] },
  [CareerTarget.SkillImprovement]: { label: 'leveling up your skills', bar: 75, focus: ['consistent practice', 'projects', 'spaced revision', 'feedback loops'] },
};

const BASELINE: Record<SkillLevel, number> = {
  [SkillLevel.Beginner]: 35,
  [SkillLevel.Intermediate]: 55,
  [SkillLevel.Advanced]: 72,
};

/**
 * Career agent — turns the profile (career target, skills, weak areas) + roadmap into a
 * skill-gap map, a readiness read, and a concrete interview/resume plan. Grounded in the
 * student's own data, not generic advice.
 */
@Injectable()
export class CareerAgentService implements IAgent {
  readonly type = AgentType.Career;

  constructor(private readonly composer: LlmComposerService) {}

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    const profile = ctx.profile;
    const target = TARGET[profile?.careerTarget ?? CareerTarget.SkillImprovement];
    const baseline = BASELINE[profile?.currentSkillLevel ?? SkillLevel.Beginner];

    ctx.emit({ type: 'thinking', messageId: '', label: `Mapping your skills against ${target.label}` });
    ctx.emit({ type: 'tool_call', messageId: '', tool: 'career.gap', label: 'Computing skill gaps & readiness' });

    const skills = this.buildSkills(profile?.currentSkills ?? [], profile?.weakAreas ?? [], baseline, target.bar);
    const readiness = skills.length
      ? Math.round(skills.reduce((s, k) => s + Math.min(100, (k.current / k.target) * 100), 0) / skills.length)
      : baseline;

    ctx.emit({ type: 'tool_result', messageId: '', tool: 'career.gap', summary: `Readiness ~${readiness}% for ${target.label}` });

    const gapBlock: SkillGapBlock = { type: 'skill_gap', title: `Skill gap → ${target.label}`, skills };
    const planBlock: StudyPlanBlock = {
      type: 'study_plan',
      title: 'Your 4-step readiness plan',
      items: target.focus.map((f, i) => ({ label: `${i + 1}. ${this.titleCase(f)}`, kind: 'career' })),
    } satisfies VisualBlock;

    const fallback = this.buildAnswer(profile?.fullName?.split(' ')[0], target.label, readiness, skills, ctx);
    const biggest = [...skills].sort((a, b) => b.target - b.current - (a.target - a.current))[0];
    const system =
      `${personaFor(AgentType.Career)}\n` +
      `Target: ${target.label}. Computed readiness: ~${readiness}%. ` +
      `Biggest gap: ${biggest ? `${biggest.skill} (${biggest.current}/${biggest.target})` : 'n/a'}. ` +
      `Focus areas for this target: ${target.focus.join(', ')}. Ground your coaching in these numbers.`;
    const answer = await this.composer.streamAnswer(ctx, {
      system,
      fallback,
      agentType: AgentType.Career,
      operation: 'career.assess',
      temperature: 0.5,
    });
    ctx.emit({ type: 'visual_block', messageId: '', block: gapBlock });
    ctx.emit({ type: 'visual_block', messageId: '', block: planBlock });

    return {
      agentType: AgentType.Career,
      intent: Intent.CareerGuidance,
      mode: 'mixed',
      answer,
      actions: [
        { id: 'interview', label: 'Mock interview me', kind: 'ask_interviewer' },
        { id: 'resume', label: 'Review my resume bullets', kind: 'custom', payload: { topic: 'resume' } },
        { id: 'project', label: 'Suggest a portfolio project', kind: 'open_route', payload: { route: '/app/projects' } },
      ],
      visualBlocks: [gapBlock, planBlock],
      confidence: 0.86,
      followUpQuestions: [
        `What projects impress recruiters for ${target.label}?`,
        'Turn my experience into strong resume bullets',
        'What will my first interview round look like?',
      ],
      recommendedNextActions: [
        skills[0] ? `Close your biggest gap first: ${skills.sort((a, b) => (b.target - b.current) - (a.target - a.current))[0].skill}` : 'Add your skills in your profile to sharpen this map',
        'Build (or finish) one portfolio project in the Project Studio',
      ],
    };
  }

  private buildSkills(current: string[], weak: string[], baseline: number, bar: number) {
    const skills = new Map<string, number>();
    for (const s of current.slice(0, 5)) skills.set(this.titleCase(s), baseline);
    for (const w of weak.slice(0, 4)) {
      const key = this.titleCase(w);
      skills.set(key, Math.max(15, baseline - 25)); // weak areas score lower
    }
    if (skills.size === 0) {
      ['Core programming', 'Problem solving', 'Projects', 'Communication'].forEach((s) => skills.set(s, baseline));
    }
    return [...skills.entries()].slice(0, 6).map(([skill, val]) => ({ skill: this.short(skill), current: val, target: bar }));
  }

  private buildAnswer(
    name: string | undefined,
    targetLabel: string,
    readiness: number,
    skills: { skill: string; current: number; target: number }[],
    ctx: AgentRuntimeContext,
  ): string {
    const greet = name ? `${name}, ` : '';
    const band = readiness >= 75 ? 'you’re close — tighten the gaps and start applying' : readiness >= 50 ? 'solid base — a focused push gets you there' : 'early days — the plan below is your fastest route';
    const biggest = [...skills].sort((a, b) => (b.target - b.current) - (a.target - a.current))[0];
    return [
      `${greet}here's your readiness read for **${targetLabel}**.`,
      '',
      `**Readiness: ~${readiness}%** — ${band}.`,
      biggest ? `\n**Biggest lever:** ${biggest.skill} (currently ${biggest.current}, target ${biggest.target}). Closing this moves the needle most.` : '',
      ctx.roadmap ? `\nYour roadmap *"${ctx.roadmap.title}"* already covers a lot of this — stay on it.` : '\nTip: generate a roadmap so this plan has a week-by-week structure.',
      '',
      `The skill-gap chart and a 4-step plan are on the right. Want a mock interview to pressure-test it?`,
    ].filter(Boolean).join('\n');
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  private short(s: string): string {
    return s.length > 16 ? `${s.slice(0, 15)}…` : s;
  }
}
