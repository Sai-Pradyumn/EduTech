import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AdminService } from '../../core/services/admin.service';
import { AgentService } from '../../core/services/agent.service';
import { AdminAnalytics, AiProvidersSnapshot } from '../../core/models';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { DonutChartComponent, ChartDatum } from '../../shared/charts';
import { CountDirective } from '../../shared/directives/count.directive';
import { CardComponent } from '../../shared/ui/card.component';
import { ProgressComponent } from '../../shared/ui/progress.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { TiltDirective } from '../../shared/directives/tilt.directive';

/**
 * Admin Command Center — AI analytics (A7). Usage by agent with latency + estimated cost
 * for the platform operator. Read-only; Role.Admin. Asta Noir Cockpit visual pass.
 */
@Component({
  selector: 'asta-admin-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, DonutChartComponent, CountDirective, CardComponent, ProgressComponent, RevealDirective, TiltDirective],
  template: `
    <!-- Compact command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">AI Analytics</h1>
        <span class="goal-pill"><span class="dot"></span>platform observability</span>
      </div>
    </header>

    @if (data(); as d) {
      <!-- Dense metric row -->
      <div class="grid gap-3 sm:grid-cols-4 mb-5" [astaReveal]="0">
        <asta-card astaTilt [tiltMax]="4" pad="16px">
          <span class="num grad-flow" [astaCount]="d.totalCalls">0</span>
          <span class="lbl">AI calls</span>
        </asta-card>
        <asta-card astaTilt [tiltMax]="4" pad="16px">
          <span class="num grad-flow" [astaCount]="d.totalTokens">0</span>
          <span class="lbl">Tokens</span>
        </asta-card>
        <asta-card astaTilt [tiltMax]="4" pad="16px">
          <span class="num grad-flow" [astaCount]="d.avgLatencyMs" suffix="ms">0</span>
          <span class="lbl">Avg latency</span>
        </asta-card>
        <asta-card astaTilt [tiltMax]="4" pad="16px" accentVar="var(--peri)" title="Estimate: token usage × standard provider rates. Actuals vary by model and provider.">
          <span class="num" style="color:var(--peri-deep)" [astaCount]="d.estCostUsd" prefix="$" [decimals]="2">0</span>
          <span class="lbl">est. cost ⓘ</span>
        </asta-card>
      </div>

      @if (providers(); as p) {
        <asta-card class="block mb-5" [astaReveal]="1" pad="18px">
          <div class="panel-head">
            <div class="min-w-0">
              <p class="kicker mb-1">AI providers</p>
              <h2 class="t-h-card">Live chain · strategy: <b>{{ p.strategy }}</b></h2>
            </div>
            <span class="pill" [class.on]="p.live">{{ p.live ? 'LIVE' : 'MOCK' }}</span>
          </div>
          <div class="prov-grid mt-3">
            @for (pr of p.providers; track pr.name) {
              <div class="prov" [class.on]="pr.isLive && pr.available">
                <span class="dot2"></span>
                <span class="pname">{{ pr.name }}</span>
                <span class="pstate">{{ pr.name === 'mock' ? 'fallback' : (pr.isLive ? (pr.available ? 'live' : 'cooldown') : 'no key') }}</span>
              </div>
            }
          </div>
        </asta-card>
      }

      @if (agentShare().length) {
        <asta-card class="block mb-5" [astaReveal]="1" pad="18px">
          <div class="panel-head">
            <p class="kicker" style="color:var(--peri-deep)">Agent share of calls</p>
            <span class="panel-ico peri" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
            </span>
          </div>
          <div class="mt-2">
            <asta-donut-chart [data]="agentShare()" centerLabel="calls" label="Agent share of AI calls" />
          </div>
        </asta-card>
      }

      <!-- Agent usage table -->
      <asta-card class="block" [astaReveal]="2" pad="0">
        <div class="panel-head" style="padding:18px 18px 14px">
          <div class="min-w-0">
            <p class="kicker mb-1">Usage by agent</p>
            <h2 class="t-h-card">Per-agent calls, tokens, latency &amp; cost</h2>
          </div>
          <span class="panel-ico green" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          </span>
        </div>
        <div style="overflow:auto">
          <table>
            <thead><tr><th>Agent</th><th>Calls</th><th>Tokens</th><th>Avg latency</th><th>Est. cost</th><th style="width:30%">Share</th></tr></thead>
            <tbody>
              @for (a of d.byAgent; track a.agentType) {
                <tr>
                  <td><b class="agent-name">{{ a.agentType }} <span class="arr">→</span></b></td>
                  <td class="mono">{{ a.count }}</td>
                  <td class="mono">{{ a.tokens }}</td>
                  <td class="mono">{{ a.avgLatencyMs }}ms</td>
                  <td class="mono">\${{ a.estCostUsd }}</td>
                  <td>
                    <div class="flex items-center gap-2.5">
                      <div class="flex-1 min-w-[90px]"><asta-progress [value]="pct(a.count, d.totalCalls)" tone="peri" /></div>
                      <span class="mono text-txt-mute" style="font-size:11px;width:34px;text-align:right">{{ pct(a.count, d.totalCalls) }}%</span>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty">No AI usage recorded yet — agent traffic will appear here once tutors and tools start running.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </asta-card>
    } @else {
      <div class="grid gap-3 sm:grid-cols-4 mb-5">
        @for (n of [1, 2, 3, 4]; track n) {
          <asta-card pad="16px"><asta-skeleton w="55%" h="28px" /><div class="mt-2"><asta-skeleton w="70%" h="11px" /></div></asta-card>
        }
      </div>
      <asta-card pad="18px">
        @for (n of [1, 2, 3, 4, 5]; track n) { <div class="py-2"><asta-skeleton h="14px" /></div> }
      </asta-card>
    }
  `,
  styles: [
    `
      .num { font-family: var(--display); font-size: 28px; line-height: 1; display: block; }
      .lbl { display: block; margin-top: 4px; font-size: 10px; font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-mute); }

      .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .panel-ico {
        width: 32px; height: 32px; flex-shrink: 0;
        display: grid; place-items: center;
        border-radius: 10px;
        color: var(--green-deep);
        background: color-mix(in oklch, var(--green) 13%, transparent);
        transition: transform 0.4s var(--ease-spring);
      }
      .panel-ico.peri { color: var(--peri-deep); background: color-mix(in oklch, var(--peri) 15%, transparent); }
      asta-card:hover .panel-ico { transform: scale(1.14) rotate(-8deg); }

      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-mute); padding: 12px 18px; border-bottom: 1px solid color-mix(in oklch, var(--paper-3) 70%, transparent); }
      td { padding: 12px 18px; border-bottom: 1px solid color-mix(in oklch, var(--paper-2) 80%, transparent); }
      tr:last-child td { border-bottom: none; }
      tbody tr { transition: background 0.18s var(--ease), box-shadow 0.18s var(--ease); }
      tbody tr:hover { background: color-mix(in oklch, var(--peri) 7%, transparent); box-shadow: inset 2px 0 0 var(--peri); }
      .mono { font-family: var(--mono); color: var(--text-soft, var(--text-mute)); }
      .agent-name { display: inline-flex; align-items: center; gap: 6px; }
      .agent-name .arr { opacity: 0; transform: translateX(-4px); transition: opacity 0.18s var(--ease), transform 0.18s var(--ease); color: var(--peri-deep); }
      tbody tr:hover .agent-name .arr { opacity: 1; transform: translateX(0); }
      .empty { text-align: center; color: var(--text-mute); padding: 32px 24px; }

      .pill { font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px; background: color-mix(in oklch, var(--text-mute) 18%, transparent); color: var(--text-mute); }
      .pill.on { background: color-mix(in oklch, var(--green) 18%, transparent); color: var(--green-deep); }
      .prov-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
      .prov { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border-radius: 10px; background: color-mix(in oklch, var(--paper-2) 80%, transparent); }
      .prov .dot2 { width: 8px; height: 8px; border-radius: 999px; background: var(--text-mute); flex-shrink: 0; }
      .prov.on .dot2 { background: var(--green); box-shadow: 0 0 0 3px color-mix(in oklch, var(--green) 22%, transparent); }
      .prov .pname { font-weight: 600; font-size: 12.5px; text-transform: capitalize; }
      .prov .pstate { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--text-mute); }
    `,
  ],
})
export class AdminAnalyticsComponent implements OnInit {
  private readonly api = inject(AdminService);
  private readonly agent = inject(AgentService);
  readonly data = signal<AdminAnalytics | null>(null);
  readonly providers = signal<AiProvidersSnapshot | null>(null);

  /** Agent call counts → donut slices. */
  readonly agentShare = computed<ChartDatum[]>(() =>
    (this.data()?.byAgent ?? []).map((a) => ({ label: a.agentType, value: a.count })),
  );

  ngOnInit(): void {
    this.api.analytics().subscribe({ next: (d) => this.data.set(d) });
    this.agent.aiProviders().subscribe({ next: (p) => this.providers.set(p), error: () => undefined });
  }

  pct(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
  }
}
