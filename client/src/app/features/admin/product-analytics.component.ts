import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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

    <!-- Retention (active users over time) — previously-unused /retention endpoint -->
    <div class="card mb-5" style="padding:18px">
      <div class="flex items-center justify-between mb-3">
        <p class="kicker">Active users · last {{ retention().length }} days</p>
        @if (retentionPeak() > 0) { <span class="font-mono text-xs text-txt-mute">peak {{ retentionPeak() }}</span> }
      </div>
      @if (retention().length) {
        <div class="ret-chart" role="img" aria-label="Daily active users trend">
          @for (d of retention(); track d.day) {
            <div class="ret-col" [title]="d.day + ' · ' + d.activeUsers + ' active'">
              <span class="ret-bar" [style.height.%]="barPct(d.activeUsers)"></span>
            </div>
          }
        </div>
        <div class="flex justify-between text-[10px] text-txt-mute font-mono mt-1.5">
          <span>{{ retention()[0].day }}</span>
          <span>{{ retention()[retention().length - 1].day }}</span>
        </div>
      } @else {
        <p class="text-sm text-txt-mute">No retention data yet.</p>
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
  styles: [`
    .skel{background:linear-gradient(90deg,var(--paper-2) 25%,var(--paper-3) 50%,var(--paper-2) 75%);background-size:200% 100%;animation:s 1.4s ease infinite}@keyframes s{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.skel{animation:none}}
    .ret-chart{display:flex;align-items:flex-end;gap:2px;height:84px}
    .ret-col{flex:1;height:100%;display:flex;align-items:flex-end;min-width:2px}
    .ret-bar{display:block;width:100%;border-radius:3px 3px 0 0;background:linear-gradient(180deg,var(--green),var(--green-deep));min-height:2px;transition:height .4s var(--ease)}
    .ret-col:hover .ret-bar{background:var(--peri,#8aa6ff)}
  `],
})
export class AdminProductAnalyticsComponent implements OnInit {
  private readonly ops = inject(OpsService);
  readonly overview = signal<Overview | null>(null);
  readonly funnels = signal<Funnel[]>([]);
  readonly retention = signal<{ day: string; activeUsers: number }[]>([]);

  readonly retentionPeak = computed(() =>
    this.retention().reduce((m, d) => Math.max(m, d.activeUsers), 0),
  );

  ngOnInit(): void {
    this.ops.productOverview().subscribe({ next: (o) => this.overview.set(o) });
    this.ops.funnels().subscribe({ next: (f) => this.funnels.set(f) });
    this.ops.retention().subscribe({ next: (r) => this.retention.set(r) });
  }

  barPct(value: number): number {
    const peak = this.retentionPeak();
    return peak > 0 ? Math.max(4, Math.round((value / peak) * 100)) : 0;
  }

  pretty(event: string): string {
    return event.replace(/_/g, ' ');
  }
}
