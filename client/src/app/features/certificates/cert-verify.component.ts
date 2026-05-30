import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LogoComponent } from '../../shared/ui/logo.component';
import { CertificateService } from '../../core/services/certificate.service';
import { VerificationResult } from '../../core/models';

/** Public certificate verification page (B7) — no auth, no app shell. */
@Component({
  selector: 'asta-cert-verify',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, LogoComponent],
  template: `
    <div class="min-h-screen grid place-items-center px-5" style="background:var(--paper)">
      <div class="w-full" style="max-width:520px">
        <a routerLink="/" class="flex justify-center mb-8"><asta-logo [size]="30" /></a>

        @if (!loaded()) {
          <div class="card" style="padding:40px;text-align:center"><p class="text-txt-mute">Verifying…</p></div>
        }
        @if (loaded() && result(); as r) {
          @if (r.valid) {
            <div class="card relative overflow-hidden" style="padding:36px;text-align:center">
              <div class="absolute inset-0 pointer-events-none" style="background:radial-gradient(120% 80% at 50% 0%, oklch(0.8 0.16 150 / .12), transparent 60%)"></div>
              <div class="relative">
                <span class="inline-grid place-items-center rounded-full mb-4" style="width:56px;height:56px;background:color-mix(in oklch, var(--green) 18%, transparent);color:var(--green-deep)">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                <p class="kicker justify-center mb-2" style="color:var(--green-deep)">Verified credential</p>
                <h1 class="font-display text-3xl">{{ r.title }}</h1>
                <p class="text-txt-soft mt-2">Awarded to <b class="text-txt">{{ r.holderName }}</b></p>
                @if (r.skill) { <p class="text-sm text-txt-mute mt-1">{{ r.skill }}@if (r.score) { · {{ r.score }}%}</p> }
                <div class="mt-5 pt-4 text-xs font-mono text-txt-mute" style="border-top:1px solid var(--paper-3)">
                  <p>Issued by {{ r.issuerName || 'Asta' }} · {{ r.issuedAt | date: 'longDate' }}</p>
                  <p class="mt-1">ID {{ r.verificationId }}</p>
                </div>
              </div>
            </div>
          } @else {
            <div class="card" style="padding:36px;text-align:center">
              <span class="inline-grid place-items-center rounded-full mb-4" style="width:56px;height:56px;background:color-mix(in oklch, var(--danger) 16%, transparent);color:var(--danger)">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </span>
              <h1 class="font-display text-2xl">Not verifiable</h1>
              <p class="text-txt-soft mt-2">This certificate ID is invalid, revoked, or doesn't exist.</p>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class CertVerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly certApi = inject(CertificateService);

  readonly result = signal<VerificationResult | null>(null);
  readonly loaded = signal(false);

  ngOnInit(): void {
    const vid = this.route.snapshot.paramMap.get('id') ?? '';
    this.certApi.verify(vid).subscribe({
      next: (r) => {
        this.result.set(r);
        this.loaded.set(true);
      },
      error: () => {
        this.result.set({ valid: false });
        this.loaded.set(true);
      },
    });
  }
}
