import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type Modality = 'read' | 'voice' | 'quiz' | 'project' | 'visual' | 'mentor' | 'simulation';

export interface TwinAction {
  id: string;
  label: string;
  reason: string;
  route: string;
  modality: Modality;
  kind: 'repair' | 'flow' | 'quiz' | 'project' | 'visual' | 'voice' | 'explore';
}

export interface SkillTwinTrendPoint {
  at: string;
  readiness: number;
  health: number;
  retentionRisk: number;
  burnoutRisk: number;
}

export interface SkillTwinAdvisory {
  tone: 'positive' | 'warning' | 'info';
  text: string;
}

export interface SkillTwin {
  hasData: boolean;
  headline: string;
  readinessScore: number;
  healthScore: number;
  retentionRisk: number;
  burnoutRisk: number;
  pace: 'behind' | 'steady' | 'ahead';
  projectedDaysToGoal: number | null;
  preferredModality: Modality;
  modality: { modality: Modality; reason: string };
  skills: { skill: string; mastery: number; target: number }[];
  strengths: string[];
  weaknessRoots: { concept: string; severity: number; frequency: number; source: string; status: string }[];
  misconceptionMemory: { concept: string; type: string; frequency: number }[];
  nextBestActions: TwinAction[];
  signals: { label: string; detail: string }[];
  trend: SkillTwinTrendPoint[];
  readinessDelta: number | null;
  advisories: SkillTwinAdvisory[];
}

@Injectable({ providedIn: 'root' })
export class SkillTwinService {
  private readonly api = inject(ApiService);

  get(): Observable<SkillTwin> {
    return this.api.get<SkillTwin>('/skill-twin');
  }

  reset(): Observable<{ clearedMistakes: number }> {
    return this.api.post<{ clearedMistakes: number }>('/skill-twin/reset', {});
  }
}

export const MODALITY_META: Record<Modality, { label: string; glyph: string }> = {
  read: { label: 'Read / revise', glyph: '▤' },
  voice: { label: 'Voice', glyph: '🎙' },
  quiz: { label: 'Quiz', glyph: '✓' },
  project: { label: 'Project', glyph: '⬢' },
  visual: { label: 'Visual', glyph: '◈' },
  mentor: { label: 'Mentor', glyph: '☺' },
  simulation: { label: 'Simulation', glyph: '⚙' },
};
