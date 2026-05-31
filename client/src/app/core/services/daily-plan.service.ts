import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type DailyPlanMode = 'normal' | 'quick' | 'exam' | 'burnout_recovery';
export type DailyItemKind = 'flow_node' | 'mistake' | 'quiz' | 'revision' | 'project';

export interface DailyItem {
  id: string;
  kind: DailyItemKind;
  title: string;
  reason: string;
  route: string;
  estimateMinutes: number;
  done: boolean;
  sourceId: string | null;
}

export interface DailyPlan {
  id: string;
  date: string;
  mode: DailyPlanMode;
  totalMinutes: number;
  items: DailyItem[];
  completed: number;
}

@Injectable({ providedIn: 'root' })
export class DailyPlanService {
  private readonly api = inject(ApiService);

  today(): Observable<DailyPlan> { return this.api.get<DailyPlan>('/daily-plan/today'); }
  generate(mode: DailyPlanMode): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/generate', { mode }); }
  completeItem(itemId: string): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/complete-item', { itemId }); }
  recalculate(): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/recalculate', {}); }
  quickMode(): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/quick-mode', {}); }
}

export const DAILY_KIND_GLYPH: Record<DailyItemKind, string> = {
  flow_node: '🧭', mistake: '⚠', quiz: '✓', revision: '▤', project: '⬢',
};
