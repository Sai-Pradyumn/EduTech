import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type SimulationType =
  | 'interview' | 'viva' | 'debugging' | 'system_design' | 'code_walkthrough'
  | 'product_thinking' | 'mentor_review' | 'group_discussion' | 'client_requirements' | 'teaching_back';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SimRubric { criterion: string; weight: number; score: number; }
export interface SimTurn { role: 'user' | 'coach'; text: string; at: string; }

export interface Simulation {
  id: string;
  type: SimulationType;
  topic: string;
  difficulty: Difficulty;
  role: string;
  scenario: string;
  rubric: SimRubric[];
  transcript: SimTurn[];
  score: number;
  feedback: string;
  improvementPlan: string[];
  linkedSkills: string[];
  linkedMistakeIds: string[];
  linkedFlowId: string | null;
  status: 'active' | 'finished';
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SimulationService {
  private readonly api = inject(ApiService);

  list(): Observable<Simulation[]> { return this.api.get<Simulation[]>('/simulations'); }
  get(id: string): Observable<Simulation> { return this.api.get<Simulation>(`/simulations/${id}`); }
  start(body: { type: SimulationType; topic: string; difficulty?: Difficulty }): Observable<Simulation> { return this.api.post<Simulation>('/simulations/start', body); }
  respond(id: string, message: string): Observable<Simulation> { return this.api.post<Simulation>(`/simulations/${id}/respond`, { message }); }
  finish(id: string): Observable<Simulation> { return this.api.post<Simulation>(`/simulations/${id}/finish`, {}); }
  retry(id: string, harder: boolean): Observable<Simulation> { return this.api.post<Simulation>(`/simulations/${id}/retry`, { harder }); }
  createRepairFlow(id: string): Observable<{ simulation: Simulation; flowId: string | null; nodeId: string | null }> { return this.api.post(`/simulations/${id}/create-repair-flow`, {}); }
  remove(id: string): Observable<{ ok: true }> { return this.api.delete<{ ok: true }>(`/simulations/${id}`); }
}

export const SIM_TYPE_META: Record<SimulationType, { label: string; glyph: string }> = {
  interview: { label: 'Interview', glyph: '💼' },
  viva: { label: 'Viva', glyph: '🗣' },
  debugging: { label: 'Debugging', glyph: '🐞' },
  system_design: { label: 'System design', glyph: '🏗' },
  code_walkthrough: { label: 'Code walkthrough', glyph: '👣' },
  product_thinking: { label: 'Product thinking', glyph: '💡' },
  mentor_review: { label: 'Mentor review', glyph: '🧑‍🏫' },
  group_discussion: { label: 'Group discussion', glyph: '👥' },
  client_requirements: { label: 'Client requirements', glyph: '📋' },
  teaching_back: { label: 'Teaching back', glyph: '🎓' },
};

export const SIM_TYPE_LIST: SimulationType[] = ['interview', 'viva', 'debugging', 'system_design', 'code_walkthrough', 'product_thinking', 'mentor_review', 'group_discussion', 'client_requirements', 'teaching_back'];
