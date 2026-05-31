import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { InstitutionOverview, InstitutionService } from '../../core/services/institution.service';

@Component({
  selector: 'asta-institution',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, RingComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Institution</h1>
        <span class="goal-pill"><span class="dot"></span>{{ o()?.orgName || 'Cohort placement-readiness analytics' }}</span>
      </div>
      <div class="shrink-0"><asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn></div>
    </header>

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-4 mb-4">@for (i of [1,2,3,4]; track i) { <asta-card><asta-skeleton h="80px" /></asta-card> }</div>
      <asta-card><asta-skeleton h="200px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Institution analytics unavailable" description="You need to be an admin or mentor in an institution to view this."><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (o()) {
      @if (o(); as ov) {
      <div class="grid gap-3 sm:grid-cols-4 motion-row-primary mb-4">
        <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="0"><p class="num">{{ ov.totals.students }}</p><p class="lbl">Students</p></asta-card>
        <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="1"><p class="num">{{ ov.totals.avgReadiness }}</p><p class="lbl">Avg readiness</p></asta-card>
        <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="2"><p class="num" style="color:var(--green-deep)">{{ ov.totals.jobReady }}</p><p class="lbl">Job-ready</p></asta-card>
        <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="3"><p class="num" style="color:var(--coral, #ffb454)">{{ ov.totals.atRisk }}</p><p class="lbl">At risk</p></asta-card>
      </div>

      <div class="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
        <div class="min-w-0 space-y-4">
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-3">Cohorts</p>
            @if (ov.cohorts.length) {
              <div class="space-y-2">
                @for (c of ov.cohorts; track c.id) {
                  <div class="cohort">
                    <div class="flex items-center gap-3">
                      <asta-ring [value]="c.avgReadiness" [size]="48" />
                      <span class="min-w-0 flex-1"><span class="c-name">{{ c.name }}</span><span class="c-meta">{{ c.students }} students · {{ c.atRisk }} at risk</span></span>
                    </div>
                    <div class="flex items-center gap-2 mt-2">
                      <input class="inp" placeholder="Assign flow/template title…" [(ngModel)]="assignTitle[c.id]" />
                      <asta-btn size="sm" variant="ghost" (click)="assign(c.id)" [disabled]="!assignTitle[c.id]">Assign</asta-btn>
                    </div>
                  </div>
                }
              </div>
            } @else { <p class="text-sm text-txt-mute">No cohorts yet.</p> }
          </asta-card>

          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-3">Weak concepts across cohorts</p>
            @if (ov.weakConcepts.length) {
              <div class="flex flex-wrap gap-1.5">@for (w of ov.weakConcepts; track w.concept) { <span class="weak">{{ w.concept }} <em>×{{ w.count }}</em></span> }</div>
            } @else { <p class="text-sm text-txt-mute">No common weak areas detected.</p> }
          </asta-card>
        </div>

        <div class="space-y-4">
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-2">Top performers</p>
            @for (s of ov.topPerformers; track s.name) { <div class="prow"><span>{{ s.name }}</span><span class="ps" style="color:var(--green-deep)">{{ s.readiness }}</span></div> }
            @if (!ov.topPerformers.length) { <p class="text-sm text-txt-mute">No data yet.</p> }
          </asta-card>
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-2">Students at risk</p>
            @for (s of ov.riskStudents; track s.name) { <div class="prow"><span class="min-w-0"><span class="block">{{ s.name }}</span>@if (s.topGap) { <span class="gap">gap: {{ s.topGap }}</span> }</span><span class="ps" style="color:var(--coral, #ffb454)">{{ s.readiness }}</span></div> }
            @if (!ov.riskStudents.length) { <p class="text-sm text-txt-mute">No students at risk 🎉</p> }
          </asta-card>
        </div>
      </div>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .stat { text-align: center; }
    .stat .num { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stat .lbl { font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
    .cohort { padding: 10px 12px; border: 1px solid var(--paper-3); border-radius: 12px; background: var(--paper-2); }
    .c-name { display: block; font-size: 13.5px; font-weight: 600; }
    .c-meta { display: block; font-size: 11.5px; color: var(--text-mute); }
    .inp { flex: 1; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text); font-size: 12.5px; }
    .weak { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--coral, #ffb454) 35%, var(--paper-3)); }
    .weak em { color: var(--text-mute); font-style: normal; }
    .prow { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; padding: 4px 0; }
    .ps { font-weight: 700; font-variant-numeric: tabular-nums; }
    .gap { font-size: 11px; color: var(--text-mute); }
  `],
})
export class InstitutionComponent {
  private readonly api = inject(InstitutionService);
  private readonly toast = inject(ToastService);
  readonly o = signal<InstitutionOverview | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  assignTitle: Record<string, string> = {};

  constructor() { this.refresh(); }
  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.overview().subscribe({ next: (o) => { this.o.set(o); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  assign(cohortId: string): void {
    const title = this.assignTitle[cohortId]?.trim();
    if (!title) return;
    this.api.assignFlow(cohortId, title).subscribe({ next: () => { this.toast.success('Assigned to cohort'); this.assignTitle[cohortId] = ''; }, error: () => this.toast.error('Could not assign') });
  }
}
