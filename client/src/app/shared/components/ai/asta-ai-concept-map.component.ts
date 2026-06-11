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
              stroke="var(--paper-3)" stroke-width="1.5" />
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
