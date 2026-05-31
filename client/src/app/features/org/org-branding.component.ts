import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrandingView, EnterpriseService } from '../../core/services/enterprise.service';
import { ToastService } from '../../core/services/toast.service';

/** Org white-label branding (Phase 10 · M15). Subtle, token-based — applies to certificates
 *  and public verification pages, never the in-app shell. */
@Component({
  selector: 'asta-org-branding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <header class="asta-page-command-header max-w-app mx-auto">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Branding</h1>
        <span class="goal-pill"><span class="dot"></span>certificates &amp; public pages</span>
      </div>
    </header>

    <div class="max-w-app mx-auto grid gap-5 md:grid-cols-3">
      <div class="card md:col-span-2" style="padding:18px">
        <p class="kicker mb-3">White-label settings</p>
        <div class="space-y-3">
          <label class="block">
            <span class="t-label">Public name</span>
            <input class="asta-input" [(ngModel)]="form.publicName" placeholder="e.g. Sreenidhi College" />
          </label>
          <label class="block">
            <span class="t-label">Logo URL</span>
            <input class="asta-input" [(ngModel)]="form.logoUrl" placeholder="https://…/logo.png" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="t-label">Accent colour</span>
              <input class="asta-input" [(ngModel)]="form.accentColor" placeholder="#1b6b4f" />
            </label>
            <label class="block">
              <span class="t-label">Support email</span>
              <input class="asta-input" [(ngModel)]="form.supportEmail" placeholder="help@org.edu" />
            </label>
          </div>
          <button class="rounded-full px-4 py-2 text-sm font-semibold" style="background:var(--green);color:var(--ink)" [disabled]="busy()" (click)="save()">
            {{ busy() ? 'Saving…' : 'Save branding' }}
          </button>
        </div>
      </div>

      <div class="card" style="padding:18px">
        <p class="kicker mb-3">Certificate preview</p>
        <div class="rounded-[14px] p-4 text-center" style="border:1px solid var(--paper-3);background:var(--paper-2)"
          [style.borderTop]="'3px solid ' + (form.accentColor || 'var(--green)')">
          @if (form.logoUrl) { <img [src]="form.logoUrl" alt="logo" class="h-8 mx-auto mb-2 object-contain" /> }
          <p class="font-display text-lg">{{ form.publicName || 'Your Organization' }}</p>
          <p class="text-xs text-txt-mute mt-1">Certificate of Completion</p>
          <p class="text-sm mt-3">Aarav Sharma</p>
          <p class="text-[11px] text-txt-mute mt-2 font-mono">verified · {{ form.supportEmail || 'support@org' }}</p>
        </div>
        <p class="text-xs text-txt-mute mt-3">Branding stays subtle — the app shell keeps the Noir Cockpit system.</p>
      </div>
    </div>
  `,
  styles: [`.asta-input{width:100%;margin-top:4px;padding:8px 12px;border-radius:10px;border:1px solid var(--paper-3);background:var(--paper);font-size:14px}.asta-input:focus{outline:none;border-color:var(--green)}`],
})
export class OrgBrandingComponent implements OnInit {
  private readonly enterprise = inject(EnterpriseService);
  private readonly toast = inject(ToastService);

  readonly busy = signal(false);
  form: Partial<BrandingView> = {
    publicName: '',
    logoUrl: '',
    accentColor: '',
    supportEmail: '',
  };

  ngOnInit(): void {
    this.enterprise.branding().subscribe({ next: (b) => (this.form = { ...b }) });
  }

  save(): void {
    this.busy.set(true);
    this.enterprise.updateBranding(this.form).subscribe({
      next: (b) => {
        this.form = { ...b };
        this.busy.set(false);
        this.toast.success('Branding saved');
      },
      error: () => this.busy.set(false),
    });
  }
}
