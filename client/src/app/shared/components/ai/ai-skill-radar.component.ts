import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

export interface RadarAxis {
  label: string;
  value: number; // 0–100
  target?: number; // 0–100
}

/** Lightweight SVG radar/spider chart for skill intelligence. */
@Component({
  selector: 'ai-skill-radar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + S + ' ' + S" class="w-full" [style.maxWidth.px]="S">
      <!-- rings -->
      @for (r of rings; track r) {
        <polygon [attr.points]="ringPoints(r)" fill="none" stroke="var(--paper-3)" stroke-width="1" />
      }
      <!-- axes -->
      @for (a of axes(); track a.label; let i = $index) {
        <line [attr.x1]="c" [attr.y1]="c" [attr.x2]="axisPoint(i, 1).x" [attr.y2]="axisPoint(i, 1).y"
          stroke="var(--paper-3)" stroke-width="1" />
      }
      <!-- target polygon -->
      @if (hasTarget()) {
        <polygon [attr.points]="targetPoints()" fill="oklch(0.78 0.15 268 / .08)" stroke="var(--peri)" stroke-width="1" stroke-dasharray="4 4" />
      }
      <!-- value polygon -->
      <polygon [attr.points]="valuePoints()" fill="oklch(0.80 0.16 150 / .22)" stroke="var(--green-deep)" stroke-width="2" />
      <!-- labels -->
      @for (a of axes(); track a.label; let i = $index) {
        <text [attr.x]="axisPoint(i, 1.18).x" [attr.y]="axisPoint(i, 1.18).y" text-anchor="middle"
          font-size="10.5" font-family="var(--mono)" fill="var(--text-soft)">{{ a.label }}</text>
      }
    </svg>
  `,
})
export class AiSkillRadarComponent {
  @Input({ required: true }) set data(v: RadarAxis[]) {
    this.axes.set(v.slice(0, 8));
  }
  readonly axes = signal<RadarAxis[]>([]);

  readonly S = 240;
  readonly c = 120;
  readonly maxR = 92;
  readonly rings = [0.25, 0.5, 0.75, 1];

  readonly hasTarget = computed(() => this.axes().some((a) => typeof a.target === 'number'));

  private point(i: number, ratio: number): { x: number; y: number } {
    const n = this.axes().length || 1;
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: this.c + Math.cos(angle) * this.maxR * ratio, y: this.c + Math.sin(angle) * this.maxR * ratio };
  }
  axisPoint(i: number, ratio: number) {
    return this.point(i, ratio);
  }
  ringPoints(ratio: number): string {
    return this.axes().map((_, i) => { const p = this.point(i, ratio); return `${p.x},${p.y}`; }).join(' ');
  }
  valuePoints(): string {
    return this.axes().map((a, i) => { const p = this.point(i, Math.max(0, Math.min(1, a.value / 100))); return `${p.x},${p.y}`; }).join(' ');
  }
  targetPoints(): string {
    return this.axes().map((a, i) => { const p = this.point(i, Math.max(0, Math.min(1, (a.target ?? 0) / 100))); return `${p.x},${p.y}`; }).join(' ');
  }
}
