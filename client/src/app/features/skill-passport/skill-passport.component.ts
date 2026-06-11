import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import {
  PassportSkill,
  SkillPassport,
  SkillPassportService,
  VERIFICATION_META,
  VerificationLevel,
} from '../../core/services/skill-passport.service';
import { LedgerService } from '../../core/services/ledger.service';
import { LEDGER_KIND_META, LedgerKind } from '../../core/services/ledger.service';

@Component({
  selector: 'asta-skill-passport',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, RingComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Skill Passport</h1>
        <span class="goal-pill"><span class="dot"></span>Your living, verified profile of proven skills</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="recompute()" [disabled]="loading() || busy()">Recompute</asta-btn>
        @if (p()) {
          @if (p()!.visibility === 'public') {
            <asta-btn variant="ghost" size="sm" (click)="copyLink()">Copy link</asta-btn>
            <asta-btn variant="ghost" size="sm" (click)="setVisibility('private')" [disabled]="busy()">Unpublish</asta-btn>
          } @else {
            <asta-btn variant="accent" size="sm" (click)="setVisibility('public')" [disabled]="busy()">Publish</asta-btn>
          }
        }
      </div>
    </header>

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-3 mb-4">@for (i of [1,2,3]; track i) { <asta-card><asta-skeleton h="92px" /></asta-card> }</div>
      <asta-card><asta-skeleton h="260px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load your Skill Passport" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (p()) {
      @if (p(); as pp) {
      <!-- identity -->
      <asta-card class="block motion-card-reveal motion-row-primary mb-4 identity">
        <div class="flex items-start gap-4 flex-wrap">
          <span class="avatar">{{ initial(pp.identity.name) }}</span>
          <div class="min-w-0 flex-1">
            <p class="kicker mb-1">{{ pp.identity.targetRole }} · {{ pp.identity.currentLevel }} · pace {{ pp.identity.pace }}</p>
            <h2 class="ident-name">{{ pp.identity.name }}</h2>
            <p class="ident-head">{{ pp.identity.headline }}</p>
            <div class="flex flex-wrap gap-1.5 mt-2">
              @for (s of pp.identity.topSkills; track s) { <span class="top-chip">{{ s }}</span> }
            </div>
          </div>
          <div class="flex gap-4 shrink-0">
            <div class="text-center"><asta-ring [value]="pp.identity.readinessScore" [size]="74" /><p class="g-lbl">Readiness</p></div>
            <div class="text-center"><asta-ring [value]="pp.identity.healthScore" [size]="74" /><p class="g-lbl">Health</p></div>
          </div>
        </div>
        <div class="vis-row">
          <span class="vis-badge" [class.pub]="pp.visibility === 'public'">{{ visLabel(pp.visibility) }}</span>
          <span class="text-[11px] text-txt-mute">{{ pp.proofSummary.verifiedEvents }} verified events · {{ pp.skills.length }} skills tracked</span>
          <span class="ml-auto"><asta-btn variant="ghost" size="sm" (click)="go('/app/skill-passport/public-preview')">Public preview →</asta-btn></span>
        </div>
      </asta-card>

      <!-- proof summary -->
      <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 motion-row-2 mb-4">
        @for (m of proofTiles(pp); track m.label) {
          <asta-card class="stat motion-card-reveal" [style.--motion-card-index]="$index"><p class="num">{{ m.value }}</p><p class="lbl">{{ m.label }}</p></asta-card>
        }
      </div>

      <div class="grid gap-4 lg:grid-cols-[1fr_330px] items-start">
        <div class="min-w-0 space-y-4">
          <!-- skill graph -->
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-3">Skill graph · mastery · confidence · evidence</p>
            @if (pp.skills.length) {
              <div class="space-y-2.5">
                @for (s of pp.skills; track s.skill) {
                  <div class="skill-row">
                    <span class="s-label" [title]="s.skill"><span class="risk-dot" [style.background]="riskColor(s.riskLevel)"></span>{{ s.skill }}</span>
                    <span class="s-track">
                      <span class="s-fill" [style.width.%]="s.mastery"></span>
                      <span class="s-conf" [style.left.%]="s.confidence" title="confidence"></span>
                    </span>
                    <span class="s-meta">{{ s.mastery }} · {{ s.evidenceCount }}× proof</span>
                  </div>
                }
              </div>
            } @else {
              <p class="text-sm text-txt-mute">No skills tracked yet — take a quiz or advance a flow.</p>
            }
          </asta-card>

          <!-- projects -->
          <asta-card class="block motion-card-reveal motion-row-3">
            <div class="flex items-center justify-between mb-3">
              <p class="kicker !mb-0">Project evidence</p>
              <asta-btn variant="ghost" size="sm" (click)="go('/app/projects')">Project Studio →</asta-btn>
            </div>
            @if (pp.projects.length) {
              <div class="grid gap-2.5 sm:grid-cols-2">
                @for (pr of pp.projects; track pr.id) {
                  <div class="proj">
                    <div class="flex items-center justify-between gap-2">
                      <span class="proj-title">{{ pr.title }}</span>
                      @if (pr.aiScore !== null) { <span class="proj-score">{{ pr.aiScore }}</span> }
                    </div>
                    <div class="flex flex-wrap gap-1 mt-1.5">@for (t of pr.stack.slice(0,4); track t) { <span class="tech">{{ t }}</span> }</div>
                    <div class="flex items-center gap-2 mt-2 text-[11px] text-txt-mute">
                      <span class="dot-pill">{{ pr.status }}</span>
                      @if (pr.mentorStatus) { <span class="dot-pill" [class.ok]="pr.mentorStatus === 'approved'">{{ mentorLabel(pr.mentorStatus) }}</span> }
                      @if (pr.githubUrl) { <a [href]="pr.githubUrl" target="_blank" rel="noopener" class="lnk">repo</a> }
                      @if (pr.demoUrl) { <a [href]="pr.demoUrl" target="_blank" rel="noopener" class="lnk">demo</a> }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="text-sm text-txt-mute">No projects yet — build one to add proof recruiters can see.</p>
            }
          </asta-card>

          <!-- timeline -->
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-3">Learning timeline · toggle what's public</p>
            @if (pp.timeline.length) {
              <div class="timeline">
                @for (e of shownTimeline(pp); track e.id) {
                  <div class="row">
                    <span class="glyph" [title]="verLabel(e.verificationLevel)">{{ glyph(e.kind) }}</span>
                    <span class="line"></span>
                    <span class="min-w-0 flex-1">
                      <span class="t-title">{{ e.title }}</span>
                      <span class="t-meta"><span class="ver" [style.color]="verTone(e.verificationLevel)">{{ verLabel(e.verificationLevel) }}</span> · {{ date(e.at) }}@if (e.score !== null) { · {{ e.score }}% }</span>
                    </span>
                    <button class="eye" [class.off]="!e.visibleOnPassport" (click)="toggleVisible(e)" [attr.aria-label]="(e.visibleOnPassport ? 'Hide from public passport: ' : 'Show on public passport: ') + e.title" [title]="e.visibleOnPassport ? 'Public — click to hide' : 'Hidden — click to show'">{{ e.visibleOnPassport ? '👁' : '🚫' }}</button>
                  </div>
                }
              </div>
              @if (pp.timeline.length > 14) {
                <button class="tl-more" (click)="showAllTimeline.set(!showAllTimeline())">
                  {{ showAllTimeline() ? 'Show recent only' : 'Show all ' + pp.timeline.length + ' events' }}
                </button>
              }
            } @else {
              <p class="text-sm text-txt-mute">Your verified events will appear here as you learn.</p>
            }
          </asta-card>
        </div>

        <!-- right rail -->
        <div class="space-y-4">
          <!-- sharing controls -->
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-2">Public sharing controls</p>
            <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.showScores" (change)="patchSetting('showScores', $event)"> Show scores</label>
            <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.showProjects" (change)="patchSetting('showProjects', $event)"> Show projects</label>
            <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.showTimeline" (change)="patchSetting('showTimeline', $event)"> Show timeline</label>
            <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.showCertificates" (change)="patchSetting('showCertificates', $event)"> Show certificates</label>
            <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.verifiedOnly" (change)="patchSetting('verifiedOnly', $event)"> Verified skills only</label>
            <p class="text-[11px] text-txt-mute mt-2 break-all">Public link: /u/{{ pp.username }}</p>
          </asta-card>

          <!-- certificates -->
          @if (pp.certificates.length) {
            <asta-card class="block motion-card-reveal motion-row-3">
              <p class="kicker mb-2">Certificates</p>
              <div class="space-y-1.5">
                @for (c of pp.certificates; track c.id) {
                  <div class="cert"><span class="cert-t">{{ c.title }}</span><span class="cert-id">{{ c.verificationId }}</span></div>
                }
              </div>
            </asta-card>
          }

          <!-- add evidence -->
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-2">Add proof manually</p>
            <input class="inp" placeholder="Skill (e.g. React)" [ngModel]="evSkill()" (ngModelChange)="evSkill.set($event)" />
            <input class="inp" placeholder="What it proves" [ngModel]="evSummary()" (ngModelChange)="evSummary.set($event)" />
            <input class="inp" placeholder="Link (optional)" [ngModel]="evUrl()" (ngModelChange)="evUrl.set($event)" />
            <asta-btn variant="accent" size="sm" class="w-full" (click)="addEvidence()" [disabled]="busy() || !evSkill().trim() || !evSummary().trim()">Add evidence</asta-btn>
            @if (pp.manualEvidence.length) {
              <div class="mt-3 space-y-1.5">
                @for (ev of pp.manualEvidence; track ev.id) {
                  <div class="ev"><span class="min-w-0 flex-1"><b>{{ ev.skill }}</b> — {{ ev.summary }}</span><button class="rm" (click)="removeEvidence(ev.id)" [attr.aria-label]="'Remove evidence: ' + ev.skill">✕</button></div>
                }
              </div>
            }
          </asta-card>
        </div>
      </div>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .identity { border: 1px solid color-mix(in oklab, var(--green) 22%, var(--paper-3)); }
    .avatar { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, var(--green-deep), var(--green)); color: var(--ink); font-size: 24px; font-weight: 700; flex-shrink: 0; }
    .ident-name { font-size: 22px; font-weight: 700; line-height: 1.1; }
    .ident-head { font-size: 13.5px; color: var(--text-soft); margin-top: 2px; }
    .top-chip { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); color: var(--green-deep); }
    .g-lbl { font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }
    .vis-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--paper-3); flex-wrap: wrap; }
    .vis-badge { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 3px 9px; border-radius: 999px; background: var(--paper-3); color: var(--text-mute); }
    .vis-badge.pub { background: color-mix(in oklab, var(--green) 20%, transparent); color: var(--green-deep); }
    .stat { text-align: center; }
    .stat .num { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stat .lbl { font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
    .skill-row { display: grid; grid-template-columns: 150px 1fr auto; align-items: center; gap: 10px; }
    .s-label { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
    .risk-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .s-track { position: relative; height: 8px; border-radius: 999px; background: var(--paper-3); }
    .s-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--green-deep), var(--green)); transform-origin: left; animation: spFill .9s var(--ease) .3s both; }
    @keyframes spFill { from { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) { .s-fill { animation: none; } }
    .s-conf { position: absolute; top: -2px; width: 2px; height: 12px; background: var(--peri, #8aa6ff); }
    .s-meta { font-size: 10.5px; color: var(--text-mute); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .proj { padding: 10px 12px; border: 1px solid var(--paper-3); border-radius: 12px; background: var(--paper-2); }
    .proj-title { font-size: 13.5px; font-weight: 600; }
    .proj-score { font-size: 12px; font-weight: 700; color: var(--green-deep); }
    .tech { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: var(--paper-3); color: var(--text-soft); }
    .dot-pill { padding: 1px 7px; border-radius: 999px; border: 1px solid var(--paper-3); }
    .dot-pill.ok { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 40%, var(--paper-3)); }
    .lnk { color: var(--peri, #8aa6ff); }
    .timeline { display: flex; flex-direction: column; }
    .row { display: flex; gap: 12px; padding: 9px 0; position: relative; align-items: center; }
    .glyph { font-size: 15px; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: var(--paper-2); border: 1px solid var(--paper-3); flex-shrink: 0; z-index: 1; }
    .line { position: absolute; left: 12px; top: 30px; bottom: -9px; width: 2px; background: var(--paper-3); }
    .row:last-child .line { display: none; }
    .t-title { display: block; font-size: 13.5px; font-weight: 600; }
    .t-meta { display: block; font-size: 11px; color: var(--text-mute); margin-top: 1px; }
    .ver { font-weight: 600; }
    .eye { background: transparent; border: none; cursor: pointer; font-size: 14px; opacity: .9; }
    .eye.off { opacity: .4; }
    .tog { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; cursor: pointer; }
    .cert { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; }
    .cert-id { color: var(--text-mute); font-size: 10.5px; font-variant-numeric: tabular-nums; }
    .inp { width: 100%; margin-bottom: 7px; padding: 7px 10px; border-radius: 9px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 13px; }
    .ev { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-soft); }
    .rm { background: transparent; border: none; color: var(--text-mute); cursor: pointer; }
    .rm:hover { color: var(--danger, #ff5d5d); }
    .tl-more { margin-top: 10px; font-size: 12px; color: var(--peri, #8aa6ff); background: transparent; border: none; cursor: pointer; padding: 4px 0; }
    .tl-more:hover { color: var(--green-deep); }
  `],
})
export class SkillPassportComponent {
  private readonly api = inject(SkillPassportService);
  private readonly ledger = inject(LedgerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly p = signal<SkillPassport | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal(false);
  readonly evSkill = signal('');
  readonly evSummary = signal('');
  readonly evUrl = signal('');
  readonly showAllTimeline = signal(false);

  shownTimeline(pp: SkillPassport): SkillPassport['timeline'] {
    return this.showAllTimeline() ? pp.timeline : pp.timeline.slice(0, 14);
  }

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.me().subscribe({
      next: (p) => { this.p.set(p); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  recompute(): void {
    this.busy.set(true);
    this.api.recompute().subscribe({
      next: (p) => { this.p.set(p); this.busy.set(false); this.toast.success('Passport recomputed'); },
      error: () => { this.busy.set(false); this.toast.error('Recompute failed'); },
    });
  }

  setVisibility(v: 'public' | 'private'): void {
    this.busy.set(true);
    const obs = v === 'public' ? this.api.publish() : this.api.unpublish();
    obs.subscribe({
      next: (p) => { this.p.set(p); this.busy.set(false); this.toast.success(v === 'public' ? 'Passport published' : 'Passport is now private'); },
      error: () => { this.busy.set(false); this.toast.error('Could not update visibility'); },
    });
  }

  patchSetting(key: string, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    this.api.patch({ publicSettings: { [key]: checked } }).subscribe({
      next: (p) => this.p.set(p),
      error: () => this.toast.error('Could not save setting'),
    });
  }

  toggleVisible(e: { id: string; visibleOnPassport: boolean }): void {
    const next = !e.visibleOnPassport;
    this.ledger.setVisibility(e.id, next).subscribe({
      next: () => {
        const cur = this.p();
        if (cur) this.p.set({ ...cur, timeline: cur.timeline.map((t) => (t.id === e.id ? { ...t, visibleOnPassport: next } : t)) });
      },
      error: () => this.toast.error('Could not update'),
    });
  }

  addEvidence(): void {
    this.busy.set(true);
    this.api.addEvidence({ skill: this.evSkill().trim(), sourceType: this.evUrl().trim() ? 'link' : 'manual', summary: this.evSummary().trim(), url: this.evUrl().trim() || undefined }).subscribe({
      next: () => { this.evSkill.set(''); this.evSummary.set(''); this.evUrl.set(''); this.busy.set(false); this.toast.success('Evidence added'); this.refresh(); },
      error: () => { this.busy.set(false); this.toast.error('Could not add evidence'); },
    });
  }

  removeEvidence(id: string): void {
    this.api.removeEvidence(id).subscribe({ next: () => this.refresh(), error: () => this.toast.error('Could not remove') });
  }

  copyLink(): void {
    const pp = this.p();
    if (!pp) return;
    const url = `${location.origin}/u/${pp.username}`;
    navigator.clipboard?.writeText(url).then(() => this.toast.success('Public link copied'), () => this.toast.error('Copy failed'));
  }

  proofTiles = (pp: SkillPassport) => [
    { label: 'Verified', value: pp.proofSummary.verifiedEvents },
    { label: 'Quizzes', value: pp.proofSummary.quizzesPassed },
    { label: 'Projects', value: pp.proofSummary.projectsCompleted },
    { label: 'Sims', value: pp.proofSummary.simulationsPassed },
    { label: 'Certs', value: pp.proofSummary.certificatesIssued },
    { label: 'Fixes', value: pp.proofSummary.mistakesResolved },
  ];

  initial(name: string): string { return (name?.trim()[0] ?? 'A').toUpperCase(); }
  go(route: string): void { this.router.navigate([route]); }
  glyph(k: string): string { return LEDGER_KIND_META[k as LedgerKind]?.glyph ?? '•'; }
  date(iso: string): string { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  visLabel(v: string): string { return v === 'public' ? 'Public' : v === 'unlisted' ? 'Unlisted' : 'Private'; }
  verLabel(v: VerificationLevel): string { return VERIFICATION_META[v].label; }
  verTone(v: VerificationLevel): string { return VERIFICATION_META[v].tone; }
  mentorLabel(s: string): string { return s === 'approved' ? 'mentor ✓' : s === 'pending' ? 'review pending' : 'changes requested'; }
  riskColor(r: PassportSkill['riskLevel']): string { return r === 'high' ? 'var(--danger, #ff5d5d)' : r === 'medium' ? 'var(--coral, #ffb454)' : 'var(--green)'; }
}
