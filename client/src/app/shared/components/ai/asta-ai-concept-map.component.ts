import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { ConceptMapBlock } from '../../../core/models';

interface PlacedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  root: boolean;
}

/** Radial concept map — root in the centre, pillars around it (lightweight SVG). */
@Component({
  selector: 'asta-ai-concept-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" style="padding:16px">
      <p class="kicker mb-3" style="color:var(--peri-deep)">{{ block().title }}</p>
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="w-full" [style.height.px]="H">
        @for (n of nodes(); track n.id) {
          @if (!n.root) {
            <line [attr.x1]="W / 2" [attr.y1]="H / 2" [attr.x2]="n.x" [attr.y2]="n.y"
              stroke="var(--paper-3)" stroke-width="1.5" pathLength="1" class="cm-spoke" />
          }
        }
        @for (n of nodes(); track n.id) {
          <g>
            <rect [attr.x]="n.x - halfW(n)" [attr.y]="n.y - 15" [attr.width]="halfW(n) * 2" height="30" rx="15"
              [attr.fill]="n.root ? 'var(--ink)' : 'var(--paper-2)'"
              [attr.stroke]="n.root ? 'var(--ink)' : 'var(--paper-3)'" stroke-width="1" />
            <text [attr.x]="n.x" [attr.y]="n.y + 4" text-anchor="middle"
              [attr.fill]="n.root ? 'var(--paper)' : 'var(--text)'"
              font-size="12" font-weight="600" font-family="var(--body)">{{ n.label }}</text>
          </g>
        }
      </svg>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      /* The concept radiates: root settles, spokes draw outward, pillars arrive. */
      .cm-spoke { stroke-dasharray: 1; stroke-dashoffset: 1; animation: cmSpoke 0.5s var(--ease) 0.25s forwards; }
      @keyframes cmSpoke { to { stroke-dashoffset: 0; } }
      svg g { animation: cmNode 0.4s var(--ease-spring) both; transform-box: fill-box; transform-origin: center; }
      @keyframes cmNode { from { opacity: 0; transform: scale(0.5); } }
      svg g:nth-of-type(2) { animation-delay: 0.45s; }
      svg g:nth-of-type(3) { animation-delay: 0.52s; }
      svg g:nth-of-type(4) { animation-delay: 0.59s; }
      svg g:nth-of-type(5) { animation-delay: 0.66s; }
      svg g:nth-of-type(6) { animation-delay: 0.73s; }
      svg g:nth-of-type(7) { animation-delay: 0.8s; }
      svg g:nth-of-type(8) { animation-delay: 0.87s; }
      @media (prefers-reduced-motion: reduce) {
        .cm-spoke { animation: none; stroke-dashoffset: 0; }
        svg g { animation: none; }
      }
    `,
  ],
})
export class AiConceptMapComponent {
  @Input({ required: true }) set data(v: ConceptMapBlock) {
    this.block.set(v);
  }
  readonly block = signal<ConceptMapBlock>({ type: 'concept_map', title: '', rootConcept: '', nodes: [], edges: [] });

  readonly W = 520;
  readonly H = 300;

  readonly nodes = computed<PlacedNode[]>(() => {
    const b = this.block();
    const pillars = b.nodes.filter((n) => n.group !== 'root');
    const root = b.nodes.find((n) => n.group === 'root');
    const cx = this.W / 2;
    const cy = this.H / 2;
    const radius = 110;
    const placed: PlacedNode[] = [];
    if (root) placed.push({ id: root.id, label: root.label, x: cx, y: cy, root: true });
    pillars.forEach((n, i) => {
      const angle = (i / Math.max(1, pillars.length)) * Math.PI * 2 - Math.PI / 2;
      placed.push({
        id: n.id,
        label: n.label,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * (radius * 0.78),
        root: false,
      });
    });
    return placed;
  });

  halfW(n: PlacedNode): number {
    return Math.max(34, Math.min(90, n.label.length * 4.2 + 14));
  }
}
