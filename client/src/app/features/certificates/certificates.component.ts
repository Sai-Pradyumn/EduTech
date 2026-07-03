import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonComponent } from '../../shared/ui/button.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { CertificateService } from '../../core/services/certificate.service';
import { ToastService } from '../../core/services/toast.service';
import { CertificateView } from '../../core/models';

/** My certificates (B7): credential cards with a public verification link. */
@Component({
    selector: 'asta-certificates',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, ButtonComponent, SkeletonComponent],
    template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Certificates</h1>
        <span class="goal-pill"><span class="dot"></span>Your verifiable credentials · share or verify any time</span>
      </div>
    </header>

    <div class="max-w-app mx-auto">
      @if (loading()) {
        <div class="grid gap-4 md:grid-cols-2">
          <div class="card"><asta-skeleton h="150px" /></div>
          <div class="card"><asta-skeleton h="150px" /></div>
        </div>
      } @else if (loadError()) {
        <div class="card grid place-items-center text-center" style="padding:48px 24px">
          <div>
            <p class="font-display text-xl mb-1">Couldn't load your certificates</p>
            <p class="text-sm text-txt-soft mb-3">Check your connection and try again.</p>
            <asta-btn variant="accent" (click)="load()">Retry</asta-btn>
          </div>
        </div>
      } @else if (certs().length === 0) {
        <div class="card grid place-items-center text-center" style="padding:60px 24px">
          <div>
            <p class="font-display text-xl mb-1">No certificates yet</p>
            <p class="text-sm text-txt-soft">Complete projects and skills — your mentor or college can issue verifiable credentials you can share.</p>
          </div>
        </div>
      } @else {
      <div class="grid gap-4 md:grid-cols-2 motion-row-primary">
        @for (c of certs(); track c.id; let i = $index) {
          <div class="card cert-card motion-card-reveal relative overflow-hidden" style="padding:22px" [style.--motion-card-index]="i">
            <div class="absolute inset-0 pointer-events-none" style="background:radial-gradient(120% 80% at 100% 0%, oklch(0.8 0.16 150 / .10), transparent 60%)"></div>
            <div class="cert-shine" aria-hidden="true"></div>
            <span class="cert-medal" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/></svg>
            </span>
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
      }
    </div>
  `,
    styles: [
        `
      .cert-card { transition: transform .22s var(--ease), box-shadow .22s var(--ease), border-color .22s var(--ease); }
      .cert-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md), 0 0 0 1px color-mix(in oklch, var(--green) 26%, transparent); }
      .cert-medal {
        position: absolute; top: 18px; right: 18px; z-index: 1;
        width: 36px; height: 36px; display: grid; place-items: center; border-radius: 12px;
        color: var(--green-deep); background: color-mix(in oklch, var(--green) 14%, transparent);
        animation: astaSoftPop .45s var(--ease-spring) .2s both;
        transition: transform .35s var(--ease-spring);
      }
      .cert-card:hover .cert-medal { transform: scale(1.15) rotate(8deg); }
      /* shine sweeps across the credential on hover — an achievement, not a list item */
      .cert-shine {
        position: absolute; inset: 0; pointer-events: none; z-index: 1;
        background: linear-gradient(105deg, transparent 40%, oklch(1 0 0 / .1) 50%, transparent 60%);
        transform: translateX(-120%);
      }
      .cert-card:hover .cert-shine { animation: certShine 0.9s var(--ease) forwards; }
      @keyframes certShine { to { transform: translateX(120%); } }
      @media (prefers-reduced-motion: reduce) {
        .cert-medal { animation: none; }
        .cert-card:hover { transform: none; }
        .cert-card:hover .cert-shine { animation: none; }
      }
    `,
    ]
})
export class CertificatesComponent implements OnInit {
  private readonly certApi = inject(CertificateService);
  private readonly toast = inject(ToastService);

  readonly certs = signal<CertificateView[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.certApi.mine().subscribe({
      next: (c) => { this.certs.set(c); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  copy(vid: string): void {
    // Copy the full shareable verification URL, not just the bare id — a recipient
    // needs a link they can open, not a token they have to paste into a form.
    const url = `${location.origin}/certificate/verify/${vid}`;
    void navigator.clipboard?.writeText(url);
    this.toast.success('Verification link copied');
  }
}
