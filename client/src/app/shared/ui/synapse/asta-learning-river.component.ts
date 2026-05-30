import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RiverNode } from './synapse.types';

interface Pt { x: number; y: number; }
let riverSeq = 0;

const W = 1000;
const H = 240;
const PAD = 64;
const AMP = 52;

/** Catmull-Rom spline → cubic Bézier for a smooth, flowing curve. */
function buildPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Asta — Learning River. The signature path visual: a flowing gradient curve
 * through milestone markers (completed / current / upcoming / locked), with a
 * drawn-in active segment, moving energy, a glowing current node, and alternating
 * label chips. Collapses to a clean vertical spine on small screens.
 */
@Component({
  selector: 'asta-learning-river',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="canvas">
      <svg class="svg" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="var(--asta-accent)" />
            <stop offset="0.5" stop-color="var(--asta-cyan)" />
            <stop offset="1" stop-color="var(--asta-accent-2)" />
          </linearGradient>
        </defs>
        <path class="base" [attr.d]="basePath()" />
        <path class="glow" [attr.d]="activePath()" [attr.stroke]="'url(#' + gradId + ')'" />
        <path class="flow" [attr.d]="activePath()" [attr.stroke]="'url(#' + gradId + ')'" />
      </svg>

      @for (n of placed(); track $index) {
        <button
          type="button"
          class="node {{ n.node.state }} {{ $index % 2 === 0 ? 'above' : 'below' }}"
          [style.left]="n.left"
          [style.top]="n.top"
          (click)="select.emit(n.node)"
        >
          <span class="marker">
            @switch (n.node.state) {
              @case ('completed') { <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> }
              @case ('locked') { <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> }
              @default { <em>{{ $index + 1 }}</em> }
            }
          </span>
          <span class="chip">
            <strong>{{ n.node.label }}</strong>
            <small>{{ n.node.hint || stateLabel(n.node.state) }}</small>
          </span>
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .canvas { position: relative; height: 300px; }
      .svg { position: absolute; inset: 0; width: 100%; height: 100%; }
      .base, .glow, .flow { fill: none; stroke-linecap: round; }
      .base { stroke: color-mix(in oklch, var(--text-mute) 20%, transparent); stroke-width: 4; }
      .glow {
        stroke-width: 5;
        filter: drop-shadow(0 0 10px var(--asta-accent-glow));
        stroke-dasharray: 2400;
        stroke-dashoffset: 2400;
        animation: riverDrawIn 1.6s var(--ease) forwards;
      }
      /* Moving energy — dotted overlay that flows toward the current node. */
      .flow {
        stroke-width: 5;
        stroke-dasharray: 1 18;
        opacity: 0.9;
        animation: riverFlow 1s linear infinite;
      }
      @keyframes riverDrawIn { to { stroke-dashoffset: 0; } }
      @keyframes riverFlow { to { stroke-dashoffset: -38; } }

      .node {
        position: absolute;
        transform: translate(-50%, -50%);
        width: 0; height: 0;
        border: 0; background: none; padding: 0; cursor: pointer;
        z-index: 1;
      }
      .marker {
        position: absolute;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 34px; height: 34px;
        display: grid; place-items: center;
        border-radius: 999px;
        font-family: var(--mono); font-size: 12px; font-weight: 600;
        color: var(--text-soft);
        background: color-mix(in oklch, var(--paper) 86%, transparent);
        border: 1px solid color-mix(in oklch, var(--text-mute) 22%, transparent);
        backdrop-filter: blur(4px);
        transition: transform .24s var(--ease-spring), box-shadow .24s var(--ease), border-color .24s var(--ease);
      }
      .node:hover .marker { transform: translate(-50%, -50%) scale(1.16); }
      .node.completed .marker { color: #06100a; background: linear-gradient(135deg, var(--asta-accent), var(--asta-accent-2)); border-color: transparent; box-shadow: 0 0 16px var(--asta-accent-glow); }
      .node.active .marker {
        color: #06100a;
        background: radial-gradient(circle at 34% 28%, #fff, transparent 30%), conic-gradient(from 140deg, var(--asta-accent), var(--asta-cyan), var(--asta-accent-2), var(--asta-accent));
        border-color: transparent;
        width: 42px; height: 42px;
        box-shadow: 0 0 0 6px color-mix(in oklch, var(--asta-cyan) 14%, transparent), 0 0 26px var(--asta-accent-glow);
        animation: nodePulse 2.4s ease-in-out infinite;
      }
      .node.locked .marker { opacity: 0.7; }
      @keyframes nodePulse {
        0%, 100% { box-shadow: 0 0 0 6px color-mix(in oklch, var(--asta-cyan) 14%, transparent), 0 0 26px var(--asta-accent-glow); }
        50% { box-shadow: 0 0 0 12px color-mix(in oklch, var(--asta-cyan) 4%, transparent), 0 0 34px var(--asta-accent-glow); }
      }

      /* Label chip — alternates above / below the node, with a hairline connector. */
      .chip {
        position: absolute;
        left: 50%;
        width: 152px;
        transform: translateX(-50%);
        display: grid; gap: 1px;
        padding: 9px 12px;
        border-radius: var(--r-sm);
        text-align: center;
        background: var(--paper);
        border: 1px solid color-mix(in oklch, var(--paper-3) 50%, transparent);
        box-shadow: var(--shadow-sm);
        transition: transform .24s var(--ease), box-shadow .24s var(--ease), border-color .24s var(--ease);
      }
      .node.above .chip { bottom: calc(50% + 34px); }
      .node.below .chip { top: calc(50% + 34px); }
      .chip::after {
        content: ''; position: absolute; left: 50%; transform: translateX(-50%);
        width: 1px; height: 18px;
        background: color-mix(in oklch, var(--text-mute) 26%, transparent);
      }
      .node.above .chip::after { top: 100%; }
      .node.below .chip::after { bottom: 100%; }
      .chip strong { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.2; }
      .chip small { font-size: 11px; color: var(--text-mute); line-height: 1.2; }
      .node:hover .chip { transform: translateX(-50%) translateY(-2px); box-shadow: var(--shadow-md); border-color: color-mix(in oklch, var(--asta-accent) 30%, transparent); }
      .node.active .chip { border-color: color-mix(in oklch, var(--asta-cyan) 32%, transparent); }
      .node.upcoming .chip, .node.locked .chip { opacity: 0.82; }

      /* Vertical spine on small screens — no overlap, fully readable. */
      @media (max-width: 760px) {
        .canvas { height: auto; padding-left: 30px; }
        .svg { display: none; }
        .canvas::before { content: ''; position: absolute; left: 12px; top: 14px; bottom: 14px; width: 2px; background: linear-gradient(180deg, var(--asta-accent), var(--asta-cyan), color-mix(in oklch, var(--text-mute) 24%, transparent)); border-radius: 2px; }
        .node { position: relative; left: auto !important; top: auto !important; transform: none; width: 100%; height: auto; display: grid; grid-template-columns: 0 1fr; align-items: center; margin: 10px 0; }
        .marker { position: relative; left: -30px; top: auto; transform: none; }
        .node:hover .marker { transform: scale(1.1); }
        .node.active .marker { transform: none; }
        .chip { position: relative; left: auto; top: auto !important; bottom: auto !important; transform: none; width: 100%; text-align: left; }
        .chip::after { display: none; }
        .node:hover .chip { transform: translateY(-2px); }
      }
    `,
  ],
})
export class AstaLearningRiverComponent {
  readonly nodes = input<RiverNode[]>([]);
  readonly select = output<RiverNode>();

  readonly W = W;
  readonly H = H;
  readonly gradId = `astaRiver${++riverSeq}`;

  private readonly points = computed<Pt[]>(() => {
    const ns = this.nodes();
    const n = ns.length;
    if (n === 0) return [];
    return ns.map((_, i) => {
      const x = n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1);
      const y = Math.max(56, Math.min(H - 56, H / 2 + AMP * Math.sin(i * 1.05 + 0.6)));
      return { x, y };
    });
  });

  private readonly activeIdx = computed(() => {
    const ns = this.nodes();
    const a = ns.findIndex((x) => x.state === 'active');
    if (a >= 0) return a;
    let last = -1;
    ns.forEach((x, i) => { if (x.state === 'completed') last = i; });
    return Math.max(last, 0);
  });

  readonly basePath = computed(() => buildPath(this.points()));
  readonly activePath = computed(() => buildPath(this.points().slice(0, this.activeIdx() + 1)));

  readonly placed = computed(() =>
    this.points().map((p, i) => ({ node: this.nodes()[i], left: `${(p.x / 10).toFixed(2)}%`, top: `${(p.y / 2.4).toFixed(2)}%` })),
  );

  stateLabel(s: RiverNode['state']): string {
    return s === 'completed' ? 'Completed' : s === 'active' ? 'Current focus' : s === 'locked' ? 'Locked' : 'Upcoming';
  }
}
