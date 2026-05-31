import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { LogoComponent } from '../../shared/ui/logo.component';
import { SkillPassport, SkillPassportService, VERIFICATION_META, VerificationLevel } from '../../core/services/skill-passport.service';
import { LEDGER_KIND_META, LedgerKind } from '../../core/services/ledger.service';

/**
 * Public, trustworthy read-only Skill Passport. Serves two routes:
 *  - /u/:username (unauthenticated public profile, honoring privacy settings server-side)
 *  - /app/skill-passport/public-preview (the owner's preview, pulled from /me)
 */
@Component({
  selector: 'asta-public-passport',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, EmptyStateComponent, RingComponent, SkeletonComponent, LogoComponent],
  template: `
    <div class="wrap" [class.standalone]="!preview">
      @if (!preview) {
        <header class="pub-top">
          <a routerLink="/"><asta-logo /></a>
          <span class="verify">Verified by Asta</span>
        </header>
      } @else {
        <div class="preview-banner">Preview of your public profile — this is what visitors see. <a routerLink="/app/skill-passport">Back to passport</a></div>
      }

      @if (loading()) {
        <asta-card><asta-skeleton h="120px" /></asta-card>
        <asta-card class="mt-3"><asta-skeleton h="220px" /></asta-card>
      } @else if (loadError() || !p()) {
        <asta-card><asta-empty-state title="This profile is private or unavailable" description="The learner may not have published their Skill Passport, or the link is incorrect."></asta-empty-state></asta-card>
      } @else if (p()) {
        @if (p(); as pp) {
        <asta-card class="block identity">
          <div class="flex items-start gap-4 flex-wrap">
            <span class="avatar">{{ initial(pp.identity.name) }}</span>
            <div class="min-w-0 flex-1">
              <p class="kicker mb-1">{{ pp.identity.targetRole }} · {{ pp.identity.currentLevel }}</p>
              <h1 class="ident-name">{{ pp.identity.name }}</h1>
              <p class="ident-head">{{ pp.identity.headline }}</p>
              <div class="flex flex-wrap gap-1.5 mt-2">@for (s of pp.identity.topSkills; track s) { <span class="top-chip">{{ s }}</span> }</div>
            </div>
            @if (pp.identity.readinessScore > 0) {
              <div class="text-center shrink-0"><asta-ring [value]="pp.identity.readinessScore" [size]="78" /><p class="g-lbl">Readiness</p></div>
            }
          </div>
        </asta-card>

        <div class="grid gap-3 grid-cols-3 sm:grid-cols-6 my-3">
          @for (m of tiles(pp); track m.label) {
            <asta-card class="stat"><p class="num">{{ m.value }}</p><p class="lbl">{{ m.label }}</p></asta-card>
          }
        </div>

        <div class="grid gap-3 lg:grid-cols-2 items-start">
          @if (pp.skills.length) {
            <asta-card class="block">
              <p class="kicker mb-3">Verified skills</p>
              <div class="space-y-2">
                @for (s of pp.skills; track s.skill) {
                  <div class="skill-row">
                    <span class="s-label">{{ s.skill }}</span>
                    <span class="s-track"><span class="s-fill" [style.width.%]="s.mastery || 50"></span></span>
                    @if (s.evidenceCount) { <span class="s-meta">{{ s.evidenceCount }}× proof</span> }
                  </div>
                }
              </div>
            </asta-card>
          }

          @if (pp.projects.length) {
            <asta-card class="block">
              <p class="kicker mb-3">Projects</p>
              <div class="space-y-2">
                @for (pr of pp.projects; track pr.id) {
                  <div class="proj">
                    <div class="flex items-center justify-between gap-2"><span class="proj-title">{{ pr.title }}</span>@if (pr.aiScore !== null) { <span class="proj-score">{{ pr.aiScore }}</span> }</div>
                    <div class="flex flex-wrap gap-1 mt-1.5">@for (t of pr.stack.slice(0,5); track t) { <span class="tech">{{ t }}</span> }</div>
                    <div class="flex gap-2 mt-1.5 text-[11px]">@if (pr.githubUrl) { <a [href]="pr.githubUrl" target="_blank" rel="noopener" class="lnk">repo</a> }@if (pr.demoUrl) { <a [href]="pr.demoUrl" target="_blank" rel="noopener" class="lnk">demo</a> }</div>
                  </div>
                }
              </div>
            </asta-card>
          }

          @if (pp.certificates.length) {
            <asta-card class="block">
              <p class="kicker mb-3">Certificates</p>
              <div class="space-y-1.5">@for (c of pp.certificates; track c.id) { <div class="cert"><span>{{ c.title }}</span><span class="cert-id">{{ c.verificationId }}</span></div> }</div>
            </asta-card>
          }

          @if (pp.timeline.length) {
            <asta-card class="block">
              <p class="kicker mb-3">Learning timeline</p>
              <div class="timeline">
                @for (e of pp.timeline.slice(0, 12); track e.id) {
                  <div class="row"><span class="glyph">{{ glyph(e.kind) }}</span><span class="line"></span><span class="min-w-0 flex-1"><span class="t-title">{{ e.title }}</span><span class="t-meta"><span [style.color]="verTone(e.verificationLevel)">{{ verLabel(e.verificationLevel) }}</span> · {{ date(e.at) }}</span></span></div>
                }
              </div>
            </asta-card>
          }
        </div>

        @if (!preview) { <p class="footer">Powered by <a routerLink="/">Asta — AI learning & outcome OS</a> · proof you can verify.</p> }
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap.standalone { max-width: 920px; margin: 0 auto; padding: 24px 18px 60px; min-height: 100dvh; }
    .pub-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .verify { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--green-deep); padding: 4px 10px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); }
    .preview-banner { font-size: 12.5px; padding: 8px 12px; border-radius: 10px; background: color-mix(in oklab, var(--peri, #8aa6ff) 12%, transparent); border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 30%, transparent); margin-bottom: 14px; }
    .preview-banner a, .footer a, .lnk { color: var(--peri, #8aa6ff); }
    .identity { border: 1px solid color-mix(in oklab, var(--green) 22%, var(--paper-3)); }
    .avatar { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 16px; background: linear-gradient(135deg, var(--green-deep), var(--green)); color: var(--ink); font-size: 25px; font-weight: 700; flex-shrink: 0; }
    .ident-name { font-size: 24px; font-weight: 700; line-height: 1.1; }
    .ident-head { font-size: 14px; color: var(--text-soft); margin-top: 2px; }
    .top-chip { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); color: var(--green-deep); }
    .g-lbl { font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }
    .stat { text-align: center; }
    .stat .num { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stat .lbl { font-size: 10px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
    .skill-row { display: grid; grid-template-columns: 130px 1fr auto; align-items: center; gap: 10px; }
    .s-label { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .s-track { height: 8px; border-radius: 999px; background: var(--paper-3); }
    .s-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--green-deep), var(--green)); }
    .s-meta { font-size: 10.5px; color: var(--text-mute); white-space: nowrap; }
    .proj { padding: 9px 11px; border: 1px solid var(--paper-3); border-radius: 11px; background: var(--paper-2); }
    .proj-title { font-size: 13px; font-weight: 600; }
    .proj-score { font-size: 12px; font-weight: 700; color: var(--green-deep); }
    .tech { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: var(--paper-3); color: var(--text-soft); }
    .cert { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; }
    .cert-id { color: var(--text-mute); font-size: 10.5px; }
    .timeline { display: flex; flex-direction: column; }
    .row { display: flex; gap: 12px; padding: 8px 0; position: relative; }
    .glyph { font-size: 14px; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; background: var(--paper-2); border: 1px solid var(--paper-3); flex-shrink: 0; z-index: 1; }
    .line { position: absolute; left: 11px; top: 28px; bottom: -8px; width: 2px; background: var(--paper-3); }
    .row:last-child .line { display: none; }
    .t-title { display: block; font-size: 13px; font-weight: 600; }
    .t-meta { display: block; font-size: 10.5px; color: var(--text-mute); }
    .footer { text-align: center; font-size: 12px; color: var(--text-mute); margin-top: 24px; }
  `],
})
export class PublicPassportComponent {
  private readonly api = inject(SkillPassportService);
  private readonly route = inject(ActivatedRoute);

  readonly p = signal<SkillPassport | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly preview = !this.route.snapshot.paramMap.get('username');

  constructor() {
    const username = this.route.snapshot.paramMap.get('username');
    const obs = username ? this.api.public(username) : this.api.me();
    obs.subscribe({
      next: (p) => { this.p.set(p); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  tiles = (pp: SkillPassport) => [
    { label: 'Verified', value: pp.proofSummary.verifiedEvents },
    { label: 'Quizzes', value: pp.proofSummary.quizzesPassed },
    { label: 'Projects', value: pp.proofSummary.projectsCompleted },
    { label: 'Sims', value: pp.proofSummary.simulationsPassed },
    { label: 'Certs', value: pp.proofSummary.certificatesIssued },
    { label: 'Fixes', value: pp.proofSummary.mistakesResolved },
  ];

  initial(name: string): string { return (name?.trim()[0] ?? 'A').toUpperCase(); }
  glyph(k: string): string { return LEDGER_KIND_META[k as LedgerKind]?.glyph ?? '•'; }
  date(iso: string): string { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  verLabel(v: VerificationLevel): string { return VERIFICATION_META[v].label; }
  verTone(v: VerificationLevel): string { return VERIFICATION_META[v].tone; }
}
