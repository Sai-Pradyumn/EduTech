import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FounderService } from '../../core/services/founder.service';
import { FounderDashboard } from '../../core/models';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { LineChartComponent, BarChartComponent, ChartDatum } from '../../shared/charts';
import { CountDirective } from '../../shared/directives/count.directive';

/**
 * Founder / operator dashboard (B17). Platform-wide aggregates across every org — totals,
 * estimated MRR, AI cost, feature adoption, top cohorts, signups, churn risk, system health.
 * Platform-admin only (PlatformManage on the API).
 */
@Component({
  selector: 'asta-founder-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SkeletonComponent, LineChartComponent, BarChartComponent, CountDirective],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Founder</h1>
        <span class="goal-pill"><span class="dot"></span>Platform-wide growth, revenue, AI cost &amp; system health</span>
      </div>
    </header>

    @if (data(); as d) {
      <!-- headline metrics -->
      <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-5 motion-row-primary">
        <div class="card metric motion-card-reveal" style="--motion-card-index:0"><span class="num" [astaCount]="d.totals.organizations">0</span><span class="lbl">Organizations</span></div>
        <div class="card metric motion-card-reveal" style="--motion-card-index:1"><span class="num" [astaCount]="d.totals.students">0</span><span class="lbl">Students</span></div>
        <div class="card metric motion-card-reveal" style="--motion-card-index:2"><span class="num" [astaCount]="d.totals.mentors">0</span><span class="lbl">Mentors</span></div>
        <div class="card metric motion-card-reveal" style="--motion-card-index:3"><span class="num" [astaCount]="d.subscriptions.active">0</span><span class="lbl">Active subs</span></div>
        <div class="card metric motion-card-reveal" style="background:oklch(0.80 0.16 150 / .1);--motion-card-index:4" title="Monthly recurring revenue: sum of active plan prices.">
          <span class="num" [astaCount]="d.subscriptions.estMrrInr" prefix="₹">0</span><span class="lbl">MRR / mo</span>
        </div>
      </div>

      <!-- Derived KPIs founders track — computed from the raw totals above -->
      @if (kpis(); as k) {
        <div class="kpi-row mb-5">
          <span class="kpi" title="Average monthly revenue per active subscription (MRR ÷ active subs).">ARPU <b>₹{{ k.arpu }}</b><span class="kpi-u">/mo</span></span>
          <span class="kpi" title="Share of students on an active paid plan.">Paid conversion <b>{{ k.paidConversion }}%</b></span>
          <span class="kpi" title="Total new signups across the last 14 days.">Signups 14d <b>{{ k.signups14d }}</b></span>
          <span class="kpi" title="Active subscriptions ÷ organizations.">Subs / org <b>{{ k.subsPerOrg }}</b></span>
        </div>
      }

      @if (d.subscriptions.byPlan.length) {
        <div class="plan-mix mb-5">
          <span class="kicker !mb-0">Plan mix</span>
          @for (p of d.subscriptions.byPlan; track p.plan) {
            <span class="plan-chip">{{ p.plan }} <b>{{ p.count }}</b></span>
          }
        </div>
      }

      <div class="grid gap-5 lg:grid-cols-2 motion-row-2">
        <!-- AI cost + agents -->
        <div class="card motion-card-reveal" style="padding:18px;--motion-card-index:0">
          <p class="kicker mb-3" style="color:var(--peri-deep)">AI usage & cost</p>
          <div class="flex gap-5 mb-3">
            <div><p class="num2">{{ d.ai.totalCalls }}</p><p class="lbl">calls</p></div>
            <div><p class="num2">{{ d.ai.totalTokens }}</p><p class="lbl">tokens</p></div>
            <div title="Estimate: token usage × standard provider rates. Actuals vary by model and provider.">
              <p class="num2">\${{ d.ai.estCostUsd }}</p><p class="lbl">est. cost ⓘ</p>
            </div>
          </div>
          <asta-bar-chart [horizontal]="true" tone="peri" [data]="agentData()" label="AI calls by agent" />
        </div>

        <!-- feature adoption -->
        <div class="card motion-card-reveal" style="padding:18px;--motion-card-index:1">
          <p class="kicker mb-3" style="color:var(--green-deep)">Feature adoption</p>
          <div class="space-y-3">
            @for (f of d.adoption; track f.feature) {
              <div>
                <div class="flex justify-between text-sm mb-1"><span>{{ f.feature }}</span><span class="font-mono text-txt-mute">{{ f.users }} ({{ f.pct }}%)</span></div>
                <div class="bar"><div class="bar-fill" [style.width.%]="f.pct" style="background:var(--green)"></div></div>
              </div>
            }
          </div>
          <div class="mt-4 pt-3 flex items-center gap-2" style="border-top:1px solid var(--paper-3)">
            <span class="badge" [style.background]="d.churnRisk.inactiveStudents > 0 ? 'oklch(0.72 0.17 28 / .16)' : 'var(--paper-2)'">⚠ {{ d.churnRisk.inactiveStudents }}</span>
            <span class="text-xs text-txt-soft">students inactive > {{ d.churnRisk.thresholdDays }}d (churn risk)</span>
          </div>
        </div>

        <!-- top cohorts -->
        <div class="card motion-card-reveal" style="padding:18px;--motion-card-index:2">
          <p class="kicker mb-3">Top cohorts</p>
          @if (d.topCohorts.length === 0) { <p class="text-sm text-txt-mute">No cohorts yet.</p> }
          <div class="space-y-2">
            @for (c of d.topCohorts; track c.name) {
              <div class="flex items-center justify-between text-sm">
                <div class="min-w-0"><b class="truncate">{{ c.name }}</b><span class="text-xs text-txt-mute"> · {{ c.organization }}</span></div>
                <span class="font-mono text-xs text-txt-mute">{{ c.students }}👤 {{ c.mentors }}🎓</span>
              </div>
            }
          </div>
        </div>

        <!-- signups + health -->
        <div class="card motion-card-reveal" style="padding:18px;--motion-card-index:3">
          <p class="kicker mb-3">Signups (14d)</p>
          <div class="mb-4">
            <asta-line-chart [area]="true" tone="peri" [data]="signupData()" [height]="96" label="Signups over the last 14 days" />
          </div>
          <div class="pt-3 grid grid-cols-3 gap-2 text-center" style="border-top:1px solid var(--paper-3)">
            <div><p class="num2" [style.color]="d.systemHealth.db === 'connected' ? 'var(--green-deep)' : 'var(--coral-deep)'">{{ d.systemHealth.db }}</p><p class="lbl">DB</p></div>
            <div><p class="num2">{{ uptimeMin(d.systemHealth.uptimeSec) }}m</p><p class="lbl">uptime</p></div>
            <div><p class="num2">{{ d.systemHealth.memoryMb }}MB</p><p class="lbl">memory</p></div>
          </div>
        </div>
      </div>
      <p class="gen">Generated {{ d.generatedAt | date: 'medium' }}</p>
    } @else {
      <!-- loading skeleton (DESIGN_SPEC §8) -->
      <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-5">
        @for (n of [1,2,3,4,5]; track n) {
          <div class="card metric"><asta-skeleton w="60%" h="28px" /><asta-skeleton w="80%" h="11px" /></div>
        }
      </div>
      <div class="grid gap-5 lg:grid-cols-2">
        @for (n of [1,2,3,4]; track n) {
          <div class="card" style="padding:18px">
            <asta-skeleton w="40%" h="13px" radius="100px" />
            <div class="mt-3 space-y-2">
              <asta-skeleton h="10px" /><asta-skeleton w="90%" h="10px" /><asta-skeleton w="75%" h="10px" />
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .metric { padding: 16px; display: flex; flex-direction: column; gap: 2px; }
      .num { font-family: var(--display); font-size: 30px; line-height: 1; }
      .num2 { font-family: var(--display); font-size: 20px; line-height: 1; }
      .lbl { font-size: 10px; font-family: var(--mono); text-transform: uppercase; letter-spacing: .03em; color: var(--text-mute); }
      .bar { height: 7px; border-radius: 100px; background: var(--paper-3); overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 100px; transition: width .5s var(--ease); }
      .badge { font-family: var(--mono); font-size: 12px; padding: 2px 9px; border-radius: 100px; }
      .kpi-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .kpi { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; color: var(--text-mute); padding: 6px 12px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); }
      .kpi b { font-size: 14px; color: var(--text); font-variant-numeric: tabular-nums; }
      .kpi-u { font-size: 10px; color: var(--text-mute); }
      .plan-mix { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .plan-chip { font-size: 12px; text-transform: capitalize; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); }
      .plan-chip b { color: var(--text); font-variant-numeric: tabular-nums; }
      .gen { font-size: 11px; font-family: var(--mono); color: var(--text-mute); margin-top: 14px; }
    `,
  ],
})
export class FounderDashboardComponent implements OnInit {
  private readonly api = inject(FounderService);
  readonly data = signal<FounderDashboard | null>(null);

  /** Derived operator KPIs from the raw aggregates (no extra API call). */
  readonly kpis = computed(() => {
    const d = this.data();
    if (!d) return null;
    const active = d.subscriptions.active;
    const students = d.totals.students;
    const orgs = d.totals.organizations;
    const signups14d = (d.signups ?? []).reduce((sum, s) => sum + s.count, 0);
    return {
      arpu: active > 0 ? Math.round(d.subscriptions.estMrrInr / active) : 0,
      paidConversion: students > 0 ? Math.round((active / students) * 100) : 0,
      signups14d,
      subsPerOrg: orgs > 0 ? (active / orgs).toFixed(1) : '0',
    };
  });

  /** AI calls by agent → horizontal bar chart data. */
  readonly agentData = computed<ChartDatum[]>(() =>
    (this.data()?.ai.byAgent ?? []).map((a) => ({ label: a.agentType, value: a.count })),
  );
  /** Daily signups → area chart data (short day labels). */
  readonly signupData = computed<ChartDatum[]>(() =>
    (this.data()?.signups ?? []).map((s) => ({
      label: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: s.count,
    })),
  );

  ngOnInit(): void {
    this.api.overview().subscribe({ next: (d) => this.data.set(d) });
  }

  uptimeMin(sec: number): number {
    return Math.round(sec / 60);
  }
}
