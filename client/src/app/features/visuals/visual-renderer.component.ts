import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeUrl } from '@angular/platform-browser';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { Visual, VisualGraph } from '../../core/services/visual.service';

interface PlacedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  kind?: string;
  group?: string;
}
interface PlacedEdge {
  d: string;
  label?: string;
  lx: number;
  ly: number;
}

const NW = 158;
const NH = 48;
const GAP_Y = 34;
const GAP_X = 56;

/** Renders a Visual in whatever format it was generated in — jsonGraph→SVG, markdown, image, mermaid, svg. */
@Component({
    selector: 'asta-visual-renderer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MarkdownPipe],
    template: `
    @switch (visual.contentFormat) {
      @case ('jsonGraph') {
        @if (graph(); as g) {
          <svg class="vgraph" [attr.viewBox]="viewBox()" preserveAspectRatio="xMidYMid meet" role="img" [attr.aria-label]="visual.title">
            @for (e of edges(); track $index) {
              <path class="ve" [attr.d]="e.d" pathLength="1" />
              @if (e.label) { <text class="vel" [attr.x]="e.lx" [attr.y]="e.ly">{{ e.label }}</text> }
            }
            @for (n of nodes(); track n.id) {
              <g [attr.transform]="'translate(' + n.x + ',' + n.y + ')'">
                <rect class="vn" [class.root]="n.kind === 'root'" [class.accent]="n.kind === 'accent'" [attr.width]="NW" [attr.height]="NH" rx="12" />
                <text class="vnt" [attr.x]="NW / 2" [attr.y]="NH / 2 + 4" text-anchor="middle">{{ clip(n.label) }}</text>
                @if (n.group) { <text class="vng" [attr.x]="NW / 2" y="-6" text-anchor="middle">{{ n.group }}</text> }
              </g>
            }
          </svg>
        } @else {
          <p class="vfail">Could not parse this graph.</p>
        }
      }
      @case ('imageUrl') {
        <img class="vimg" [src]="safeUrl()" [alt]="visual.title" />
      }
      @case ('svg') {
        <div class="vsvg" [innerHTML]="safeHtml()"></div>
      }
      @case ('html') {
        <div class="vhtml" [innerHTML]="safeHtml()"></div>
      }
      @case ('markdown') {
        <div class="vmd prose-asta" [innerHTML]="visual.content | markdown"></div>
      }
      @case ('mermaid') {
        @if (mermaidSvg(); as svg) {
          <div class="vmermaid" [innerHTML]="svg"></div>
        } @else if (mermaidFailed()) {
          <pre class="vcode">{{ visual.content }}</pre>
        } @else {
          <p class="vhint">Rendering diagram…</p>
        }
      }
    }
  `,
    styles: [
        `
      :host { display: block; }
      .vgraph { width: 100%; height: auto; max-height: 62vh; display: block; }
      .ve { fill: none; stroke: color-mix(in oklab, var(--text-mute) 65%, transparent); stroke-width: 1.4; }
      .vel { fill: var(--text-mute); font-size: 10px; }
      .vn { fill: var(--paper-2); stroke: color-mix(in oklab, var(--green) 55%, var(--paper-3)); stroke-width: 1.5; }
      .vn.root { fill: color-mix(in oklab, var(--green) 18%, var(--paper-2)); stroke: var(--green); }
      .vn.accent { stroke: var(--peri, #8aa6ff); }
      .vnt { fill: var(--text); font-size: 12px; font-weight: 600; }
      .vng { fill: var(--text-mute); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
      .vimg { width: 100%; height: auto; border-radius: 14px; display: block; }
      .vsvg, .vhtml { width: 100%; overflow: auto; }
      .vmermaid { width: 100%; overflow: auto; display: flex; justify-content: center; }
      .vmermaid svg { max-width: 100%; height: auto; }
      .vmd { font-size: 14px; line-height: 1.6; }
      .vhint { font-size: 12px; color: var(--text-mute); margin-bottom: 8px; }
      .vcode { background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 14px; font-size: 12.5px; white-space: pre; overflow: auto; color: var(--text-soft); }
      .vfail { color: var(--text-mute); font-size: 13px; }

      /* The diagram assembles itself: nodes pop in, then the connections draw between them. */
      .vgraph g { animation: vnPop .4s var(--ease-spring) both; transform-box: fill-box; }
      @keyframes vnPop { from { opacity: 0; transform: scale(.8); } }
      .vgraph g:nth-of-type(2) { animation-delay: .04s; }
      .vgraph g:nth-of-type(3) { animation-delay: .08s; }
      .vgraph g:nth-of-type(4) { animation-delay: .12s; }
      .vgraph g:nth-of-type(5) { animation-delay: .16s; }
      .vgraph g:nth-of-type(6) { animation-delay: .2s; }
      .vgraph g:nth-of-type(7) { animation-delay: .24s; }
      .vgraph g:nth-of-type(8) { animation-delay: .28s; }
      .ve { stroke-dasharray: 1; stroke-dashoffset: 1; animation: veDraw .7s var(--ease) .25s forwards; }
      @keyframes veDraw { to { stroke-dashoffset: 0; } }
      .vel { animation: astaRevealUp .4s var(--ease) .7s both; }
      .vimg, .vsvg, .vhtml, .vmermaid, .vmd { animation: astaRevealUp .5s var(--ease) both; }
      @media (prefers-reduced-motion: reduce) {
        .vgraph g, .ve, .vel, .vimg, .vsvg, .vhtml, .vmermaid, .vmd { animation: none; stroke-dashoffset: 0; }
      }
    `,
    ]
})
export class VisualRendererComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly NW = NW;
  readonly NH = NH;

  private readonly _visual = signal<Visual | null>(null);
  readonly mermaidSvg = signal<SafeHtml | null>(null);
  readonly mermaidFailed = signal(false);
  @Input({ required: true }) set visual(v: Visual) {
    this._visual.set(v);
    this.mermaidSvg.set(null);
    this.mermaidFailed.set(false);
    if (v.contentFormat === 'mermaid' && v.content) {
      void this.drawMermaid(v.content);
    }
  }
  get visual(): Visual {
    return this._visual()!;
  }

  private async drawMermaid(code: string): Promise<void> {
    try {
      const { renderMermaid } = await import('../../shared/util/mermaid');
      const svg = await renderMermaid(code);
      this.mermaidSvg.set(this.sanitizer.bypassSecurityTrustHtml(svg));
    } catch {
      this.mermaidFailed.set(true);
    }
  }

  readonly graph = computed<VisualGraph | null>(() => {
    const v = this._visual();
    if (!v || v.contentFormat !== 'jsonGraph') return null;
    try {
      const g = JSON.parse(v.content) as VisualGraph;
      return g.nodes?.length ? g : null;
    } catch {
      return null;
    }
  });

  private readonly placed = computed<{ nodes: PlacedNode[]; w: number; h: number }>(() => {
    const g = this.graph();
    if (!g) return { nodes: [], w: 0, h: 0 };
    const pad = 30;
    const nodes: PlacedNode[] = [];
    if (g.layout === 'vertical') {
      g.nodes.forEach((n, i) => nodes.push({ ...n, x: pad, y: pad + i * (NH + GAP_Y) }));
      return { nodes, w: NW + pad * 2, h: pad * 2 + g.nodes.length * (NH + GAP_Y) - GAP_Y };
    }
    if (g.layout === 'horizontal') {
      g.nodes.forEach((n, i) => nodes.push({ ...n, x: pad + i * (NW + GAP_X), y: pad }));
      return { nodes, w: pad * 2 + g.nodes.length * (NW + GAP_X) - GAP_X, h: NH + pad * 2 };
    }
    if (g.layout === 'radial') {
      const root = g.nodes.find((n) => n.kind === 'root') ?? g.nodes[0];
      const others = g.nodes.filter((n) => n.id !== root.id);
      const R = Math.max(150, others.length * 26);
      const cx = R + NW / 2 + pad;
      const cy = R + NH / 2 + pad;
      nodes.push({ ...root, x: cx - NW / 2, y: cy - NH / 2 });
      others.forEach((n, i) => {
        const a = (i / others.length) * Math.PI * 2 - Math.PI / 2;
        nodes.push({ ...n, x: cx + Math.cos(a) * R - NW / 2, y: cy + Math.sin(a) * R - NH / 2 });
      });
      return { nodes, w: (R + NW / 2 + pad) * 2, h: (R + NH / 2 + pad) * 2 };
    }
    // layered: rows by group order
    const groups: string[] = [];
    g.nodes.forEach((n) => {
      const gp = n.group ?? 'default';
      if (!groups.includes(gp)) groups.push(gp);
    });
    let maxRow = 0;
    groups.forEach((gp, gi) => {
      const row = g.nodes.filter((n) => (n.group ?? 'default') === gp);
      maxRow = Math.max(maxRow, row.length);
      row.forEach((n, i) => nodes.push({ ...n, x: pad + i * (NW + GAP_X), y: pad + gi * (NH + GAP_Y + 14) }));
    });
    return { nodes, w: pad * 2 + maxRow * (NW + GAP_X) - GAP_X, h: pad * 2 + groups.length * (NH + GAP_Y + 14) - GAP_Y };
  });

  readonly nodes = computed(() => this.placed().nodes);

  readonly edges = computed<PlacedEdge[]>(() => {
    const g = this.graph();
    const pn = this.placed().nodes;
    if (!g) return [];
    const byId = new Map(pn.map((n) => [n.id, n]));
    const horizontal = g.layout === 'horizontal';
    return g.edges
      .map((e) => {
        const s = byId.get(e.from);
        const t = byId.get(e.to);
        if (!s || !t) return null;
        let sx: number, sy: number, tx: number, ty: number;
        if (horizontal) {
          sx = s.x + NW; sy = s.y + NH / 2; tx = t.x; ty = t.y + NH / 2;
        } else {
          sx = s.x + NW / 2; sy = s.y + NH; tx = t.x + NW / 2; ty = t.y;
        }
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const d = horizontal
          ? `M ${sx} ${sy} C ${sx + 40} ${sy}, ${tx - 40} ${ty}, ${tx} ${ty}`
          : `M ${sx} ${sy} C ${sx} ${sy + 28}, ${tx} ${ty - 28}, ${tx} ${ty}`;
        return { d, label: e.label, lx: mx, ly: my - 4 } as PlacedEdge;
      })
      .filter((x): x is PlacedEdge => !!x);
  });

  readonly viewBox = computed(() => {
    const { w, h } = this.placed();
    return `0 0 ${Math.max(w, 100)} ${Math.max(h, 100)}`;
  });

  safeHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this._visual()?.content ?? '');
  }
  safeUrl(): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(this._visual()?.content ?? '');
  }
  clip(s: string): string {
    return s.length > 22 ? s.slice(0, 21) + '…' : s;
  }
}
