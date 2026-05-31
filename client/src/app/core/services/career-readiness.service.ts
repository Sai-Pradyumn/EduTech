import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface SkillGap { skill: string; current: number; target: number; gap: number; met: boolean }
export interface ReadinessDimension {
  key: 'skills' | 'projects' | 'interview' | 'consistency' | 'portfolio';
  label: string;
  score: number;
  weight: number;
  supports: string[];
  missing: string[];
  fastestAction: string;
}
export interface PlanItem {
  day: number;
  title: string;
  reason: string;
  route: string;
  kind: 'flow' | 'quiz' | 'project' | 'simulation' | 'interview' | 'mistake' | 'visual';
}
export interface ReadinessAnalysis {
  role: { id: string; title: string; level: string; summary: string };
  readinessScore: number;
  band: 'early' | 'building' | 'close' | 'ready';
  dimensions: ReadinessDimension[];
  skillGaps: SkillGap[];
  projectGap: { have: number; need: number; note: string; met: boolean };
  interviewGap: { score: number; expectations: string[]; met: boolean };
  portfolioChecklist: { item: string; done: boolean }[];
  blockers: { title: string; impact: string }[];
  weekPlan: PlanItem[];
  recommendations: { flows: string[]; quizzes: string[]; projects: string[]; simulations: string[] };
  explanation: string;
  lastAnalyzedAt: string;
}
export interface CareerRoleSummary { id: string; title: string; level: string; summary: string; requiredSkills: string[] }

@Injectable({ providedIn: 'root' })
export class CareerReadinessService {
  private readonly api = inject(ApiService);

  me(): Observable<ReadinessAnalysis> { return this.api.get<ReadinessAnalysis>('/career-readiness/me'); }
  analyze(): Observable<ReadinessAnalysis> { return this.api.post<ReadinessAnalysis>('/career-readiness/analyze'); }
  roles(): Observable<CareerRoleSummary[]> { return this.api.get<CareerRoleSummary[]>('/career-readiness/roles'); }
  setTargetRole(roleId: string): Observable<ReadinessAnalysis> { return this.api.post<ReadinessAnalysis>('/career-readiness/set-target-role', { roleId }); }
}
