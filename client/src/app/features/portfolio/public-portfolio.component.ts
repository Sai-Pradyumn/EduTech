import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { LogoComponent } from '../../shared/ui/logo.component';
import { PortfolioService, PublicPortfolio } from '../../core/services/portfolio.service';

/** Public, unauthenticated portfolio at /p/:username (privacy filtered server-side). */
@Component({
  selector: 'asta-public-portfolio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, EmptyStateComponent, SkeletonComponent, LogoComponent],
  template: `
    <div class="wrap">
      <header class="pub-top">
        <a routerLink="/"><asta-logo /></a>
        <span class="verify">Built on Asta</span>
      </header>

      @if (loading()) {
        <asta-card><asta-skeleton h="140px" /></asta-card>
        <asta-card class="mt-3"><asta-skeleton h="200px" /></asta-card>
      } @else if (loadError() || !p()) {
        <asta-card><asta-empty-state title="This portfolio is not published" description="The link may be incorrect, or the owner hasn't published yet."></asta-empty-state></asta-card>
      } @else if (p()) {
        @if (p(); as pp) {
          <asta-card class="block hero">
            <p class="kicker mb-1">{{ pp.targetRole }}</p>
            <h1 class="h-title">{{ pp.title }}</h1>
            <p class="h-tag">{{ pp.tagline }}</p>
            @if (pp.about) { <p class="about">{{ pp.about }}</p> }
            <div class="flex flex-wrap gap-1.5 mt-3">@for (s of pp.skills; track s) { <span class="chip">{{ s }}</span> }</div>
            @if (pp.links.length) {
              <div class="flex flex-wrap gap-2 mt-3">@for (l of pp.links; track l.url) { <a [href]="l.url" target="_blank" rel="noopener" class="link-pill">{{ l.label }}</a> }</div>
            }
          </asta-card>

          @if (pp.projects.length) {
            <p class="kicker mt-5 mb-3">Projects</p>
            <div class="grid gap-3 md:grid-cols-2">
              @for (pr of pp.projects; track pr.projectId) {
                <asta-card class="block">
                  <div class="flex items-center justify-between gap-2"><span class="proj-title">{{ pr.title }}</span></div>
                  <div class="flex flex-wrap gap-1 mt-1.5">@for (t of pr.stack.slice(0,5); track t) { <span class="tech">{{ t }}</span> }</div>
                  <p class="proj-cs">{{ pr.caseStudy }}</p>
                  @if (pr.highlights.length) {
                    <ul class="proj-hl">@for (h of pr.highlights; track h) { <li>{{ h }}</li> }</ul>
                  }
                  <div class="flex gap-2 mt-2 text-[11px]">@if (pr.githubUrl) { <a [href]="pr.githubUrl" target="_blank" rel="noopener" class="lnk">repo</a> }@if (pr.demoUrl) { <a [href]="pr.demoUrl" target="_blank" rel="noopener" class="lnk">demo</a> }</div>
                </asta-card>
              }
            </div>
          }

          @if (pp.certificates.length) {
            <asta-card class="block mt-4"><p class="kicker mb-2">Certificates</p><div class="space-y-1.5">@for (c of pp.certificates; track c.id) { <div class="cert"><span>{{ c.title }}</span><span class="cert-id">{{ c.verificationId }}</span></div> }</div></asta-card>
          }

          @if (pp.timeline.length) {
            <asta-card class="block mt-4"><p class="kicker mb-2">Learning timeline</p>
              <div class="space-y-1.5">@for (t of pp.timeline; track $index) { <div class="tl"><span class="min-w-0 truncate">{{ t.title }}</span><span class="tl-at">{{ fmtDate(t.at) }}</span></div> }</div>
            </asta-card>
          }

          <p class="footer">Powered by <a routerLink="/">Asta</a> · every claim backed by verifiable proof.</p>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 24px 18px 60px; min-height: 100dvh; }
    .pub-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .verify { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--green-deep); padding: 4px 10px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); }
    .hero { border: 1px solid color-mix(in oklab, var(--green) 22%, var(--paper-3)); }
    .h-title { font-size: 26px; font-weight: 700; line-height: 1.1; }
    .h-tag { font-size: 14px; color: var(--text-soft); margin-top: 4px; }
    .about { font-size: 13.5px; color: var(--text-soft); margin-top: 10px; line-height: 1.6; }
    .chip { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); color: var(--green-deep); }
    .link-pill { font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--paper-3); color: var(--peri, #8aa6ff); }
    .proj-title { font-size: 14px; font-weight: 600; }
    .proj-cs { font-size: 12.5px; color: var(--text-soft); margin-top: 6px; line-height: 1.5; }
    .proj-hl { list-style: disc; padding-left: 18px; margin-top: 6px; font-size: 12px; color: var(--text-soft); }
    .proj-hl li { margin-top: 2px; }
    .tl { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--text-soft); }
    .tl-at { color: var(--text-mute); font-size: 10.5px; white-space: nowrap; flex-shrink: 0; }
    .tech { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: var(--paper-3); color: var(--text-soft); }
    .lnk { color: var(--peri, #8aa6ff); }
    .cert { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; }
    .cert-id { color: var(--text-mute); font-size: 10.5px; }
    .footer { text-align: center; font-size: 12px; color: var(--text-mute); margin-top: 24px; }
    .footer a, .kicker { }
  `],
})
export class PublicPortfolioComponent {
  private readonly api = inject(PortfolioService);
  private readonly route = inject(ActivatedRoute);
  readonly p = signal<PublicPortfolio | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  constructor() {
    const username = this.route.snapshot.paramMap.get('username') ?? '';
    this.api.public(username).subscribe({
      next: (p) => { this.p.set(p); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  fmtDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { year: 'numeric', month: 'short' });
  }
}
