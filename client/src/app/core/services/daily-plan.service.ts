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
  note: string;
}

export interface DailyPlan {
  id: string;
  date: string;
  mode: DailyPlanMode;
  totalMinutes: number;
  items: DailyItem[];
  completed: number;
}

export interface DailyStreak {
  current: number;
  best: number;
  activeToday: boolean;
  totalActiveDays: number;
}

export interface DailyDay {
  date: string;
  completed: number;
  total: number;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class DailyPlanService {
  private readonly api = inject(ApiService);

  today(): Observable<DailyPlan> { return this.api.get<DailyPlan>('/daily-plan/today'); }
  generate(mode: DailyPlanMode): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/generate', { mode }); }
  completeItem(itemId: string): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/complete-item', { itemId }); }
  setItemNote(itemId: string, note: string): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/item-note', { itemId, note }); }
  carryOver(): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/carry-over', {}); }
  recalculate(): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/recalculate', {}); }
  quickMode(): Observable<DailyPlan> { return this.api.post<DailyPlan>('/daily-plan/quick-mode', {}); }
  streak(): Observable<DailyStreak> { return this.api.get<DailyStreak>('/daily-plan/streak'); }
  history(days = 7): Observable<DailyDay[]> { return this.api.get<DailyDay[]>('/daily-plan/history', { days }); }
}

export const DAILY_KIND_GLYPH: Record<DailyItemKind, string> = {
  flow_node: '🧭', mistake: '⚠', quiz: '✓', revision: '▤', project: '⬢',
};
