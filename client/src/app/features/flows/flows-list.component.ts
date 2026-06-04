import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { Difficulty, Flow, FlowService } from '../../core/services/flow.service';
import { FLOW_NODE_META } from './flow-node-meta';

interface FlowIdea {
  goal: string;
  difficulty: Difficulty;
}

@Component({
  selector: 'asta-flows-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Flow Studio</h1>
        <span class="goal-pill"><span class="dot"></span>Mission map · turn a goal into a living learning graph</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn>
      </div>
    </header>

    <!-- Generate panel -->
    <asta-card class="block motion-card-reveal motion-row-primary mb-5">
      <p class="kicker mb-3">Generate a flow</p>
      <div class="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label class="block">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Goal</span>
          <input
            class="flow-input mt-1"
            [(ngModel)]="goal"
            (keydown.enter)="generate()"
            placeholder="e.g. Learn the MERN stack in 30 days"
            maxlength="200"
            aria-label="Learning goal"
          />
        </label>
        <label class="block">
          <span class="text-xs text-txt-mute uppercase tracking-wide">Level</span>
          <select class="flow-input mt-1" [(ngModel)]="difficulty" aria-label="Difficulty">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <asta-btn variant="accent" [loading]="generating()" [disabled]="!canGenerate()" (click)="generate()">
          Generate flow <span class="arr">→</span>
        </asta-btn>
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        @for (idea of ideas; track idea.goal) {
          <button class="idea-chip" type="button" (click)="useIdea(idea)">{{ idea.goal }}</button>
        }
      </div>
    </asta-card>

    @if (loading()) {
      <div class="grid gap-5 md:grid-cols-2 motion-row-2">
        @for (i of [1, 2, 3, 4]; track i) {
          <asta-card>
            <asta-skeleton h="22px" w="55%" />
            <div class="mt-4"><asta-skeleton h="64px" /></div>
          </asta-card>
        }
      </div>
    } @else if (loadError()) {
      <asta-card>
        <asta-empty-state title="Could not load your flows" description="Something interrupted the mission map.">
          <asta-btn variant="accent" (click)="refresh()">Retry</asta-btn>
        </asta-empty-state>
      </asta-card>
    } @else if (flows().length === 0) {
      <asta-card class="block motion-card-reveal motion-row-2">
        <asta-empty-state
          title="No flows yet"
          description="Speak or type a goal above — Asta will lay out a visual graph of concepts, practice, checkpoints, a project and a mastery gate."
        >
          <asta-btn variant="accent" (click)="focusGoal()">Generate your first flow</asta-btn>
        </asta-empty-state>
      </asta-card>
    } @else {
      @if (flows().length > 2) {
        <div class="fl-toolbar mb-4">
          <div class="fl-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Search flows…" aria-label="Search flows" />
          </div>
          <div class="fl-chips">
            @for (d of diffOptions; track d) {
              <button class="fl-chip" [class.on]="diffFilter() === d" (click)="diffFilter.set(d)">{{ d }}</button>
            }
          </div>
        </div>
      }
      @if (filteredFlows().length) {
      <div class="grid gap-5 md:grid-cols-2 motion-row-2">
        @for (f of filteredFlows(); track f.id; let i = $index) {
          <asta-card
            class="motion-card-reveal hover-lift cursor-pointer block"
            [interactive]="true"
            [style.--motion-card-index]="i"
            (click)="open(f)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-display text-lg leading-snug truncate">{{ f.title }}</p>
                <p class="text-sm text-txt-mute mt-0.5 line-clamp-2">{{ f.goal }}</p>
              </div>
              <span class="status-dot" [class]="'st-' + f.status" [title]="f.status">{{ f.status }}</span>
            </div>

            <div class="flex items-center gap-2 mt-3 text-xs text-txt-mute flex-wrap">
              <span class="meta-pill">{{ f.nodes.length }} nodes</span>
              <span class="meta-pill">{{ f.difficulty }}</span>
              @if (typeCounts(f); as tc) {
                @for (t of tc; track t.type) {
                  <span class="meta-pill" [title]="t.label">{{ t.icon }} {{ t.count }}</span>
                }
              }
            </div>

            <div class="mt-3">
              <div class="prog-track"><span class="prog-fill" [style.width.%]="f.progressPercentage"></span></div>
              <div class="flex justify-between text-[11px] text-txt-mute mt-1">
                <span>{{ completedCount(f) }}/{{ f.nodes.length }} mastered</span>
                <span>{{ f.progressPercentage }}%</span>
              </div>
            </div>
          </asta-card>
        }
      </div>
      } @else {
        <asta-card class="block"><p class="text-sm text-txt-mute py-4 text-center">No flows match your search or filter.</p></asta-card>
      }
    }
  `,
  styles: [
    `
      :host { display: block; }
      .flow-input {
        width: 100%;
        background: var(--ink-2, var(--paper-2));
        border: 1px solid var(--paper-3);
        border-radius: var(--r-md, 12px);
        padding: 10px 12px;
        color: var(--text);
        font-size: 14px;
        transition: border-color 0.25s var(--ease);
      }
      .flow-input:focus { outline: none; border-color: var(--green); }
      .idea-chip {
        font-size: 12px;
        padding: 5px 11px;
        border-radius: 999px;
        border: 1px solid var(--paper-3);
        color: var(--text-soft);
        background: transparent;
        cursor: pointer;
        transition: border-color 0.2s var(--ease), color 0.2s var(--ease), transform 0.2s var(--ease);
      }
      .idea-chip:hover { border-color: var(--green); color: var(--text); transform: translateY(-1px); }
      .meta-pill {
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--paper-3);
        background: color-mix(in oklab, var(--paper-2) 70%, transparent);
      }
      .status-dot {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 3px 9px;
        border-radius: 999px;
        border: 1px solid var(--paper-3);
        white-space: nowrap;
      }
      .st-active { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 50%, var(--paper-3)); }
      .st-completed { color: var(--peri, #8aa6ff); }
      .st-draft, .st-archived { color: var(--text-mute); }
      .prog-track { height: 6px; border-radius: 999px; background: var(--paper-3); overflow: hidden; }
      .prog-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--green-deep), var(--green)); transition: width 0.4s var(--ease); }
      .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .fl-toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      .fl-search { position: relative; display: flex; align-items: center; flex: 1; min-width: 200px; }
      .fl-search svg { position: absolute; left: 11px; color: var(--text-mute); pointer-events: none; }
      .fl-search input { width: 100%; padding: 8px 12px 8px 32px; font-size: 13px; color: var(--text); background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 11px; }
      .fl-search input:focus { outline: none; border-color: var(--green); }
      .fl-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .fl-chip { font-size: 12px; text-transform: capitalize; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-soft); cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
      .fl-chip:hover { border-color: var(--green); }
      .fl-chip.on { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 50%, var(--paper-3)); background: color-mix(in oklab, var(--green) 12%, transparent); }
    `,
  ],
})
export class FlowsListComponent {
  private readonly flowApi = inject(FlowService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly flows = signal<Flow[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly generating = signal(false);

  goal = '';
  difficulty: Difficulty = 'beginner';

  readonly q = signal('');
  readonly diffFilter = signal<'all' | Difficulty>('all');
  readonly diffOptions: ('all' | Difficulty)[] = ['all', 'beginner', 'intermediate', 'advanced'];

  readonly filteredFlows = computed(() => {
    const needle = this.q().trim().toLowerCase();
    const diff = this.diffFilter();
    return this.flows().filter((f) => {
      if (diff !== 'all' && f.difficulty !== diff) return false;
      if (needle && !`${f.title} ${f.goal}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  });

  readonly ideas: FlowIdea[] = [
    { goal: 'Learn the MERN stack in 30 days', difficulty: 'beginner' },
    { goal: 'Crack DSA interviews in 45 days', difficulty: 'intermediate' },
    { goal: 'Prepare for a system design round', difficulty: 'advanced' },
    { goal: 'Master MongoDB aggregations', difficulty: 'intermediate' },
    { goal: 'Learn cybersecurity basics', difficulty: 'beginner' },
  ];

  readonly canGenerate = computed(() => this.goal.trim().length >= 3 && !this.generating());

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.flowApi.list().subscribe({
      next: (list) => {
        this.flows.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  useIdea(idea: FlowIdea): void {
    this.goal = idea.goal;
    this.difficulty = idea.difficulty;
  }

  focusGoal(): void {
    const el = document.querySelector<HTMLInputElement>('.flow-input');
    el?.focus();
  }

  generate(): void {
    if (!this.canGenerate()) return;
    this.generating.set(true);
    this.flowApi.generate({ goal: this.goal.trim(), difficulty: this.difficulty }).subscribe({
      next: (flow) => {
        this.generating.set(false);
        this.toast.success('Flow generated');
        this.flows.update((list) => [flow, ...list]);
        this.router.navigate(['/app/flows', flow.id]);
      },
      error: (err: Error) => {
        this.generating.set(false);
        this.toast.error(err.message || 'Could not generate flow');
      },
    });
  }

  open(f: Flow): void {
    this.router.navigate(['/app/flows', f.id]);
  }

  completedCount(f: Flow): number {
    return f.nodes.filter((n) => n.status === 'completed').length;
  }

  typeCounts(f: Flow): { type: string; icon: string; label: string; count: number }[] {
    const keep = ['quiz', 'project', 'voice_practice', 'weak_area_repair'];
    return keep
      .map((type) => ({
        type,
        icon: FLOW_NODE_META[type]?.icon ?? '•',
        label: FLOW_NODE_META[type]?.label ?? type,
        count: f.nodes.filter((n) => n.type === type).length,
      }))
      .filter((t) => t.count > 0);
  }
}
