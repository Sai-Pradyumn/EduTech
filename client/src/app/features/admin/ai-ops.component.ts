import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AiOpsOverview, OpsService } from '../../core/services/ops.service';
import { AgentService } from '../../core/services/agent.service';
import { AiProvidersSnapshot } from '../../core/models';

interface Costs {
  byDay: { day: string; costUsd: number; calls: number }[];
  byFeature: { feature: string; costUsd: number; calls: number; tokens: number }[];
  topUsers: { userId: string; name: string; email: string; costUsd: number; calls: number }[];
}

type ProviderState = 'live' | 'cooldown' | 'no-key' | 'fallback';
interface ProviderRow {
  name: string;
  label: string;
  order: number;
  state: ProviderState;
  cooldownSec: number;
  capabilities: { chat: boolean; streaming: boolean; structured: boolean; embeddings: boolean };
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: 'Ollama (local)',
  mock: 'Offline mock',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
};

/** AI Ops dashboard (Phase 10 · M2). Role.Admin. Cost, latency, fallback/error rates,
 *  live provider health (chain + circuit breaker) and top spenders. */
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
      <div class="grid gap-3 sm:grid-cols-4 mb-5 motion-stagger">
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.calls }}</p><p class="t-label mt-1">AI calls ({{ o.windowDays }}d)</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl" style="color:var(--peri-deep)">~\${{ o.costUsd }}</p><p class="t-label mt-1">Est. cost</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl grad-flow">{{ o.avgLatencyMs }}ms</p><p class="t-label mt-1">Avg latency</p></div>
        <div class="card" style="padding:16px"><p class="font-display text-2xl" [style.color]="o.errorRate > 0.05 ? 'var(--danger)' : 'var(--green-deep)'">{{ (o.errorRate * 100).toFixed(1) }}%</p><p class="t-label mt-1">Error rate · {{ (o.fallbackRate * 100).toFixed(1) }}% fallback</p></div>
      </div>
    } @else {
      <span class="skel" style="display:block;height:90px;border-radius:12px;margin-bottom:20px"></span>
    }

    <!-- Provider health: live chain + circuit-breaker state from the gateway snapshot. -->
    <div class="card mb-5 motion-card-reveal" style="padding:18px">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div class="min-w-0">
          <p class="kicker mb-1">Provider health · circuit breaker</p>
          <h2 class="t-h-card">Live chain · strategy: <b>{{ snap()?.strategy || '—' }}</b></h2>
        </div>
        <div class="flex items-center gap-2">
          <span class="pill" [class.on]="snap()?.live">{{ snap()?.live ? 'LIVE AI' : 'MOCK MODE' }}</span>
          <button class="refresh" type="button" (click)="loadHealth()" aria-label="Refresh provider health">↻</button>
        </div>
      </div>

      @if (snap(); as s) {
        @if (!s.live) {
          <div class="warn mb-3">
            <b>No real AI — every reply is a placeholder.</b>
            Add a cloud key (GROQ / GEMINI / OPENAI / …) to the server <code>.env</code>, or run real AI
            locally with no key: install Ollama, <code>ollama pull llama3.2</code>, then set
            <code>OLLAMA_ENABLED=true</code> and restart.
          </div>
        }
        <div class="space-y-1.5">
          @for (p of chain(); track p.name) {
            <div class="prov-row" [attr.data-state]="p.state">
              <span class="ord">{{ p.order }}</span>
              <span class="pname">{{ p.label }}</span>
              <span class="caps">
                @if (p.capabilities.chat) { <i title="chat">chat</i> }
                @if (p.capabilities.streaming) { <i title="streaming">stream</i> }
                @if (p.capabilities.structured) { <i title="structured JSON">json</i> }
                @if (p.capabilities.embeddings) { <i title="embeddings">embed</i> }
              </span>
              <span class="state">
                @switch (p.state) {
                  @case ('live') { <b style="color:var(--green-deep)">● live</b> }
                  @case ('cooldown') { <b style="color:var(--danger)">◐ cooldown{{ p.cooldownSec ? ' · ' + p.cooldownSec + 's' : '' }}</b> }
                  @case ('no-key') { <span class="text-txt-mute">○ no key</span> }
                  @default { <span class="text-txt-mute">◌ fallback</span> }
                }
              </span>
            </div>
          }
        </div>
        @if (!hasOllama()) {
          <p class="tip mt-3">💡 <b>Ollama</b> gives free, local AI with no API key — set <code>OLLAMA_ENABLED=true</code> on the server to add it as a zero-cost fallback.</p>
        }
      } @else {
        <span class="skel" style="display:block;height:120px;border-radius:12px"></span>
      }
    </div>

    <!-- Spend over time -->
    @if (costs()?.byDay?.length) {
      <div class="card mb-5 motion-card-reveal motion-row-2" style="padding:18px">
        <div class="flex items-center justify-between mb-3">
          <p class="kicker">Spend over time · last {{ costs()!.byDay.length }} days</p>
          <span class="font-mono text-xs text-txt-mute">peak ~\${{ dayPeak() }}/day</span>
        </div>
        <div class="cost-chart" role="img" aria-label="Daily AI spend trend">
          @for (d of costs()!.byDay; track d.day) {
            <div class="cost-col" [title]="d.day + ' · $' + d.costUsd + ' · ' + d.calls + ' calls'">
              <span class="cost-bar" [style.height.%]="dayPct(d.costUsd)"></span>
            </div>
          }
        </div>
        <div class="flex justify-between text-[10px] text-txt-mute font-mono mt-1.5">
          <span>{{ costs()!.byDay[0].day }}</span>
          <span>{{ costs()!.byDay[costs()!.byDay.length - 1].day }}</span>
        </div>
      </div>
    }

    <div class="grid gap-5 md:grid-cols-2 mb-5 motion-row-3 motion-stagger">
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
    </div>
  `,
  styles: [`
    .skel{background:linear-gradient(90deg,var(--paper-2) 25%,var(--paper-3) 50%,var(--paper-2) 75%);background-size:200% 100%;animation:s 1.4s ease infinite}@keyframes s{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.skel{animation:none}}
    .cost-chart{display:flex;align-items:flex-end;gap:2px;height:84px}
    .cost-col{flex:1;height:100%;display:flex;align-items:flex-end;min-width:2px}
    .cost-bar{display:block;width:100%;border-radius:3px 3px 0 0;background:linear-gradient(180deg,var(--peri,#8aa6ff),color-mix(in oklab,var(--peri,#8aa6ff) 60%,var(--ink)));min-height:2px;transition:height .4s var(--ease);transform-origin:bottom;animation:aiBarGrow .7s var(--ease) both}
    @keyframes aiBarGrow{from{transform:scaleY(0)}}
    .cost-col:hover .cost-bar{background:var(--green);box-shadow:0 0 10px var(--asta-accent-glow)}
    @media (prefers-reduced-motion:reduce){.cost-bar{animation:none}}
    .refresh{width:28px;height:28px;border-radius:8px;border:1px solid var(--paper-3);background:var(--paper-2);color:var(--txt-mute);cursor:pointer;transition:all .2s var(--ease)}
    .refresh:hover{color:var(--ink);border-color:var(--green);transform:rotate(90deg)}
    .warn{background:color-mix(in oklab,var(--danger) 9%,var(--paper));border:1px solid color-mix(in oklab,var(--danger) 35%,transparent);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5}
    .warn code,.tip code{font-family:var(--font-mono,monospace);font-size:12px;background:var(--paper-3);padding:1px 5px;border-radius:4px}
    .tip{font-size:12.5px;color:var(--txt-mute);line-height:1.5}
    .prov-row{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;border:1px solid var(--paper-3);background:var(--paper-2);transition:border-color .2s var(--ease)}
    .prov-row[data-state="live"]{border-color:color-mix(in oklab,var(--green) 40%,transparent)}
    .prov-row[data-state="cooldown"]{border-color:color-mix(in oklab,var(--danger) 35%,transparent)}
    .prov-row .ord{width:20px;height:20px;flex:none;display:grid;place-items:center;border-radius:6px;background:var(--paper-3);font-size:11px;font-weight:700;color:var(--txt-mute)}
    .prov-row .pname{font-weight:600;text-transform:capitalize;min-width:0;flex:1}
    .prov-row .caps{display:flex;gap:4px;flex-wrap:wrap}
    .prov-row .caps i{font-style:normal;font-size:10px;letter-spacing:.02em;padding:2px 6px;border-radius:999px;background:var(--paper-3);color:var(--txt-mute)}
    .prov-row .state{font-size:12.5px;white-space:nowrap;min-width:96px;text-align:right}
  `],
})
export class AdminAiOpsComponent implements OnInit, OnDestroy {
  private readonly ops = inject(OpsService);
  private readonly agent = inject(AgentService);
  readonly overview = signal<AiOpsOverview | null>(null);
  readonly costs = signal<Costs | null>(null);
  readonly snap = signal<AiProvidersSnapshot | null>(null);
  readonly now = signal(Date.now());

  /** Absolute time each cooling-down provider becomes available (for a live countdown). */
  private cooldownUntil: Record<string, number> = {};
  private timers: ReturnType<typeof setInterval>[] = [];

  readonly dayPeak = computed(() =>
    (this.costs()?.byDay ?? []).reduce((m, d) => Math.max(m, d.costUsd), 0),
  );

  readonly hasOllama = computed(() =>
    (this.snap()?.providers ?? []).some((p) => p.name === 'ollama'),
  );

  /** Chain providers enriched with circuit-breaker state + ticking cooldown seconds. */
  readonly chain = computed<ProviderRow[]>(() => {
    const s = this.snap();
    if (!s) return [];
    const now = this.now();
    return s.providers.map((p, i) => {
      const remainingMs = Math.max(0, (this.cooldownUntil[p.name] ?? 0) - now);
      const cooldownSec = Math.ceil(remainingMs / 1000);
      const state: ProviderState =
        p.name === 'mock'
          ? 'fallback'
          : !p.isLive
            ? 'no-key'
            : !p.available || cooldownSec > 0
              ? 'cooldown'
              : 'live';
      return {
        name: p.name,
        label: PROVIDER_LABELS[p.name] ?? p.name,
        order: i + 1,
        state,
        cooldownSec,
        capabilities: p.capabilities,
      };
    });
  });

  ngOnInit(): void {
    this.ops.aiOverview().subscribe({ next: (o) => this.overview.set(o) });
    this.ops.aiCosts().subscribe({ next: (c) => this.costs.set(c) });
    this.loadHealth();
    // Tick the cooldown countdowns every second; refresh the snapshot periodically.
    this.timers.push(setInterval(() => this.now.set(Date.now()), 1000));
    this.timers.push(setInterval(() => this.loadHealth(), 15_000));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearInterval);
  }

  loadHealth(): void {
    this.agent.aiProviders().subscribe({
      next: (s) => {
        const base = Date.now();
        this.cooldownUntil = Object.fromEntries(
          s.health.map((h) => [h.provider, base + h.availableInMs]),
        );
        this.snap.set(s);
      },
      error: () => undefined,
    });
  }

  dayPct(cost: number): number {
    const peak = this.dayPeak();
    return peak > 0 ? Math.max(4, Math.round((cost / peak) * 100)) : 0;
  }
}
