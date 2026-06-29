import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { ChartTone, TONE_VAR } from './chart-utils';

export interface HeatRow {
  label: string;
  cells: { label: string; value: number }[];
}

/**
 * `asta-heatmap` — labelled grid where cell intensity encodes a value (weakness
 * by topic × difficulty, etc.). Token-driven (opacity ramp on a tone), hover
 * tooltip, empty state, a11y. CSS-grid based so it reflows responsively.
 */
@Component({
  selector: 'asta-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!rows.length) {
      <div class="empty">No data yet</div>
    } @else {
      <div class="hm" role="img" [attr.aria-label]="ariaLabel || label" (pointerleave)="tip.set(null)">
        @if (cols.length) {
          <div class="hdr" [style.grid-template-columns]="colTemplate()">
            <span></span>
            @for (col of cols; track col) { <span class="ch" [title]="col">{{ col }}</span> }
          </div>
        }
        @for (r of rows; track r.label; let ri = $index) {
          <div class="rw" [style.grid-template-columns]="colTemplate()">
            <span class="rh" [title]="r.label">{{ r.label }}</span>
            @for (cell of r.cells; track cell.label; let ci = $index) {
              <span class="cell" [style.background]="cellColor(cell.value)"
                (pointerenter)="tip.set({ r: ri, c: ci, t: r.label + ' · ' + cell.label, v: cell.value })">
              </span>
            }
          </div>
        }
        @if (tip(); as tp) {
          <div class="tt"><span class="tl">{{ tp.t }}</span><span class="tv">{{ tp.v }}</span></div>
        }
      </div>
    }
  `,
  styles: [
    `
      .empty { display: grid; place-items: center; min-height: 80px; color: var(--text-mute); font-family: var(--mono); font-size: 12px; }
      .hm { position: relative; display: flex; flex-direction: column; gap: 5px; }
      .hdr, .rw { display: grid; gap: 5px; align-items: center; }
      .ch { font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; color: var(--text-mute); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rh { font-size: 12.5px; color: var(--text-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 4px; }
      .cell { aspect-ratio: 1; min-height: 22px; border-radius: 6px; border: 1px solid var(--paper-3); transition: transform .12s; }
      .cell:hover { transform: scale(1.08); }
      /* Cells wave in left-to-right across each row (backwards fill keeps :hover scale intact). */
      .cell { animation: hmCellIn .4s var(--ease) backwards; }
      @keyframes hmCellIn { from { opacity: 0; transform: scale(.55); } }
      .rw .cell:nth-child(2) { animation-delay: 0s; }
      .rw .cell:nth-child(3) { animation-delay: .04s; }
      .rw .cell:nth-child(4) { animation-delay: .08s; }
      .rw .cell:nth-child(5) { animation-delay: .12s; }
      .rw .cell:nth-child(6) { animation-delay: .16s; }
      .rw .cell:nth-child(7) { animation-delay: .2s; }
      .rw .cell:nth-child(8) { animation-delay: .24s; }
      .rw .cell:nth-child(n+9) { animation-delay: .28s; }
      @media (prefers-reduced-motion: reduce) { .cell { animation: none; } }
      .tt { position: absolute; top: -4px; right: 0; transform: translateY(-100%); background: var(--ink); color: var(--on-ink);
        padding: 5px 9px; border-radius: 8px; box-shadow: var(--shadow-md); display: flex; gap: 8px; align-items: baseline; pointer-events: none; }
      .tl { font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; color: var(--on-ink-mute); }
      .tv { font-family: var(--display); font-weight: 600; font-size: 13px; }
    `,
  ],
})
export class HeatmapComponent {
  @Input() rows: HeatRow[] = [];
  @Input() cols: string[] = [];
  @Input() tone: ChartTone = 'coral';
  @Input() label = 'Heatmap';
  @Input() ariaLabel = '';

  readonly tip = signal<{ r: number; c: number; t: string; v: number } | null>(null);

  private readonly maxV = computed(() =>
    Math.max(1, ...this.rows.flatMap((r) => r.cells.map((c) => c.value))),
  );

  colTemplate(): string {
    const n = this.rows[0]?.cells.length ?? this.cols.length ?? 1;
    return `minmax(56px, 1.3fr) repeat(${n}, 1fr)`;
  }

  cellColor(v: number): string {
    const intensity = Math.max(0.06, v / this.maxV());
    return `color-mix(in oklch, ${TONE_VAR[this.tone]} ${Math.round(intensity * 100)}%, var(--paper))`;
  }
}
