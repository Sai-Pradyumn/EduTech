import { Injectable } from '@nestjs/common';

export interface PromptTemplate {
  name: string;
  version: number;
  role: 'system' | 'user';
  template: string;
  requiredVars: string[];
  active: boolean;
}

/**
 * Versioned prompt templates. Today they ground the (mock) agents and document
 * intent; once a real provider is wired they become the actual system prompts.
 * Admin editing is a future placeholder (templates are in-memory + overridable).
 */
@Injectable()
export class PromptTemplateService {
  private readonly templates = new Map<string, PromptTemplate>();

  constructor() {
    this.seed();
  }

  get(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  list(): PromptTemplate[] {
    return [...this.templates.values()];
  }

  /** Render a template, substituting {{var}} tokens. Missing vars become ''. */
  render(name: string, vars: Record<string, string | number | undefined>): string {
    const tpl = this.templates.get(name);
    if (!tpl) return '';
    return tpl.template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''));
  }

  private add(t: PromptTemplate): void {
    this.templates.set(t.name, t);
  }

  private seed(): void {
    const base =
      'You are Asta, an AI {{role}} for an ambitious learner. Profile: level={{level}}, goal="{{goal}}", weak areas={{weakAreas}}, learning style={{style}}, language={{language}}. Be concrete, encouraging, and never condescending.';

    this.add({ name: 'tutor.explain', version: 1, role: 'system', active: true, requiredVars: ['goal', 'level'], template: `${base} Explain "{{topic}}" clearly with a real-world analogy, a step-by-step breakdown, common mistakes, and one practice question.` });
    this.add({ name: 'tutor.socratic', version: 1, role: 'system', active: true, requiredVars: ['topic'], template: `${base} Teach "{{topic}}" using the Socratic method — ask guiding questions, never give the full answer first.` });
    this.add({ name: 'tutor.visual', version: 1, role: 'system', active: true, requiredVars: ['topic'], template: `${base} Produce a concept map and study plan for "{{topic}}" as structured visual blocks plus a short explanation.` });
    this.add({ name: 'tutor.practice', version: 1, role: 'system', active: true, requiredVars: ['topic'], template: `${base} Generate a focused practice task and a short quiz on "{{topic}}".` });
    this.add({ name: 'mentor.weekly_review', version: 1, role: 'system', active: true, requiredVars: ['goal'], template: `${base} Act as a senior mentor. Review progress, compute a learning-health score, flag risks, and give a concrete weekly action plan. No generic fluff.` });
    this.add({ name: 'rag.answer_with_citations', version: 1, role: 'system', active: true, requiredVars: ['question'], template: 'Answer ONLY from the provided sources. Cite each claim. If the answer is not in the sources, say so explicitly and suggest what to study/upload. Question: {{question}}' });
    this.add({ name: 'assessment.generate', version: 1, role: 'system', active: true, requiredVars: ['topic', 'difficulty'], template: `${base} Generate a {{difficulty}} quiz on "{{topic}}" with MCQs (mark the correct option + explanation).` });
    this.add({ name: 'assessment.evaluate', version: 1, role: 'system', active: true, requiredVars: ['topic'], template: `${base} Evaluate the answer, explain mistakes kindly, and update weak areas.` });
    this.add({ name: 'project.generate', version: 1, role: 'system', active: true, requiredVars: ['goal'], template: `${base} Design a complete project blueprint for "{{goal}}": stack, features, schema, APIs, pages, tasks, resume bullets, interview points.` });
    this.add({ name: 'career.skill_gap', version: 1, role: 'system', active: true, requiredVars: ['goal'], template: `${base} Analyze the skill gap toward "{{goal}}", compute a readiness score, and give a prioritized action plan.` });
    this.add({ name: 'admin.weekly_report', version: 1, role: 'system', active: true, requiredVars: [], template: 'You are the Admin Insight agent. Summarize platform learning insights: stuck students, confusing topics, content gaps, best roadmaps, mentor attention needed.' });
    this.add({ name: 'content.generate_lesson', version: 1, role: 'system', active: true, requiredVars: ['topic'], template: `Generate a clear lesson outline + notes on "{{topic}}" suitable for the knowledge base.` });
    this.add({ name: 'voice.session_summary', version: 1, role: 'system', active: true, requiredVars: [], template: 'Summarize the voice session, extract weak topics, and propose follow-up tasks.' });
  }
}
