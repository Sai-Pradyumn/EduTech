import { Injectable, NgZone, inject } from '@angular/core';
import { ProductAnalyticsService } from './product-analytics.service';

/** lib.dom doesn't type these performance entries yet. */
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}
interface EventTimingEntry extends PerformanceEntry {
  interactionId?: number;
}

type VitalName = 'LCP' | 'CLS' | 'INP';

/** web.dev "good"/"poor" thresholds per metric. */
const THRESHOLDS: Record<VitalName, [good: number, poor: number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
};

/**
 * Dependency-free Core Web Vitals collector (backlog §9). Observes LCP, CLS and
 * INP (max interaction duration — a close approximation) via PerformanceObserver
 * and reports each once per page load through the existing product-analytics
 * `track()` channel (`web_vital` event), the first time the tab is hidden.
 * Observation runs outside the Angular zone so it never triggers change detection;
 * failures are swallowed — telemetry must never affect UX.
 */
@Injectable({ providedIn: 'root' })
export class WebVitalsService {
  private readonly analytics = inject(ProductAnalyticsService);
  private readonly zone = inject(NgZone);

  private lcp = 0;
  private cls = 0;
  private inp = 0;
  private flushed = false;

  start(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.observe('largest-contentful-paint', (entries) => {
        const last = entries[entries.length - 1];
        if (last) this.lcp = Math.round(last.startTime);
      });
      this.observe('layout-shift', (entries) => {
        for (const e of entries as LayoutShiftEntry[]) {
          if (!e.hadRecentInput) this.cls += e.value;
        }
      });
      this.observe('event', (entries) => {
        for (const e of entries as EventTimingEntry[]) {
          if (e.interactionId) this.inp = Math.max(this.inp, Math.round(e.duration));
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush();
      });
    });
  }

  private observe(type: string, cb: (entries: PerformanceEntry[]) => void): void {
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
      const po = new PerformanceObserver((list) => cb(list.getEntries()));
      po.observe({ type, buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    } catch {
      /* Unsupported entry type on this browser — skip silently. */
    }
  }

  private flush(): void {
    if (this.flushed) return;
    this.flushed = true;
    const path = location.pathname.slice(0, 120);
    const vitals: [VitalName, number][] = [
      ['LCP', this.lcp],
      ['CLS', Math.round(this.cls * 1000) / 1000],
      ['INP', this.inp],
    ];
    for (const [name, value] of vitals) {
      if (value <= 0) continue;
      this.analytics.track('web_vital', { name, value, rating: this.rating(name, value), path });
    }
  }

  private rating(name: VitalName, value: number): string {
    const [good, poor] = THRESHOLDS[name];
    return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
  }
}
