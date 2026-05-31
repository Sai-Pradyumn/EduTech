import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AiOpsOverview, OpsService } from '../../core/services/ops.service';

interface Costs {
  byDay: { day: string; costUsd: number; calls: number }[];
  byFeature: { feature: string; costUsd: number; calls: number; tokens: number }[];
  topUsers: { userId: string; name: string; email: string; costUsd: number; calls: number }[];
}
interface Providers {
  strategy: string;
  live: boolean;
  providers: { name: string; live: boolean; available: boolean }[];
}

/** AI Ops dashboard (Phase 10 · M2). Role.Admin. Cost, latency, fallback/error rates,
 *  provider health and top spenders over the enriched ai_usage_logs. */
@Component({
  selector: 'asta-admin-ai-ops',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">AI Ops</h1>
        <span class="goal-pill"><span class="dot"></span>cost, latency &amp; provider health</span>
      </div>
    </header>

    @if (overview(); as o) {
      <div class="grid gap-3 sm:grid-cols-4 mb-5">
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.calls }}</p><p class="t-label mt-1">AI calls ({{ o.windowDays }}d)</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl" style="color:var(--peri-deep)">~\${{ o.costUsd }}</p><p class="t-label mt-1">Est. cost</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.avgLatencyMs }}ms</p><p class="t-label mt-1">Avg latency</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl" [style.color]="o.errorRate > 0.05 ? 'var(--danger)' : 'var(--green-deep)'">{{ (o.errorRate * 100).toFixed(1) }}%</p><p class="t-label mt-1">Error rate · {{ (o.fallbackRate * 100).toFixed(1) }}% fallback</p></div>
      </div>
    } @else {
      <span class="skel" style="display:block;height:90px;border-radius:12px;margin-bottom:20px"></span>
    }

    <div class="grid gap-5 md:grid-cols-2 mb-5">
      <div class="card" style="padding:18px">
        <p class="kicker mb-3">Cost by feature</p>
        @if (costs(); as c) {
          <div class="space-y-1.5">
            @for (f of c.byFeature; track f.feature) {
              <div class="flex items-center justify-between text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
                <span class="capitalize">{{ f.feature }}</span>
                <span class="font-mono text-txt-mute">{{ f.calls }} · {{ f.tokens }}t</span>
                <span class="font-mono">~\${{ f.costUsd }}</span>
              </div>
            } @empty { <p class="text-sm text-txt-mute">No usage in window.</p> }
          </div>
        }
      </div>

      <div class="card" style="padding:18px">
        <p class="kicker mb-3">Providers · strategy: <b>{{ providers()?.strategy || '—' }}</b></p>
        @if (providers(); as p) {
          <span class="pill mb-3 inline-block" [class.on]="p.live">{{ p.live ? 'LIVE' : 'MOCK' }}</span>
          <div class="space-y-1.5">
            @for (pr of p.providers; track pr.name) {
              <div class="flex items-center justify-between text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
                <span class="capitalize">{{ pr.name }}</span>
                <span class="pill" [style.color]="pr.available ? 'var(--green-deep)' : 'var(--danger)'">{{ pr.available ? 'healthy' : 'degraded' }}</span>
                <span class="font-mono text-xs text-txt-mute">{{ pr.live ? 'live key' : 'no key' }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <div class="card" style="padding:18px">
      <p class="kicker mb-3">Top spenders</p>
      @if (costs(); as c) {
        <div class="space-y-1">
          @for (u of c.topUsers; track u.userId) {
            <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
              <span class="min-w-0 flex-1 truncate">{{ u.name }} <span class="text-txt-mute">· {{ u.email }}</span></span>
              <span class="font-mono text-txt-mute">{{ u.calls }} calls</span>
              <span class="font-mono">~\${{ u.costUsd }}</span>
            </div>
          } @empty { <p class="text-sm text-txt-mute">No usage in window.</p> }
        </div>
      }
    </div>
  `,
  styles: [`.skel{background:linear-gradient(90deg,var(--paper-2) 25%,var(--paper-3) 50%,var(--paper-2) 75%);background-size:200% 100%;animation:s 1.4s ease infinite}@keyframes s{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.skel{animation:none}}`],
})
export class AdminAiOpsComponent implements OnInit {
  private readonly ops = inject(OpsService);
  readonly overview = signal<AiOpsOverview | null>(null);
  readonly costs = signal<Costs | null>(null);
  readonly providers = signal<Providers | null>(null);

  ngOnInit(): void {
    this.ops.aiOverview().subscribe({ next: (o) => this.overview.set(o) });
    this.ops.aiCosts().subscribe({ next: (c) => this.costs.set(c) });
    this.ops.aiProviders().subscribe({ next: (p) => this.providers.set(p) });
  }
}
