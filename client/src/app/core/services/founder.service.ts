import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FounderDashboard } from '../models';

/** Founder / operator dashboard API (Phase 4 · B17) — platform-admin only. */
@Injectable({ providedIn: 'root' })
export class FounderService {
  private readonly api = inject(ApiService);

  overview(): Observable<FounderDashboard> {
    return this.api.get<FounderDashboard>('/founder/overview');
  }
}
