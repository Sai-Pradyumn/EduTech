import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AdminService } from '../../core/services/admin.service';
import { AdminAnalytics } from '../../core/models';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { DonutChartComponent, ChartDatum } from '../../shared/charts';
import { CountDirective } from '../../shared/directives/count.directive';

/**
 * Admin Command Center — AI analytics (A7). Usage by agent with latency + estimated cost
 * for the platform operator. Read-only; Role.Admin.
 */
@Component({
  selector: 'asta-admin-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, DonutChartComponent, CountDirective],
  template: `
    @if (data(); as d) {
      <div class="grid gap-3 sm:grid-cols-4 mb-5">
        <div class="card metric"><span class="num" [astaCount]="d.totalCalls">0</span><span class="lbl">AI calls</span></div>
        <div class="card metric"><span class="num" [astaCount]="d.totalTokens">0</span><span class="lbl">Tokens</span></div>
        <div class="card metric"><span class="num" [astaCount]="d.avgLatencyMs" suffix="ms">0</span><span class="lbl">Avg latency</span></div>
        <div class="card metric" style="background:oklch(0.78 0.15 268 / .1)" title="Estimate: token usage × standard provider rates. Actuals vary by model and provider.">
          <span class="num">\${{ d.estCostUsd }}</span><span class="lbl">est. cost ⓘ</span>
        </div>
      </div>
      @if (agentShare().length) {
        <div class="card mb-5" style="padding:18px">
          <p class="kicker mb-3" style="color:var(--peri-deep)">Agent share of calls</p>
          <asta-donut-chart [data]="agentShare()" centerLabel="calls" label="Agent share of AI calls" />
        </div>
      }
      <div class="card" style="padding:0;overflow:auto">
        <table>
          <thead><tr><th>Agent</th><th>Calls</th><th>Tokens</th><th>Avg latency</th><th>Est. cost</th><th style="width:30%">Share</th></tr></thead>
          <tbody>
            @for (a of d.byAgent; track a.agentType) {
              <tr>
                <td><b>{{ a.agentType }}</b></td>
                <td>{{ a.count }}</td>
                <td>{{ a.tokens }}</td>
                <td>{{ a.avgLatencyMs }}ms</td>
                <td>\${{ a.estCostUsd }}</td>
                <td><div class="bar"><div class="bar-fill" [style.width.%]="pct(a.count, d.totalCalls)"></div></div></td>
              </tr>
            } @empty { <tr><td colspan="6" class="empty">No AI usage recorded yet.</td></tr> }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="grid gap-3 sm:grid-cols-4 mb-5">
        @for (n of [1,2,3,4]; track n) { <div class="card metric"><asta-skeleton w="55%" h="28px" /><asta-skeleton w="70%" h="11px" /></div> }
      </div>
      <div class="card" style="padding:16px">
        @for (n of [1,2,3,4,5]; track n) { <div class="py-2"><asta-skeleton h="14px" /></div> }
      </div>
    }
  `,
  styles: [
    `
      .metric { padding: 16px; display: flex; flex-direction: column; gap: 2px; }
      .num { font-family: var(--display); font-size: 28px; line-height: 1; }
      .lbl { font-size: 10px; font-family: var(--mono); text-transform: uppercase; color: var(--text-mute); }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); padding: 12px 14px; border-bottom: 1px solid var(--paper-3); }
      td { padding: 11px 14px; border-bottom: 1px solid var(--paper-2); }
      tr:last-child td { border-bottom: none; }
      .empty { text-align: center; color: var(--text-mute); padding: 28px; }
      .bar { height: 7px; border-radius: 100px; background: var(--paper-3); overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 100px; background: var(--peri); }
    `,
  ],
})
export class AdminAnalyticsComponent implements OnInit {
  private readonly api = inject(AdminService);
  readonly data = signal<AdminAnalytics | null>(null);

  /** Agent call counts → donut slices. */
  readonly agentShare = computed<ChartDatum[]>(() =>
    (this.data()?.byAgent ?? []).map((a) => ({ label: a.agentType, value: a.count })),
  );

  ngOnInit(): void {
    this.api.analytics().subscribe({ next: (d) => this.data.set(d) });
  }

  pct(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
  }
}
