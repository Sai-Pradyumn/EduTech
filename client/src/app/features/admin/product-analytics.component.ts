import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { OpsService } from '../../core/services/ops.service';

interface Funnel {
  name: string;
  steps: { event: string; users: number; conversionPct: number }[];
}
interface Overview {
  dau: number;
  wau: number;
  totalEvents: number;
  byEvent: { event: string; count: number }[];
}

/** Product analytics dashboard (Phase 10 · M8). Role.Admin. Active users, funnels and
 *  event volume — privacy-respecting (event names + counts only). */
@Component({
  selector: 'asta-admin-product-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Product analytics</h1>
        <span class="goal-pill"><span class="dot"></span>activation · funnels · retention</span>
      </div>
    </header>

    @if (overview(); as o) {
      <div class="grid gap-3 sm:grid-cols-3 mb-5">
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.dau }}</p><p class="t-label mt-1">Daily active</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.wau }}</p><p class="t-label mt-1">Weekly active</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.totalEvents }}</p><p class="t-label mt-1">Events (30d)</p></div>
      </div>
    } @else {
      <span class="skel" style="display:block;height:80px;border-radius:12px;margin-bottom:20px"></span>
    }

    <div class="grid gap-5 md:grid-cols-3 mb-5">
      @for (f of funnels(); track f.name) {
        <div class="card" style="padding:18px">
          <p class="kicker mb-3">{{ f.name }} funnel</p>
          <div class="space-y-2.5">
            @for (s of f.steps; track s.event) {
              <div>
                <div class="flex items-center justify-between text-sm mb-1">
                  <span class="truncate">{{ pretty(s.event) }}</span>
                  <span class="font-mono text-txt-mute">{{ s.users }} · {{ s.conversionPct }}%</span>
                </div>
                <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--paper-3)">
                  <div class="h-full rounded-full" style="background:var(--green)" [style.width.%]="s.conversionPct"></div>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <div class="card" style="padding:18px">
      <p class="kicker mb-3">Event volume (30d)</p>
      @if (overview(); as o) {
        <div class="space-y-1">
          @for (e of o.byEvent; track e.event) {
            <div class="flex items-center justify-between text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
              <span>{{ pretty(e.event) }}</span>
              <span class="font-mono text-txt-mute">{{ e.count }}</span>
            </div>
          } @empty { <p class="text-sm text-txt-mute">No events yet.</p> }
        </div>
      }
    </div>
  `,
  styles: [`.skel{background:linear-gradient(90deg,var(--paper-2) 25%,var(--paper-3) 50%,var(--paper-2) 75%);background-size:200% 100%;animation:s 1.4s ease infinite}@keyframes s{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.skel{animation:none}}`],
})
export class AdminProductAnalyticsComponent implements OnInit {
  private readonly ops = inject(OpsService);
  readonly overview = signal<Overview | null>(null);
  readonly funnels = signal<Funnel[]>([]);

  ngOnInit(): void {
    this.ops.productOverview().subscribe({ next: (o) => this.overview.set(o) });
    this.ops.funnels().subscribe({ next: (f) => this.funnels.set(f) });
  }

  pretty(event: string): string {
    return event.replace(/_/g, ' ');
  }
}
