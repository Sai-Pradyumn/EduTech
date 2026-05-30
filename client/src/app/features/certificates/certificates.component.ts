import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CertificateService } from '../../core/services/certificate.service';
import { ToastService } from '../../core/services/toast.service';
import { CertificateView } from '../../core/models';
import { TiltDirective } from '../../shared/directives/tilt.directive';
import { RevealDirective } from '../../shared/directives/reveal.directive';

/** My certificates (B7): credential cards with a public verification link. */
@Component({
  selector: 'asta-certificates',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TiltDirective, RevealDirective],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Certificates</h1>
        <span class="goal-pill"><span class="dot"></span>Your verifiable credentials · share or verify any time</span>
      </div>
    </header>

    <div class="max-w-app mx-auto">
      @if (loaded() && certs().length === 0) {
        <div class="card grid place-items-center text-center" style="padding:60px 24px">
          <div>
            <p class="font-display text-xl mb-1">No certificates yet</p>
            <p class="text-sm text-txt-soft">Complete projects and skills — your mentor or college can issue verifiable credentials you can share.</p>
          </div>
        </div>
      }
      <div class="grid gap-4 md:grid-cols-2">
        @for (c of certs(); track c.id; let i = $index) {
          <div class="card relative overflow-hidden" style="padding:22px" astaTilt [tiltMax]="4" [astaReveal]="i">
            <div class="absolute inset-0 pointer-events-none" style="background:radial-gradient(120% 80% at 100% 0%, oklch(0.8 0.16 150 / .10), transparent 60%)"></div>
            <div class="relative">
              <p class="kicker mb-2" style="color:var(--green-deep)">Certificate</p>
              <h3 class="font-display text-2xl">{{ c.title }}</h3>
              @if (c.skill) { <p class="text-sm text-txt-soft mt-1">{{ c.skill }}@if (c.score) { · {{ c.score }}%}</p> }
              <p class="text-xs font-mono text-txt-mute mt-3">Issued by {{ c.issuerName || 'Asta' }} · {{ c.issuedAt | date: 'mediumDate' }}</p>
              <div class="flex items-center gap-3 mt-4">
                <a class="pill" style="cursor:pointer" [href]="'/certificate/verify/' + c.verificationId" target="_blank" rel="noopener">Verify ↗</a>
                <button class="text-xs text-txt-mute hover:text-txt" (click)="copy(c.verificationId)">{{ c.verificationId }}</button>
                @if (c.revoked) { <span class="pill" style="color:var(--danger)">revoked</span> }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class CertificatesComponent implements OnInit {
  private readonly certApi = inject(CertificateService);
  private readonly toast = inject(ToastService);

  readonly certs = signal<CertificateView[]>([]);
  readonly loaded = signal(false);

  ngOnInit(): void {
    this.certApi.mine().subscribe({
      next: (c) => {
        this.certs.set(c);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  copy(vid: string): void {
    void navigator.clipboard?.writeText(vid);
    this.toast.success('Verification ID copied');
  }
}
