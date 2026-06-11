import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { CareerReadinessService, CareerRoleSummary, ReadinessAnalysis, ReadinessDimension } from '../../core/services/career-readiness.service';
import { printDocument, PrintSection } from '../../shared/util/print';
import { downloadPdf } from '../../shared/util/pdf';

@Component({
  selector: 'asta-career-readiness',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, RingComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Career Readiness</h1>
        <span class="goal-pill"><span class="dot"></span>How close you are to your target role — and exactly what's blocking you</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        @if (a()) {
          <asta-btn variant="ghost" size="sm" (click)="copyDigest()">Copy plan</asta-btn>
          <asta-btn variant="ghost" size="sm" (click)="printPlan()">Print</asta-btn>
          <asta-btn variant="ghost" size="sm" (click)="downloadPlanPdf()">Download PDF</asta-btn>
        }
        <asta-btn variant="ghost" size="sm" (click)="analyze()" [disabled]="loading() || busy()">Re-analyze</asta-btn>
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="120px" /></asta-card>
      <div class="grid gap-3 sm:grid-cols-3 my-3">@for (i of [1,2,3]; track i) { <asta-card><asta-skeleton h="90px" /></asta-card> }</div>
      <asta-card><asta-skeleton h="200px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load readiness" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (a()) {
      @if (a(); as an) {
      <!-- role selector + score -->
      <asta-card class="block motion-card-reveal motion-row-primary mb-4 hero">
        <div class="flex items-center gap-5 flex-wrap">
          <div class="text-center shrink-0">
            <asta-ring [value]="an.readinessScore" [size]="98" />
            <p class="band" [style.color]="bandColor(an.band)">{{ bandLabel(an.band) }}</p>
          </div>
          <div class="min-w-0 flex-1">
            <p class="kicker mb-1">Target role</p>
            <div class="flex items-center gap-2 flex-wrap">
              <select class="role-select" [value]="an.role.id" (change)="onRole($event)">
                @for (r of roles(); track r.id) { <option [value]="r.id">{{ r.title }} · {{ r.level }}</option> }
              </select>
            </div>
            <p class="explain">{{ an.explanation }}</p>
          </div>
        </div>
      </asta-card>

      <!-- dimensions with explainability -->
      <asta-card class="block motion-card-reveal motion-row-2 mb-4">
        <p class="kicker mb-3">Why this score · {{ an.readinessScore }}% across 5 dimensions</p>
        <div class="space-y-2">
          @for (d of an.dimensions; track d.key) {
            <div class="dim">
              <div class="dim-head" role="button" tabindex="0" (click)="toggle(d.key)" (keyup.enter)="toggle(d.key)">
                <span class="d-label">{{ d.label }}</span>
                <span class="d-track"><span class="d-fill" [style.width.%]="d.score" [style.background]="scoreColor(d.score)"></span></span>
                <span class="d-score">{{ d.score }}</span>
                <span class="d-weight">×{{ pct(d.weight) }}</span>
                <button class="why-btn">{{ open() === d.key ? '−' : 'why' }}</button>
              </div>
              @if (open() === d.key) {
                <div class="dim-body">
                  @if (d.supports.length) { <p><span class="tag ok">Supports</span> {{ d.supports.join(' · ') }}</p> }
                  @if (d.missing.length) { <p><span class="tag miss">Missing</span> {{ d.missing.join(' · ') }}</p> }
                  <p><span class="tag fast">Fastest</span> {{ d.fastestAction }}</p>
                </div>
              }
            </div>
          }
        </div>
      </asta-card>

      <div class="grid gap-4 lg:grid-cols-[1fr_330px] items-start">
        <div class="min-w-0 space-y-4">
          <!-- skill gap matrix -->
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-3">Skill gap matrix</p>
            <div class="space-y-2">
              @for (s of an.skillGaps; track s.skill) {
                <div class="gap-row">
                  <span class="g-skill">{{ s.skill }}</span>
                  <span class="g-track"><span class="g-have" [style.width.%]="s.current"></span><span class="g-target" [style.left.%]="s.target"></span></span>
                  <span class="g-val" [class.met]="s.met">{{ s.current }}/{{ s.target }}</span>
                </div>
              }
            </div>
          </asta-card>

          <!-- 7-day plan -->
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-3">Your next 7 days</p>
            <div class="space-y-2">
              @for (it of an.weekPlan; track it.day) {
                <div class="plan">
                  <span class="day">D{{ it.day }}</span>
                  <span class="min-w-0 flex-1"><span class="p-title">{{ it.title }}</span><span class="p-reason">{{ it.reason }}</span></span>
                  <asta-btn size="sm" variant="ghost" (click)="go(it.route)">Open</asta-btn>
                </div>
              }
            </div>
          </asta-card>
        </div>

        <!-- right rail -->
        <div class="space-y-4">
          <!-- blockers -->
          <asta-card class="block motion-card-reveal motion-row-2 blockers">
            <p class="kicker mb-2">Top 3 blockers</p>
            <div class="space-y-2">
              @for (b of an.blockers; track b.title) {
                <div class="blk"><span class="blk-t">{{ b.title }}</span><span class="blk-i">{{ b.impact }}</span></div>
              }
              @if (!an.blockers.length) { <p class="text-sm text-txt-mute">No major blockers — keep stacking proof.</p> }
            </div>
          </asta-card>

          <!-- project / interview -->
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-2">Proof gaps</p>
            <div class="proof-line"><span>Projects</span><span [class.ok]="an.projectGap.met">{{ an.projectGap.have }}/{{ an.projectGap.need }}</span></div>
            <p class="proof-note">{{ an.projectGap.note }}</p>
            <div class="proof-line mt-2"><span>Interview</span><span [class.ok]="an.interviewGap.met">{{ an.interviewGap.score }}/100</span></div>
            <asta-btn size="sm" variant="ghost" class="w-full mt-2" (click)="go('/app/interview')">Run a mock interview →</asta-btn>
          </asta-card>

          <!-- portfolio checklist -->
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-2">Portfolio checklist</p>
            <div class="space-y-1">
              @for (c of an.portfolioChecklist; track c.item) {
                <div class="chk" [class.done]="c.done"><span class="box">{{ c.done ? '✓' : '○' }}</span> {{ c.item }}</div>
              }
            </div>
            <asta-btn size="sm" variant="accent" class="w-full mt-2" (click)="go('/app/skill-passport')">Open Skill Passport →</asta-btn>
          </asta-card>
        </div>
      </div>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .hero { border: 1px solid color-mix(in oklab, var(--green) 20%, var(--paper-3)); }
    .band { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-top: 4px; }
    .role-select { background: var(--paper-2); border: 1px solid var(--paper-3); color: var(--text); border-radius: 9px; padding: 7px 10px; font-size: 13.5px; font-weight: 600; }
    .explain { font-size: 13.5px; color: var(--text-soft); margin-top: 8px; line-height: 1.5; }
    .dim-head { display: grid; grid-template-columns: 130px 1fr auto auto auto; align-items: center; gap: 10px; cursor: pointer; }
    .d-label { font-size: 12.5px; font-weight: 500; }
    .d-track { height: 8px; border-radius: 999px; background: var(--paper-3); overflow: hidden; }
    /* Dimension scores fill from zero — the weighted story reads as motion. */
    .d-fill { display: block; height: 100%; border-radius: 999px; transform-origin: left; animation: crFill .9s var(--ease) .25s both; }
    @keyframes crFill { from { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) { .d-fill { animation: none; } }
    .d-score { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .d-weight { font-size: 10.5px; color: var(--text-mute); }
    .why-btn { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--paper-3); background: transparent; color: var(--peri, #8aa6ff); cursor: pointer; }
    .dim-body { margin-top: 8px; padding: 9px 11px; border-radius: 10px; background: var(--paper-2); font-size: 12.5px; color: var(--text-soft); display: flex; flex-direction: column; gap: 4px; }
    .tag { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 1px 6px; border-radius: 999px; margin-right: 6px; }
    .tag.ok { background: color-mix(in oklab, var(--green) 18%, transparent); color: var(--green-deep); }
    .tag.miss { background: color-mix(in oklab, var(--coral, #ffb454) 18%, transparent); color: var(--coral, #ffb454); }
    .tag.fast { background: color-mix(in oklab, var(--peri, #8aa6ff) 18%, transparent); color: var(--peri, #8aa6ff); }
    .gap-row { display: grid; grid-template-columns: 140px 1fr auto; align-items: center; gap: 10px; }
    .g-skill { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .g-track { position: relative; height: 8px; border-radius: 999px; background: var(--paper-3); }
    .g-have { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--green-deep), var(--green)); }
    .g-target { position: absolute; top: -2px; width: 2px; height: 12px; background: var(--peri, #8aa6ff); }
    .g-val { font-size: 11px; color: var(--text-mute); font-variant-numeric: tabular-nums; }
    .g-val.met { color: var(--green-deep); font-weight: 600; }
    .plan { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--paper-3); border-radius: 11px; background: var(--paper-2); }
    .day { font-size: 11px; font-weight: 700; color: var(--green-deep); width: 26px; flex-shrink: 0; }
    .p-title { display: block; font-size: 13px; font-weight: 600; }
    .p-reason { display: block; font-size: 11.5px; color: var(--text-mute); }
    .blockers { border: 1px solid color-mix(in oklab, var(--coral, #ffb454) 26%, var(--paper-3)); }
    .blk { padding: 8px 10px; border-radius: 10px; background: var(--paper-2); }
    .blk-t { display: block; font-size: 13px; font-weight: 600; }
    .blk-i { display: block; font-size: 11.5px; color: var(--text-mute); margin-top: 1px; }
    .proof-line { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; }
    .proof-line .ok { color: var(--green-deep); }
    .proof-note { font-size: 11.5px; color: var(--text-mute); margin-top: 2px; }
    .chk { font-size: 12.5px; color: var(--text-soft); display: flex; align-items: center; gap: 7px; }
    .chk.done { color: var(--green-deep); }
    .box { font-size: 13px; }
  `],
})
export class CareerReadinessComponent {
  private readonly api = inject(CareerReadinessService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly a = signal<ReadinessAnalysis | null>(null);
  readonly roles = signal<CareerRoleSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal(false);
  readonly open = signal<string | null>(null);

  constructor() {
    this.api.roles().subscribe({ next: (r) => this.roles.set(r), error: () => {} });
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.me().subscribe({
      next: (a) => { this.a.set(a); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  analyze(): void {
    this.busy.set(true);
    this.api.analyze().subscribe({
      next: (a) => { this.a.set(a); this.busy.set(false); this.toast.success('Readiness updated'); },
      error: () => { this.busy.set(false); this.toast.error('Analysis failed'); },
    });
  }

  onRole(ev: Event): void {
    const roleId = (ev.target as HTMLSelectElement).value;
    this.busy.set(true);
    this.api.setTargetRole(roleId).subscribe({
      next: (a) => { this.a.set(a); this.busy.set(false); },
      error: () => { this.busy.set(false); this.toast.error('Could not set role'); },
    });
  }

  copyDigest(): void {
    const an = this.a();
    if (!an) return;
    const lines: string[] = [];
    lines.push(`# Career Readiness — ${an.role.title} (${an.role.level})`);
    lines.push(`\n**${an.readinessScore}% ready · ${this.bandLabel(an.band)}**\n`);
    lines.push(an.explanation, '');
    lines.push('## Readiness by dimension');
    for (const d of an.dimensions) {
      lines.push(`- **${d.label}** — ${d.score}/100 (weight ×${this.pct(d.weight)}%) · fastest: ${d.fastestAction}`);
    }
    lines.push('\n## Skill gaps');
    for (const s of an.skillGaps) lines.push(`- ${s.skill}: ${s.current}/${s.target}${s.met ? ' ✓' : ''}`);
    if (an.blockers.length) {
      lines.push('\n## Top blockers');
      for (const b of an.blockers) lines.push(`- **${b.title}** — ${b.impact}`);
    }
    lines.push('\n## Your next 7 days');
    for (const it of an.weekPlan) lines.push(`- **Day ${it.day}: ${it.title}** — ${it.reason}`);
    lines.push('\n## Portfolio checklist');
    for (const c of an.portfolioChecklist) lines.push(`- [${c.done ? 'x' : ' '}] ${c.item}`);
    lines.push(`\n_Generated from Asta Career Readiness._`);
    const md = lines.join('\n');
    navigator.clipboard?.writeText(md).then(
      () => this.toast.success('Readiness plan copied as Markdown'),
      () => this.toast.error('Copy failed'),
    );
  }

  private planSections(an: ReadinessAnalysis): PrintSection[] {
    return [
      { paragraphs: an.explanation ? [an.explanation] : [] },
      { heading: 'Readiness by dimension', bullets: an.dimensions.map((d) => `${d.label}: ${d.score}/100 (×${this.pct(d.weight)}%) — fastest: ${d.fastestAction}`) },
      { heading: 'Skill gaps', bullets: an.skillGaps.map((s) => `${s.skill}: ${s.current}/${s.target}${s.met ? ' ✓' : ''}`) },
      ...(an.blockers.length ? [{ heading: 'Top blockers', bullets: an.blockers.map((b) => `${b.title} — ${b.impact}`) }] : []),
      { heading: 'Your next 7 days', bullets: an.weekPlan.map((it) => `Day ${it.day}: ${it.title} — ${it.reason}`) },
      { heading: 'Portfolio checklist', bullets: an.portfolioChecklist.map((c) => `${c.done ? '[x]' : '[ ]'} ${c.item}`) },
    ];
  }
  printPlan(): void {
    const an = this.a();
    if (!an) return;
    printDocument(`Career Readiness — ${an.role.title} (${an.role.level})`, `${an.readinessScore}% ready · ${this.bandLabel(an.band)}`, this.planSections(an));
  }
  downloadPlanPdf(): void {
    const an = this.a();
    if (!an) return;
    void downloadPdf(`career-readiness-${an.role.title}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), `Career Readiness — ${an.role.title} (${an.role.level})`, `${an.readinessScore}% ready · ${this.bandLabel(an.band)}`, this.planSections(an))
      .then(() => this.toast.success('Readiness PDF downloaded'));
  }

  toggle(k: ReadinessDimension['key']): void { this.open.set(this.open() === k ? null : k); }
  go(route: string): void { this.router.navigate([route]); }
  pct(w: number): number { return Math.round(w * 100); }
  bandLabel(b: string): string { return b === 'ready' ? 'Job-ready' : b === 'close' ? 'Almost there' : b === 'building' ? 'Building' : 'Early days'; }
  bandColor(b: string): string { return b === 'ready' ? 'var(--green-deep)' : b === 'close' ? 'var(--green)' : b === 'building' ? 'var(--coral, #ffb454)' : 'var(--text-mute)'; }
  scoreColor(s: number): string { return s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--coral, #ffb454)' : 'var(--danger, #ff5d5d)'; }
}
