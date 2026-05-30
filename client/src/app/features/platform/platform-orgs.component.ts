import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrgContextService } from '../../core/services/org-context.service';
import { OrgService } from '../../core/services/org.service';
import { ToastService } from '../../core/services/toast.service';
import { Organization } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

@Component({
  selector: 'asta-platform-orgs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent],
  template: `
    <h1 class="text-[26px] mb-1">Platform · Organizations</h1>
    <p class="text-sm text-txt-mute mb-6">Every tenant on the platform. Operator-only.</p>

    @if (!ctx.isPlatformAdmin()) {
      <asta-card><asta-empty-state title="Operators only" description="This area is restricted to platform administrators." /></asta-card>
    } @else {
      @if (stats(); as s) {
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div class="card stat"><p class="font-display text-2xl">{{ s.organizations }}</p><p class="lbl">Organizations</p></div>
          <div class="card stat"><p class="font-display text-2xl">{{ s.totalMembers }}</p><p class="lbl">Total members</p></div>
          <div class="card stat"><p class="font-display text-2xl">{{ typeCount(s.byType) }}</p><p class="lbl">Org types</p></div>
        </div>
      }

      <div class="card" style="padding:16px;margin-bottom:20px">
        <p class="kicker mb-3">Create organization</p>
        <div class="flex flex-wrap items-end gap-2">
          <input class="input" style="max-width:260px" placeholder="Organization name" [(ngModel)]="name" />
          <select class="input" style="max-width:160px" [(ngModel)]="type">
            <option value="college">College</option>
            <option value="institute">Institute</option>
            <option value="company">Company</option>
            <option value="cohort">Cohort</option>
          </select>
          <asta-btn variant="accent" size="sm" [loading]="creating()" [disabled]="name.trim().length < 2" (click)="create()">Create</asta-btn>
        </div>
      </div>

      <div class="card" style="padding:16px">
        <p class="kicker mb-3">All organizations</p>
        @if (orgs().length === 0) { <p class="text-sm text-txt-mute py-6 text-center">No organizations yet.</p> }
        <div class="space-y-2">
          @for (o of orgs(); track o.id) {
            <div class="row">
              <div class="min-w-0">
                <p class="text-sm font-medium truncate">{{ o.name }} <span class="pill" style="margin-left:6px">{{ o.type }}</span></p>
                <p class="text-[11px] text-txt-mute">/{{ o.slug }} · {{ o.memberCount }} members · plan {{ o.plan }}</p>
              </div>
              <span class="status" [attr.data-s]="o.status">{{ o.status }}</span>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .stat { padding: 14px 16px; }
      .lbl { font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 14px; }
      .status { font-family: var(--mono); font-size: 10px; text-transform: uppercase; padding: 1px 8px; border-radius: 100px; background: oklch(0.80 0.16 150 / .18); color: var(--green-deep); }
    `,
  ],
})
export class PlatformOrgsComponent implements OnInit {
  readonly ctx = inject(OrgContextService);
  private readonly orgApi = inject(OrgService);
  private readonly toast = inject(ToastService);

  readonly orgs = signal<Organization[]>([]);
  readonly stats = signal<{ organizations: number; totalMembers: number; byType: Record<string, number> } | null>(null);
  readonly creating = signal(false);
  name = '';
  type = 'college';

  ngOnInit(): void {
    if (this.ctx.isPlatformAdmin()) this.refresh();
  }

  refresh(): void {
    this.orgApi.listAll().subscribe({ next: (o) => this.orgs.set(o), error: () => undefined });
    this.orgApi.platformStats().subscribe({ next: (s) => this.stats.set(s), error: () => undefined });
  }

  typeCount(byType: Record<string, number>): number {
    return Object.keys(byType).length;
  }

  create(): void {
    if (this.name.trim().length < 2) return;
    this.creating.set(true);
    this.orgApi.create(this.name.trim(), this.type).subscribe({
      next: () => {
        this.creating.set(false);
        this.name = '';
        this.toast.success('Organization created');
        this.refresh();
        this.ctx.load();
      },
      error: (e) => {
        this.creating.set(false);
        this.toast.error(e?.message ?? 'Could not create');
      },
    });
  }
}
