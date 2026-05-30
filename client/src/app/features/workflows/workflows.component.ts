import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentGraphApiService } from '../../core/services/lab.service';
import { ToastService } from '../../core/services/toast.service';
import { GraphRun, GraphTemplate } from '../../core/models';
import { RevealDirective } from '../../shared/directives/reveal.directive';

/**
 * Agent-graph workflows (A9). Run a LangGraph-style multi-step workflow (explain → quiz →
 * project, etc.) where each node is an Agent OS agent sharing one session. Gated by
 * ENABLE_LANGGRAPH (notice shown when disabled).
 */
@Component({
  selector: 'asta-workflows',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RevealDirective],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Workflows</h1>
        <span class="goal-pill"><span class="dot"></span>Multi-agent chains · explain → quiz → project, end to end</span>
      </div>
    </header>

    @if (enabled() === false) {
      <div class="card grid place-items-center text-center" style="padding:48px 24px;min-height:240px">
        <div>
          <p class="font-display text-xl mb-1">Workflows are off</p>
          <p class="text-sm text-txt-soft max-w-md">Multi-agent workflows are behind a flag. Set <code>ENABLE_LANGGRAPH=true</code> on the server to run them.</p>
        </div>
      </div>
    } @else if (enabled()) {
      <div class="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div class="space-y-3">
          <p class="kicker">Workflows</p>
          @for (g of graphs(); track g.name) {
            <button class="w-full text-left card" style="padding:14px"
              [style.borderColor]="selected()?.name === g.name ? 'var(--green)' : null" (click)="selected.set(g)">
              <b class="font-display">{{ g.title }}</b>
              <p class="text-xs text-txt-soft mt-1">{{ g.description }}</p>
              <div class="flex flex-wrap gap-1 mt-2">
                @for (n of g.nodes; track n.key; let i = $index) {
                  <span class="tag">{{ i + 1 }}. {{ n.label }}</span>
                }
              </div>
            </button>
          }
        </div>

        <div>
          @if (selected(); as g) {
            <div class="card mb-4" style="padding:18px">
              <p class="kicker mb-2" style="color:var(--green-deep)">Run “{{ g.title }}”</p>
              <input class="input mb-2" placeholder="Topic or role (e.g. React Hooks, Frontend Developer)" [(ngModel)]="input" (keydown.enter)="run()" />
              <button class="btn-go" [disabled]="input.trim().length < 2 || running()" (click)="run()">{{ running() ? 'Running workflow…' : 'Run workflow' }}</button>
            </div>
          }

          @if (active(); as r) {
            <div class="card" style="padding:18px" [astaReveal]="0">
              <div class="flex items-center justify-between mb-3">
                <p class="kicker">Run result <span class="text-txt-mute">· {{ r.input }}</span></p>
                <span class="pill" [style.color]="r.status === 'succeeded' ? 'var(--green-deep)' : 'var(--coral-deep)'">{{ r.status }} · {{ r.latencyMs }}ms</span>
              </div>
              <ol class="space-y-3">
                @for (s of r.steps; track s.key; let i = $index) {
                  <li class="step">
                    <span class="num">{{ i + 1 }}</span>
                    <div class="min-w-0">
                      <p class="text-sm font-medium">{{ s.label }} <span class="tag">{{ s.agentType }}</span></p>
                      <p class="text-sm text-txt-soft mt-0.5">{{ s.summary }}</p>
                    </div>
                  </li>
                }
              </ol>
            </div>
          }

          @if (!selected()) {
            <div class="card grid place-items-center text-center" style="padding:48px;min-height:200px">
              <p class="text-sm text-txt-soft">Pick a workflow on the left to run it.</p>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tag { font-size: 10px; padding: 1px 7px; border-radius: 6px; background: var(--paper-2); color: var(--text-mute); }
      .btn-go { border-radius: 100px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--green); }
      .btn-go:disabled { opacity: .6; }
      .step { display: flex; gap: 12px; }
      .num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--green); color: var(--ink); font-family: var(--display); font-size: 13px; }
    `,
  ],
})
export class WorkflowsComponent implements OnInit {
  private readonly api = inject(AgentGraphApiService);
  private readonly toast = inject(ToastService);

  readonly enabled = signal<boolean | null>(null);
  readonly graphs = signal<GraphTemplate[]>([]);
  readonly selected = signal<GraphTemplate | null>(null);
  readonly active = signal<GraphRun | null>(null);
  readonly running = signal(false);
  input = '';

  ngOnInit(): void {
    this.api.status().subscribe({
      next: (s) => {
        this.enabled.set(s.enabled);
        if (s.enabled) this.api.graphs().subscribe({ next: (g) => this.graphs.set(g) });
      },
      error: () => this.enabled.set(false),
    });
  }

  run(): void {
    const g = this.selected();
    if (!g || this.input.trim().length < 2) return;
    this.running.set(true);
    this.active.set(null);
    this.api.run(g.name, this.input.trim()).subscribe({
      next: (r) => {
        this.running.set(false);
        this.active.set(r);
      },
      error: (e) => {
        this.running.set(false);
        this.toast.error(e?.message ?? 'Workflow failed');
      },
    });
  }
}
