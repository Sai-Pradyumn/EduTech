import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { DomainBusService, DomainKey } from '../../core/services/domain-bus.service';
import { PrivacyService, PrivacySettings } from '../../core/services/privacy.service';

@Component({
    selector: 'asta-privacy',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, CardComponent, SkeletonComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Data &amp; Privacy</h1>
        <span class="goal-pill"><span class="dot"></span>You control what's public and what Asta keeps</span>
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="120px" /></asta-card>
    } @else if (s()) {
      @if (s(); as st) {
      <div class="grid gap-4 lg:grid-cols-2 items-start">
        <asta-card class="block motion-card-reveal motion-row-primary">
          <p class="kicker mb-3">What's public right now</p>
          <div class="row"><span>Skill Passport</span><span class="badge" [class.pub]="st.passport.visibility === 'public'">{{ st.passport.visibility }}</span></div>
          <p class="sub">/u/{{ st.passport.username }}</p>
          <div class="row mt-2"><span>Portfolio</span><span class="badge" [class.pub]="st.portfolio.status === 'published'">{{ st.portfolio.status }}</span></div>
          <p class="sub">/p/{{ st.portfolio.username }}</p>
          <div class="row mt-2"><span>Proof events public</span><span class="mono">{{ st.proof.public }} / {{ st.proof.total }}</span></div>
        </asta-card>

        <asta-card class="block motion-card-reveal motion-row-2">
          <p class="kicker mb-3">Export your data</p>
          <p class="text-sm text-txt-soft mb-2">Download everything Asta has built for you — passport, proof ledger, portfolio, resume and applications — as JSON.</p>
          <asta-btn variant="accent" size="sm" (click)="exportData()" [disabled]="busy()">Export my data (JSON)</asta-btn>
        </asta-card>

        <asta-card class="block motion-card-reveal motion-row-3 danger">
          <p class="kicker mb-3">Go private</p>
          <p class="text-sm text-txt-soft mb-2">Instantly take your public Skill Passport and Portfolio private. Public links will stop working.</p>
          <asta-btn variant="ghost" size="sm" (click)="confirm('private')">{{ armed() === 'private' ? 'Confirm — make everything private' : 'Make everything private' }}</asta-btn>
        </asta-card>

        <asta-card class="block motion-card-reveal motion-row-3 danger">
          <p class="kicker mb-3">Reset &amp; clear</p>
          <div class="flex flex-col gap-2 items-start">
            <asta-btn variant="ghost" size="sm" (click)="confirm('twin')">{{ armed() === 'twin' ? 'Confirm — reset Skill Twin memory' : 'Reset Skill Twin (clears mistakes/weak areas)' }}</asta-btn>
            <asta-btn variant="ghost" size="sm" (click)="confirm('apps')">{{ armed() === 'apps' ? 'Confirm — delete all applications' : 'Clear application tracker' }}</asta-btn>
          </div>
        </asta-card>
      </div>
      }
    }
  `,
    styles: [`
    :host { display: block; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13.5px; font-weight: 500; }
    .sub { font-size: 11px; color: var(--text-mute); margin-top: 1px; }
    .badge { font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: var(--paper-3); color: var(--text-mute); }
    .badge.pub { background: color-mix(in oklab, var(--green) 20%, transparent); color: var(--green-deep); }
    .mono { font-variant-numeric: tabular-nums; font-weight: 600; }
    .danger { border: 1px solid color-mix(in oklab, var(--coral, #ffb454) 25%, var(--paper-3)); }
  `]
})
export class PrivacyComponent {
  private readonly api = inject(PrivacyService);
  private readonly toast = inject(ToastService);
  private readonly bus = inject(DomainBusService);
  readonly s = signal<PrivacySettings | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly armed = signal<string | null>(null);

  constructor() { this.refresh(); }
  refresh(): void {
    this.loading.set(true);
    this.api.settings().subscribe({ next: (s) => { this.s.set(s); this.loading.set(false); }, error: () => this.loading.set(false) });
  }
  /** Domains each destructive action invalidates, so open dependent screens refresh. */
  private static readonly AFFECTS: Record<string, DomainKey[]> = {
    private: ['portfolio', 'passport'],
    twin: ['skillTwin', 'mistakes', 'intelligence', 'dashboard'],
    apps: ['applications'],
  };

  confirm(action: string): void {
    if (this.armed() !== action) { this.armed.set(action); setTimeout(() => this.armed.set(null), 4000); return; }
    this.armed.set(null); this.busy.set(true);
    const obs: import('rxjs').Observable<unknown> =
      action === 'private' ? this.api.makePrivate() : action === 'twin' ? this.api.resetSkillTwin() : this.api.clearApplications();
    obs.subscribe({
      next: () => {
        this.busy.set(false); this.toast.success('Done'); this.refresh();
        // Tell dependent screens (portfolio/passport/applications/…) to reload.
        this.bus.invalidate(PrivacyComponent.AFFECTS[action]);
      },
      error: () => { this.busy.set(false); this.toast.error('Action failed'); },
    });
  }
  exportData(): void {
    this.busy.set(true);
    this.api.exportData().subscribe({
      next: (data) => {
        this.busy.set(false);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'asta-my-data.json'; a.click();
        URL.revokeObjectURL(url);
        this.toast.success('Exported');
      },
      error: () => { this.busy.set(false); this.toast.error('Export failed'); },
    });
  }
}
