import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AiUsageReport, StudentOutcomesReport, WeakTopicRow } from '../models';

/** Enterprise reports API (Phase 4 · B16) — JSON views + CSV download. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ApiService);

  students(): Observable<StudentOutcomesReport> {
    return this.api.get<StudentOutcomesReport>('/reports/students');
  }

  weakTopics(): Observable<WeakTopicRow[]> {
    return this.api.get<WeakTopicRow[]>('/reports/weak-topics');
  }

  aiUsage(): Observable<AiUsageReport> {
    return this.api.get<AiUsageReport>('/reports/ai-usage');
  }

  /** Fetches a CSV report and triggers a browser download. */
  downloadCsv(report: 'students' | 'weak-topics' | 'ai-usage'): Observable<string> {
    return this.api.getText(`/reports/${report}.csv`);
  }
}
