import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export type ProductEventName =
  | 'signup_started'
  | 'signup_completed'
  | 'onboarding_completed'
  | 'roadmap_generated'
  | 'flow_generated'
  | 'quiz_completed'
  | 'project_submitted'
  | 'tutor_used'
  | 'voice_session_started'
  | 'study_space_created'
  | 'certificate_issued'
  | 'portfolio_published'
  | 'billing_upgrade_clicked'
  | 'subscription_started'
  | 'trial_started'
  | 'trial_converted'
  | 'user_returned'
  | 'web_vital';

/**
 * Product analytics emitter (Phase 10 · M8). Fire-and-forget `track()` from key user
 * actions. Only whitelisted events + primitive props are accepted server-side, so no
 * learning content or PII leaks. Failures are swallowed — analytics never block UX.
 */
@Injectable({ providedIn: 'root' })
export class ProductAnalyticsService {
  private readonly api = inject(ApiService);
  private readonly sessionId = `s_${Math.random().toString(36).slice(2, 10)}`;

  track(event: ProductEventName, properties?: Record<string, string | number | boolean>): void {
    this.api
      .post('/analytics/track', { event, properties, sessionId: this.sessionId })
      .subscribe({ error: () => undefined });
  }
}
