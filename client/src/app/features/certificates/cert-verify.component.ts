import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LogoComponent } from '../../shared/ui/logo.component';
import { CertificateService } from '../../core/services/certificate.service';
import { VerificationResult } from '../../core/models';

/** Public certificate verification page (B7) — no auth, no app shell. */
@Component({
    selector: 'asta-cert-verify',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, RouterLink, LogoComponent],
    template: `
    <div class="cv-root min-h-screen grid place-items-center px-5 relative overflow-hidden" style="background:var(--paper)">
      <div class="cv-bloom" aria-hidden="true"></div>
      <div class="w-full relative z-10" style="max-width:520px">
        <a routerLink="/" class="flex justify-center mb-8"><asta-logo [size]="30" /></a>

        @if (!loaded()) {
          <div class="card" style="padding:40px;text-align:center">
            <span class="cv-orb" aria-hidden="true"></span>
            <p class="text-txt-mute mt-4">Verifying credential…</p>
          </div>
        } @else if (netError()) {
          <!-- A transport/server failure is NOT the same as an invalid credential —
               don't imply the certificate is forged when we simply couldn't check it. -->
          <div class="card cv-card" style="padding:36px;text-align:center">
            <span class="inline-grid place-items-center rounded-full mb-4" style="width:56px;height:56px;background:color-mix(in oklch, var(--warn, #d19a20) 16%, transparent);color:var(--warn, #d19a20)">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
            </span>
            <h1 class="font-display text-2xl">Couldn't verify right now</h1>
            <p class="text-txt-soft mt-2">We couldn't reach the verification service. This doesn't mean the credential is invalid — check your connection and try again.</p>
            <button class="cv-retry" (click)="retry()">Try again</button>
          </div>
        }
        @if (loaded() && !netError() && result(); as r) {
          @if (r.valid) {
            <div class="card cv-card relative overflow-hidden" style="padding:36px;text-align:center">
              <div class="absolute inset-0 pointer-events-none" style="background:radial-gradient(120% 80% at 50% 0%, oklch(0.8 0.16 150 / .12), transparent 60%)"></div>
              <div class="cv-shine" aria-hidden="true"></div>
              <div class="relative">
                <span class="cv-badge inline-grid place-items-center rounded-full mb-4" style="width:56px;height:56px;background:color-mix(in oklch, var(--green) 18%, transparent);color:var(--green-deep)">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path class="cv-check" d="M20 6 9 17l-5-5"/></svg>
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
            <div class="card cv-card" style="padding:36px;text-align:center">
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
    styles: [
        `
      .cv-bloom {
        position: absolute;
        top: -240px;
        left: 50%;
        transform: translateX(-50%);
        width: 720px;
        height: 560px;
        border-radius: 50%;
        filter: blur(110px);
        opacity: 0.4;
        pointer-events: none;
        background: radial-gradient(circle, color-mix(in oklch, var(--green) 26%, transparent), transparent 70%);
      }
      .cv-orb {
        display: inline-block;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, var(--green), transparent 65%);
        animation: cvSpin 1.1s linear infinite;
        -webkit-mask: radial-gradient(circle, transparent 9px, #000 10px);
        mask: radial-gradient(circle, transparent 9px, #000 10px);
      }
      @keyframes cvSpin { to { transform: rotate(360deg); } }
      .cv-card { animation: astaRevealUp 0.5s var(--ease) both; }
      .cv-badge { animation: astaSoftPop 0.45s var(--ease-spring) 0.2s both; }
      .cv-check {
        stroke-dasharray: 24;
        stroke-dashoffset: 24;
        animation: cvDraw 0.6s var(--ease) 0.45s forwards;
      }
      @keyframes cvDraw { to { stroke-dashoffset: 0; } }
      /* one-time shine sweep across the verified sheet */
      .cv-shine {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(105deg, transparent 38%, oklch(1 0 0 / 0.14) 50%, transparent 62%);
        transform: translateX(-110%);
        animation: cvShine 1.4s var(--ease) 0.7s forwards;
      }
      @keyframes cvShine { to { transform: translateX(110%); } }
      @media (prefers-reduced-motion: reduce) {
        .cv-orb, .cv-card, .cv-badge, .cv-shine { animation: none; }
        .cv-check { stroke-dashoffset: 0; animation: none; }
      }
      .cv-retry { margin-top: 18px; border-radius: 100px; padding: 8px 18px; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--green); }
    `,
    ]
})
export class CertVerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly certApi = inject(CertificateService);

  readonly result = signal<VerificationResult | null>(null);
  readonly loaded = signal(false);
  /** True when the check itself failed (network/server) — distinct from an invalid credential. */
  readonly netError = signal(false);

  ngOnInit(): void {
    this.load();
  }

  retry(): void {
    this.load();
  }

  private load(): void {
    const vid = this.route.snapshot.paramMap.get('id') ?? '';
    this.loaded.set(false);
    this.netError.set(false);
    this.certApi.verify(vid).subscribe({
      next: (r) => {
        // The API returns { valid: false } (200) for a genuinely invalid/revoked cert;
        // reaching here means the check succeeded, so trust the verdict.
        this.result.set(r);
        this.loaded.set(true);
      },
      error: () => {
        // Couldn't reach the verifier — surface a retryable error, don't cry "forged".
        this.netError.set(true);
        this.loaded.set(true);
      },
    });
  }
}
