import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { Flow, FlowNode, FlowService } from '../../core/services/flow.service';
import { VisualService } from '../../core/services/visual.service';
import { EDGE_META, FLOW_NODE_META, toneColor } from './flow-node-meta';

type View = 'map' | 'timeline' | 'focus' | 'weakness' | 'project';

const NODE_W = 184;
const NODE_H = 70;

@Component({
  selector: 'asta-flow-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[24px] leading-tight mb-2 grad-flow truncate">{{ flow()?.title || 'Flow' }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ flow()?.goal || 'Loading flow…' }}</span>
      </div>
      <div class="flex gap-2.5 shrink-0 flex-wrap">
        <asta-btn variant="ghost" size="sm" (click)="back()">All flows</asta-btn>
        @if (flow()) {
          <asta-btn variant="ghost" size="sm" [loading]="recalculating()" (click)="recalculate()">Recalculate</asta-btn>
          <asta-btn variant="ghost" size="sm" (click)="exportFlow()">Export</asta-btn>
        }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="28px" w="40%" /><div class="mt-4"><asta-skeleton h="420px" /></div></asta-card>
    } @else if (loadError() || !flow()) {
      <asta-card>
        <asta-empty-state title="Could not load this flow" description="It may have been archived or the link is stale.">
          <asta-btn variant="accent" (click)="reload()">Retry</asta-btn>
        </asta-empty-state>
      </asta-card>
    } @else {
      <!-- View switcher + progress -->
      <div class="flex items-center justify-between gap-3 mb-3 flex-wrap motion-card-reveal motion-row-primary">
        <div class="view-tabs" role="tablist" aria-label="Flow views">
          @for (v of views; track v.id) {
            <button
              role="tab"
              [attr.aria-selected]="view() === v.id"
              class="view-tab"
              [class.active]="view() === v.id"
              (click)="setView(v.id)"
            >
              {{ v.label }}
            </button>
          }
        </div>
        <div class="flex items-center gap-2 text-xs text-txt-mute">
          <div class="prog-track w-32"><span class="prog-fill" [style.width.%]="flow()!.progressPercentage"></span></div>
          <span>{{ flow()!.progressPercentage }}% · {{ completedCount() }}/{{ flow()!.nodes.length }}</span>
        </div>
      </div>

      @if (flow()!.status === 'completed') {
        <div class="done-banner motion-row-2">
          <span class="db-ico">★</span>
          <span>Flow mastered — every node complete.@if (flow()!.completedAt) {<span> Finished {{ ago(flow()!.completedAt!) }}.</span>}</span>
        </div>
      }

      <div class="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
        <!-- ───────── Canvas / list area ───────── -->
        <div class="min-w-0">
          @if ((view() === 'map' || view() === 'weakness' || view() === 'project') && !forceList()) {
            <asta-card [padded]="false" class="block overflow-hidden relative motion-card-reveal motion-row-2">
              <!-- canvas controls -->
              <div class="canvas-controls">
                <button class="zbtn" (click)="zoomBy(1.2)" aria-label="Zoom in">+</button>
                <button class="zbtn" (click)="zoomBy(0.83)" aria-label="Zoom out">−</button>
                <button class="zbtn" (click)="resetView()" aria-label="Reset view" title="Reset">⤢</button>
              </div>
              <svg
                class="canvas"
                [attr.height]="canvasHeight"
                width="100%"
                (pointerdown)="onBgDown($event)"
                (wheel)="onWheel($event)"
              >
                <g [attr.transform]="'translate(' + panX() + ',' + panY() + ') scale(' + zoom() + ')'">
                  <!-- edges -->
                  @for (e of flow()!.edges; track e.id) {
                    <path
                      class="edge"
                      [class.dim]="isDim(e.source) && isDim(e.target)"
                      [attr.d]="edgePath(e.source, e.target)"
                      [attr.stroke-dasharray]="EDGE_META[e.relation].dashed ? '5 5' : null"
                      [style.stroke-width]="0.8 + e.strength * 1.8"
                    />
                  }
                  <!-- nodes -->
                  @for (n of flow()!.nodes; track n.id) {
                    <g
                      class="node"
                      [class.dim]="isDim(n.id)"
                      [class.selected]="selectedId() === n.id"
                      [attr.transform]="'translate(' + pos(n).x + ',' + pos(n).y + ')'"
                      [attr.tabindex]="0"
                      [attr.aria-label]="meta(n).label + ': ' + n.title + ', ' + n.status"
                      (pointerdown)="onNodeDown($event, n)"
                      (keydown.enter)="select(n.id)"
                    >
                      <rect
                        class="node-box"
                        [attr.width]="NODE_W"
                        [attr.height]="NODE_H"
                        rx="14"
                        [attr.data-status]="n.status"
                        [style.stroke]="toneColor(meta(n).tone)"
                      />
                      <text class="node-icon" x="16" y="30" [style.fill]="toneColor(meta(n).tone)">{{ meta(n).icon }}</text>
                      <text class="node-title" x="42" y="27">{{ clip(n.title, 20) }}</text>
                      <text class="node-type" x="42" y="45">{{ meta(n).label }}</text>
                      <!-- status badge -->
                      <text class="node-status" [attr.x]="NODE_W - 12" y="22" text-anchor="end">{{ statusGlyph(n.status) }}</text>
                      <!-- mastery / time strip -->
                      <rect class="bar-bg" x="14" [attr.y]="NODE_H - 12" [attr.width]="NODE_W - 28" height="4" rx="2" />
                      <rect
                        class="bar-fill"
                        x="14"
                        [attr.y]="NODE_H - 12"
                        [attr.width]="(NODE_W - 28) * (n.masteryScore / 100)"
                        height="4"
                        rx="2"
                      />
                    </g>
                  }
                </g>
              </svg>
              <p class="canvas-hint">Drag nodes to rearrange · drag background to pan · scroll to zoom</p>
            </asta-card>
          } @else if (view() === 'timeline' || forceList()) {
            <!-- Timeline / mobile list fallback -->
            <div class="space-y-3 motion-row-2">
              @for (b of timelineBuckets(); track b.index) {
                <asta-card class="motion-card-reveal block">
                  <p class="kicker mb-2">{{ b.label }} · {{ b.focus }}</p>
                  <div class="grid gap-2 sm:grid-cols-2">
                    @for (n of b.nodes; track n.id) {
                      <button class="list-node" [class.selected]="selectedId() === n.id" (click)="select(n.id)">
                        <span class="ln-icon" [style.color]="toneColor(meta(n).tone)">{{ meta(n).icon }}</span>
                        <span class="min-w-0">
                          <span class="ln-title">{{ n.title }}</span>
                          <span class="ln-sub">{{ meta(n).label }} · {{ n.estimatedMinutes }}m · {{ n.status }}</span>
                        </span>
                        <span class="ln-status">{{ statusGlyph(n.status) }}</span>
                      </button>
                    }
                  </div>
                </asta-card>
              }
            </div>
          } @else if (view() === 'focus') {
            <!-- Focus: next best actions -->
            <div class="space-y-3 motion-row-2">
              @if (focusNodes().length === 0) {
                <asta-card><asta-empty-state title="All caught up" description="No available nodes right now — complete an in-progress node or recalculate." /></asta-card>
              }
              @for (n of focusNodes(); track n.id; let i = $index) {
                <asta-card class="motion-card-reveal block" [style.--motion-card-index]="i">
                  <div class="flex items-start gap-3">
                    <span class="focus-glyph" [style.color]="toneColor(meta(n).tone)">{{ meta(n).icon }}</span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <p class="font-medium truncate">{{ n.title }}</p>
                        <span class="chip-mini">{{ n.status }}</span>
                      </div>
                      <p class="text-sm text-txt-mute mt-0.5">{{ n.objective || n.summary }}</p>
                      <div class="flex gap-2 mt-2">
                        <asta-btn size="sm" variant="accent" (click)="start(n)">Start</asta-btn>
                        <asta-btn size="sm" variant="ghost" (click)="select(n.id)">Inspect</asta-btn>
                      </div>
                    </div>
                  </div>
                </asta-card>
              }
            </div>
          }
        </div>

        <!-- ───────── Inspector ───────── -->
        <asta-card class="block sticky top-2 motion-card-reveal motion-row-2 inspector">
          @if (selected(); as n) {
            <div class="flex items-center gap-2 mb-2">
              <span class="insp-icon" [style.color]="toneColor(meta(n).tone)">{{ meta(n).icon }}</span>
              <span class="kicker !mb-0">{{ meta(n).label }}</span>
            </div>
            <p class="font-display text-lg leading-snug">{{ n.title }}</p>
            <div class="flex flex-wrap gap-1.5 my-2 text-[11px] text-txt-mute">
              <span class="meta-pill st-{{ n.status }}">{{ n.status }}</span>
              <span class="meta-pill">{{ n.difficulty }}</span>
              <span class="meta-pill">{{ n.estimatedMinutes }} min</span>
              <span class="meta-pill">mastery {{ n.masteryScore }}%</span>
            </div>
            @if (n.objective) { <p class="text-sm mb-1"><span class="text-txt-mute">Objective:</span> {{ n.objective }}</p> }
            @if (n.summary) { <p class="text-sm text-txt-soft">{{ n.summary }}</p> }

            @if (prereqTitles(n).length) {
              <p class="kicker mt-3 mb-1">Prerequisites</p>
              <ul class="text-sm text-txt-soft space-y-0.5">
                @for (p of prereqTitles(n); track p) { <li>• {{ p }}</li> }
              </ul>
            }
            @if (n.resources.length) {
              <p class="kicker mt-3 mb-1">Resources</p>
              <ul class="text-sm text-txt-soft space-y-0.5">
                @for (r of n.resources; track r.label) { <li>• {{ r.label }}</li> }
              </ul>
            }
            @if (n.agentHints.length) {
              <p class="kicker mt-3 mb-1">AI hints</p>
              <ul class="text-sm text-txt-soft space-y-0.5">
                @for (h of n.agentHints; track h) { <li>↳ {{ h }}</li> }
              </ul>
            }

            @if (linkedJumps(n).length) {
              <p class="kicker mt-3 mb-1">Linked content</p>
              <div class="flex flex-wrap gap-1.5">
                @for (j of linkedJumps(n); track j.label) {
                  <button class="jump-pill" (click)="jumpTo(j.route)">{{ j.icon }} {{ j.label }}</button>
                }
              </div>
            }

            <p class="kicker mt-3 mb-1">My notes</p>
            <textarea class="note-area" rows="3" spellcheck="false"
              placeholder="Jot a note — what was hard, what to revisit…"
              [value]="n.notes" (blur)="saveNote(n, $any($event.target).value)"></textarea>

            <div class="grid gap-2 mt-4">
              <asta-btn variant="accent" size="sm" [loading]="executing()" (click)="start(n)">
                {{ startLabel(n) }} <span class="arr">→</span>
              </asta-btn>
              @if (n.status !== 'completed') {
                <asta-btn variant="ghost" size="sm" (click)="setStatus(n, 'completed')">Mark mastered</asta-btn>
              } @else {
                <asta-btn variant="ghost" size="sm" (click)="setStatus(n, 'available')">Reopen node</asta-btn>
              }
              <asta-btn variant="ghost" size="sm" [loading]="visualizing()" (click)="explainVisually(n)">Explain visually</asta-btn>
            </div>
          } @else {
            <p class="kicker mb-2">Mission briefing</p>
            <p class="text-sm text-txt-soft">{{ flow()!.description }}</p>
            <div class="grid grid-cols-2 gap-2 my-3">
              <div class="brief-stat"><span>{{ flow()!.nodes.length }}</span><label>nodes</label></div>
              <div class="brief-stat"><span>{{ flow()!.edges.length }}</span><label>links</label></div>
              <div class="brief-stat"><span>{{ availableCount() }}</span><label>available</label></div>
              <div class="brief-stat"><span>{{ weakCount() }}</span><label>repairs</label></div>
            </div>
            <p class="kicker mt-3 mb-1">Legend</p>
            <div class="flex flex-wrap gap-1.5 text-[11px]">
              @for (l of legend; track l.type) {
                <span class="meta-pill"><span [style.color]="toneColor(l.tone)">{{ l.icon }}</span> {{ l.label }}</span>
              }
            </div>
            <p class="text-xs text-txt-mute mt-3">Select a node to inspect it and start the work.</p>
          }
        </asta-card>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .view-tabs { display: inline-flex; gap: 2px; background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 999px; padding: 3px; }
      .view-tab {
        font-size: 12px; padding: 5px 12px; border-radius: 999px; border: none; background: transparent;
        color: var(--text-soft); cursor: pointer; transition: background 0.2s, color 0.2s;
      }
      .view-tab.active { background: color-mix(in oklab, var(--green) 22%, transparent); color: var(--text); }
      .canvas { display: block; width: 100%; height: var(--canvas-h, 70vh); background:
        radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--paper-3) 60%, transparent) 1px, transparent 0) 0 0 / 26px 26px;
        touch-action: none; cursor: grab; }
      .canvas:active { cursor: grabbing; }
      .canvas-controls { position: absolute; top: 10px; right: 10px; z-index: 2; display: flex; flex-direction: column; gap: 6px; }
      .zbtn { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--paper-3); background: var(--paper-2);
        color: var(--text); font-size: 16px; cursor: pointer; line-height: 1; }
      .zbtn:hover { border-color: var(--green); }
      .canvas-hint { position: absolute; bottom: 8px; left: 12px; font-size: 11px; color: var(--text-mute); pointer-events: none; }
      .edge { fill: none; stroke: color-mix(in oklab, var(--text-mute) 60%, transparent); transition: opacity 0.2s; }
      .edge.dim { opacity: 0.15; }
      .node { cursor: grab; transition: opacity 0.2s; }
      .node:active { cursor: grabbing; }
      .node.dim { opacity: 0.28; }
      .node-box { fill: var(--paper-2); stroke-width: 1.5; transition: filter 0.2s, fill 0.2s; }
      .node-box[data-status='locked'] { stroke-dasharray: 4 4; fill: color-mix(in oklab, var(--paper-2) 70%, transparent); }
      .node-box[data-status='in_progress'] { filter: drop-shadow(0 0 6px color-mix(in oklab, var(--green) 60%, transparent)); }
      .node-box[data-status='completed'] { fill: color-mix(in oklab, var(--green) 14%, var(--paper-2)); }
      .node.selected .node-box { stroke-width: 2.5; filter: drop-shadow(0 0 8px color-mix(in oklab, var(--green) 70%, transparent)); }
      .node-icon { font-size: 17px; }
      .node-title { fill: var(--text); font-size: 12.5px; font-weight: 600; }
      .node-type { fill: var(--text-mute); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
      .node-status { fill: var(--text-soft); font-size: 12px; }
      .bar-bg { fill: var(--paper-3); }
      .bar-fill { fill: var(--green); }
      .prog-track { height: 6px; border-radius: 999px; background: var(--paper-3); overflow: hidden; display: inline-block; vertical-align: middle; }
      .prog-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--green-deep), var(--green)); }
      .meta-pill { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--paper-3); background: color-mix(in oklab, var(--paper-2) 70%, transparent); }
      .st-completed { color: var(--green-deep); }
      .st-in_progress { color: var(--green); }
      .st-locked { color: var(--text-mute); }
      .list-node {
        display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 11px;
        border-radius: 12px; border: 1px solid var(--paper-3); background: var(--paper-2); cursor: pointer; transition: border-color 0.2s, transform 0.2s;
      }
      .list-node:hover { border-color: var(--green); transform: translateY(-1px); }
      .list-node.selected { border-color: var(--green); box-shadow: 0 0 0 1px var(--green) inset; }
      .ln-icon { font-size: 16px; flex-shrink: 0; }
      .ln-title { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ln-sub { display: block; font-size: 11px; color: var(--text-mute); }
      .ln-status { margin-left: auto; color: var(--text-soft); }
      .focus-glyph { font-size: 22px; flex-shrink: 0; }
      .chip-mini { font-size: 10px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--paper-3); color: var(--text-mute); text-transform: uppercase; }
      .insp-icon { font-size: 18px; }
      .note-area { width: 100%; font-size: 13px; line-height: 1.5; color: var(--text); background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 10px; padding: 8px 10px; outline: none; resize: vertical; }
      .jump-pill { font-size: 11.5px; padding: 3px 10px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 30%, var(--paper-3)); background: color-mix(in oklab, var(--green) 8%, transparent); color: var(--green-deep); cursor: pointer; transition: background .12s; }
      .jump-pill:hover { background: color-mix(in oklab, var(--green) 16%, transparent); }
      .note-area:focus { border-color: var(--green); }
      .done-banner { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 11px 16px; border-radius: 12px; font-size: 14px; color: var(--green-deep); border: 1px solid color-mix(in oklch, var(--green) 40%, var(--paper-3)); background: oklch(0.80 0.16 150 / .08); }
      .done-banner .db-ico { font-size: 16px; }
      .inspector { max-height: calc(100dvh - 120px); overflow: auto; }
      .brief-stat { background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 12px; padding: 8px 10px; text-align: center; }
      .brief-stat span { display: block; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .brief-stat label { font-size: 10px; color: var(--text-mute); text-transform: uppercase; letter-spacing: 0.05em; }
      @media (max-width: 1023.98px) { .inspector { position: static; max-height: none; } }
      @media (prefers-reduced-motion: reduce) { .node-box, .edge, .node { transition: none; } }
    `,
  ],
})
export class FlowDetailComponent {
  private readonly flowApi = inject(FlowService);
  private readonly visualApi = inject(VisualService);
  private readonly toast = inject(ToastService);
  private readonly confetti = inject(ConfettiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly NODE_W = NODE_W;
  readonly NODE_H = NODE_H;
  readonly EDGE_META = EDGE_META;
  readonly toneColor = toneColor;

  readonly flow = signal<Flow | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly recalculating = signal(false);
  readonly executing = signal(false);
  readonly visualizing = signal(false);

  readonly view = signal<View>('map');
  readonly selectedId = signal<string | null>(null);
  readonly zoom = signal(0.8);
  readonly panX = signal(24);
  readonly panY = signal(24);
  /** Live drag positions overriding node.position; keyed by node id. */
  readonly positions = signal<Record<string, { x: number; y: number }>>({});
  readonly forceList = signal(window.innerWidth < 768);

  readonly canvasHeight = '70vh';

  readonly views: { id: View; label: string }[] = [
    { id: 'map', label: 'Map' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'focus', label: 'Focus' },
    { id: 'weakness', label: 'Weakness' },
    { id: 'project', label: 'Project' },
  ];

  readonly legend = [
    { type: 'concept', icon: '◆', label: 'Concept', tone: 'learn' as const },
    { type: 'quiz', icon: '✓', label: 'Checkpoint', tone: 'ai' as const },
    { type: 'weak_area_repair', icon: '⚠', label: 'Repair', tone: 'risk' as const },
    { type: 'mastery_gate', icon: '★', label: 'Gate', tone: 'gate' as const },
  ];

  // drag/pan state (non-reactive)
  private dragNodeId: string | null = null;
  private dragStart = { px: 0, py: 0, ox: 0, oy: 0 };
  private panning = false;
  private panStart = { px: 0, py: 0, ox: 0, oy: 0 };
  private moved = false;

  readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? this.flow()?.nodes.find((n) => n.id === id) ?? null : null;
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loadError.set(true);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(false);
    this.flowApi.get(id).subscribe({
      next: (f) => {
        this.applyFlow(f);
        this.applyDeepLink(f);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  private applyFlow(f: Flow): void {
    this.flow.set(f);
    const map: Record<string, { x: number; y: number }> = {};
    for (const n of f.nodes) map[n.id] = { x: n.position.x, y: n.position.y };
    this.positions.set(map);
  }

  private deepLinkDone = false;
  /** Honor `?node=<id|next>` once — focus a specific node, or the first incomplete one. */
  private applyDeepLink(f: Flow): void {
    if (this.deepLinkDone) return;
    const node = this.route.snapshot.queryParamMap.get('node');
    if (!node) return;
    this.deepLinkDone = true;
    const target =
      node === 'next'
        ? f.nodes.find((n) => n.status !== 'completed' && n.status !== 'skipped')
        : f.nodes.find((n) => n.id === node);
    if (target) {
      this.selectedId.set(target.id);
      this.view.set('focus');
    }
  }

  // ───────── view + helpers ─────────
  setView(v: View): void {
    this.view.set(v);
  }
  meta(n: FlowNode) {
    return FLOW_NODE_META[n.type] ?? { label: n.type, icon: '•', tone: 'neutral' as const };
  }
  pos(n: FlowNode): { x: number; y: number } {
    return this.positions()[n.id] ?? n.position;
  }
  clip(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  statusGlyph(s: string): string {
    return s === 'completed' ? '✓' : s === 'in_progress' ? '◐' : s === 'locked' ? '🔒' : s === 'skipped' ? '⤼' : '○';
  }
  startLabel(n: FlowNode): string {
    switch (n.type) {
      case 'quiz':
      case 'checkpoint':
      case 'mastery_gate':
        return 'Take quiz';
      case 'project':
        return 'Open Project Studio';
      case 'voice_practice':
        return 'Open Voice Room';
      case 'mentor_review':
        return 'Open Mentor Room';
      case 'weak_area_repair':
        return 'Start repair loop';
      default:
        return 'Learn with AI Tutor';
    }
  }

  completedCount(): number {
    return this.flow()?.nodes.filter((n) => n.status === 'completed').length ?? 0;
  }
  availableCount(): number {
    return this.flow()?.nodes.filter((n) => n.status === 'available').length ?? 0;
  }
  weakCount(): number {
    return this.flow()?.nodes.filter((n) => n.type === 'weak_area_repair').length ?? 0;
  }

  timelineBuckets(): { index: number; label: string; focus: string; nodes: FlowNode[] }[] {
    const f = this.flow();
    if (!f) return [];
    const byId = new Map(f.nodes.map((n) => [n.id, n]));
    if (f.timeline?.length) {
      return f.timeline
        .map((b) => ({ ...b, nodes: b.nodeIds.map((id) => byId.get(id)).filter((x): x is FlowNode => !!x) }))
        .filter((b) => b.nodes.length);
    }
    // fallback: group by stage
    const stages = [...new Set(f.nodes.map((n) => n.stage))].sort((a, b) => a - b);
    return stages.map((s) => ({
      index: s,
      label: `Stage ${s + 1}`,
      focus: '',
      nodes: f.nodes.filter((n) => n.stage === s),
    }));
  }

  focusNodes(): FlowNode[] {
    const f = this.flow();
    if (!f) return [];
    return f.nodes
      .filter((n) => n.status === 'in_progress' || n.status === 'available')
      .sort((a, b) => (a.status === 'in_progress' ? -1 : 0) - (b.status === 'in_progress' ? -1 : 0) || a.stage - b.stage)
      .slice(0, 8);
  }

  private highlightSet = computed<Set<string> | null>(() => {
    const f = this.flow();
    if (!f) return null;
    if (this.view() === 'weakness') {
      return new Set(
        f.nodes.filter((n) => n.type === 'weak_area_repair' || (n.masteryScore < 50 && (n.type === 'concept' || n.type === 'practice'))).map((n) => n.id),
      );
    }
    if (this.view() === 'project') {
      const projects = new Set(f.nodes.filter((n) => n.type === 'project').map((n) => n.id));
      const applied = new Set(f.edges.filter((e) => e.relation === 'project_application').map((e) => e.source));
      return new Set([...projects, ...applied]);
    }
    return null; // map view: nothing dimmed
  });

  isDim(nodeId: string): boolean {
    const set = this.highlightSet();
    return set ? !set.has(nodeId) : false;
  }

  prereqTitles(n: FlowNode): string[] {
    const f = this.flow();
    if (!f) return [];
    return n.prerequisites.map((id) => f.nodes.find((x) => x.id === id)?.title ?? id);
  }

  // ───────── edge geometry ─────────
  edgePath(sourceId: string, targetId: string): string {
    const f = this.flow();
    if (!f) return '';
    const s = this.positions()[sourceId] ?? f.nodes.find((n) => n.id === sourceId)?.position;
    const t = this.positions()[targetId] ?? f.nodes.find((n) => n.id === targetId)?.position;
    if (!s || !t) return '';
    const sx = s.x + NODE_W;
    const sy = s.y + NODE_H / 2;
    const tx = t.x;
    const ty = t.y + NODE_H / 2;
    const dx = Math.max(40, Math.abs(tx - sx) * 0.5);
    return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
  }

  // ───────── pointer: pan / drag / select ─────────
  onNodeDown(ev: PointerEvent, n: FlowNode): void {
    ev.stopPropagation();
    this.dragNodeId = n.id;
    const p = this.pos(n);
    this.dragStart = { px: ev.clientX, py: ev.clientY, ox: p.x, oy: p.y };
    this.moved = false;
  }

  onBgDown(ev: PointerEvent): void {
    this.panning = true;
    this.panStart = { px: ev.clientX, py: ev.clientY, ox: this.panX(), oy: this.panY() };
    this.moved = false;
  }

  @HostListener('window:pointermove', ['$event'])
  onMove(ev: PointerEvent): void {
    if (this.dragNodeId) {
      const dx = (ev.clientX - this.dragStart.px) / this.zoom();
      const dy = (ev.clientY - this.dragStart.py) / this.zoom();
      if (Math.abs(ev.clientX - this.dragStart.px) + Math.abs(ev.clientY - this.dragStart.py) > 3) this.moved = true;
      const id = this.dragNodeId;
      this.positions.update((m) => ({ ...m, [id]: { x: this.dragStart.ox + dx, y: this.dragStart.oy + dy } }));
    } else if (this.panning) {
      const dx = ev.clientX - this.panStart.px;
      const dy = ev.clientY - this.panStart.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
      this.panX.set(this.panStart.ox + dx);
      this.panY.set(this.panStart.oy + dy);
    }
  }

  @HostListener('window:pointerup')
  onUp(): void {
    if (this.dragNodeId) {
      const id = this.dragNodeId;
      this.dragNodeId = null;
      if (this.moved) this.commitPosition(id);
      else this.select(id);
    } else if (this.panning) {
      this.panning = false;
      if (!this.moved) this.selectedId.set(null);
    }
  }

  private commitPosition(id: string): void {
    const f = this.flow();
    const p = this.positions()[id];
    if (!f || !p) return;
    this.flowApi.updateNode(f.id, id, { position: { x: Math.round(p.x), y: Math.round(p.y) } }).subscribe({
      next: (updated) => this.flow.set(updated),
      error: () => this.toast.error('Could not save node position'),
    });
  }

  onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    this.zoomBy(ev.deltaY < 0 ? 1.1 : 0.9);
  }
  zoomBy(factor: number): void {
    this.zoom.set(Math.min(2, Math.max(0.4, this.zoom() * factor)));
  }
  resetView(): void {
    this.zoom.set(0.8);
    this.panX.set(24);
    this.panY.set(24);
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  // ───────── node actions ─────────
  start(n: FlowNode): void {
    const f = this.flow();
    if (!f) return;
    this.executing.set(true);
    this.flowApi.executeNode(f.id, n.id).subscribe({
      next: ({ flow, execution }) => {
        this.executing.set(false);
        this.flow.set(flow);
        this.toast.success(`Started · opening ${execution.kind}`);
        this.router.navigate([execution.route], {
          queryParams: execution.prompt ? { prompt: execution.prompt, flowId: f.id, nodeId: n.id } : undefined,
        });
      },
      error: (err: Error) => {
        this.executing.set(false);
        this.toast.error(err.message || 'Could not start this node');
      },
    });
  }

  setStatus(n: FlowNode, status: 'completed' | 'available'): void {
    const f = this.flow();
    if (!f) return;
    const wasComplete = f.status === 'completed';
    this.flowApi.updateNode(f.id, n.id, { status }).subscribe({
      next: (updated) => {
        this.flow.set(updated);
        // Celebrate the moment the whole flow is mastered.
        if (!wasComplete && updated.status === 'completed') {
          this.confetti.burst({ y: 0.35, count: 160 });
          this.toast.success('🎉 Flow complete — every node mastered!');
        } else if (status === 'completed' && n.type === 'weak_area_repair') {
          this.toast.success('Repair mastered — Mistake OS gap closed ✓');
        } else {
          this.toast.success(status === 'completed' ? 'Node mastered — next nodes unlocked' : 'Node reopened');
        }
      },
      error: (err: Error) => this.toast.error(err.message || 'Could not update node'),
    });
  }

  /** Save the learner's private note for a node (on blur; skips no-op writes). */
  saveNote(n: FlowNode, value: string): void {
    const f = this.flow();
    if (!f || value === n.notes) return;
    this.flowApi.updateNode(f.id, n.id, { notes: value }).subscribe({
      next: (updated) => this.flow.set(updated),
      error: () => this.toast.error('Could not save note'),
    });
  }

  /** Deep-link targets for whatever a node is linked to (only present links are returned). */
  linkedJumps(n: FlowNode): { icon: string; label: string; route: string }[] {
    const out: { icon: string; label: string; route: string }[] = [];
    if (n.linkedRoadmapId) out.push({ icon: '🗺', label: 'Roadmap', route: `/app/roadmap/${n.linkedRoadmapId}` });
    if (n.linkedQuizId) out.push({ icon: '✓', label: 'Quiz', route: `/app/quizzes?quizId=${n.linkedQuizId}` });
    if (n.linkedProjectId) out.push({ icon: '🛠', label: 'Project', route: '/app/projects' });
    if (n.linkedKnowledgeDocumentIds?.length) out.push({ icon: '▤', label: 'Knowledge', route: '/app/knowledge' });
    if (n.linkedVisualAssetIds?.length) out.push({ icon: '✦', label: 'Visual', route: `/app/visuals/${n.linkedVisualAssetIds[0]}` });
    if (n.linkedVoiceSessionIds?.length) out.push({ icon: '🎙', label: 'Voice', route: `/app/voice-room/session/${n.linkedVoiceSessionIds[0]}` });
    return out;
  }
  jumpTo(route: string): void { void this.router.navigateByUrl(route); }

  /** Friendly relative time, used for "mastered N days ago". */
  ago(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const d = Math.floor(ms / 86_400_000);
    if (d <= 0) {
      const h = Math.floor(ms / 3_600_000);
      return h >= 1 ? `${h}h ago` : 'just now';
    }
    if (d === 1) return 'yesterday';
    return `${d}d ago`;
  }

  explainVisually(n: FlowNode): void {
    const f = this.flow();
    if (!f) return;
    this.visualizing.set(true);
    this.visualApi.fromFlowNode(f.id, n.id).subscribe({
      next: (v) => {
        this.visualizing.set(false);
        this.toast.success('Visual generated for this node');
        this.router.navigate(['/app/visuals', v.id]);
      },
      error: (err: Error) => {
        this.visualizing.set(false);
        this.toast.error(err.message || 'Could not generate a visual');
      },
    });
  }

  recalculate(): void {
    const f = this.flow();
    if (!f) return;
    this.recalculating.set(true);
    this.flowApi.recalculate(f.id).subscribe({
      next: (updated) => {
        this.applyFlow(updated);
        this.recalculating.set(false);
        this.toast.success('Flow recalculated');
      },
      error: (err: Error) => {
        this.recalculating.set(false);
        this.toast.error(err.message || 'Could not recalculate');
      },
    });
  }

  exportFlow(): void {
    const f = this.flow();
    if (!f) return;
    this.flowApi.export(f.id).subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${f.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.flow.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Could not export flow'),
    });
  }

  back(): void {
    this.router.navigate(['/app/flows']);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.forceList.set(window.innerWidth < 768);
  }
}
