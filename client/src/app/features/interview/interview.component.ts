import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { InterviewService, InterviewSession, InterviewTypeMeta } from '../../core/services/interview.service';
import { printDocument, PrintSection } from '../../shared/util/print';
import { downloadPdf } from '../../shared/util/pdf';

@Component({
  selector: 'asta-interview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, RingComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Interview OS</h1>
        <span class="goal-pill"><span class="dot"></span>Mock interviews for your target role — scored, with a feedback report</span>
      </div>
      @if (session()) { <div class="shrink-0"><asta-btn variant="ghost" size="sm" (click)="exit()">All interviews</asta-btn></div> }
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="160px" /></asta-card>
    } @else if (session()) {
      @if (session(); as s) {
        @if (s.status === 'finished') {
          <!-- report -->
          <asta-card class="block motion-card-reveal motion-row-primary mb-4 report">
            <div class="flex items-start gap-4 flex-wrap">
              <div class="text-center shrink-0"><asta-ring [value]="s.overallScore" [size]="92" /><p class="g-lbl">Overall</p></div>
              <div class="min-w-0 flex-1">
                <p class="kicker mb-1">{{ s.typeLabel }} · {{ s.role }}</p>
                <p class="summary">{{ s.summary }}</p>
                <div class="grid grid-cols-3 gap-2 mt-3">
                  <div class="sub"><span class="sv">{{ s.technicalScore }}</span><span class="sl">Technical</span></div>
                  <div class="sub"><span class="sv">{{ s.communicationScore }}</span><span class="sl">Communication</span></div>
                  <div class="sub"><span class="sv">{{ s.confidenceScore }}</span><span class="sl">Confidence</span></div>
                </div>
              </div>
            </div>
          </asta-card>
          @if (s.strengths.length) {
            <asta-card class="block motion-card-reveal motion-row-2 mb-4">
              <p class="kicker mb-2">What went well</p>
              <div class="flex flex-wrap gap-1.5">@for (st of s.strengths; track st) { <span class="strength">{{ st }}</span> }</div>
            </asta-card>
          }
          @if (s.weakConcepts.length) {
            <asta-card class="block motion-card-reveal motion-row-2 mb-4">
              <div class="flex items-center justify-between mb-2"><p class="kicker !mb-0">Weak areas → added to Mistake OS</p><asta-btn variant="ghost" size="sm" (click)="go('/app/mistakes')">Repair →</asta-btn></div>
              <div class="flex flex-wrap gap-1.5">@for (w of s.weakConcepts; track w) { <span class="weak">{{ w }}</span> }</div>
            </asta-card>
          }
          <asta-card class="block motion-card-reveal motion-row-3">
            <div class="flex items-center justify-between mb-3">
              <p class="kicker !mb-0">Question review</p>
              <div class="flex gap-3">
                <button class="copy-report" (click)="copyReport(s)">Copy report</button>
                <button class="copy-report" (click)="printReport(s)">Print</button>
                <button class="copy-report" (click)="downloadReportPdf(s)">Download PDF</button>
              </div>
            </div>
            <div class="space-y-3">
              @for (q of s.questions; track q.id) {
                <div class="qa">
                  <p class="q">{{ q.question }}</p>
                  @if (q.answered) {
                    <p class="a">{{ q.answer }}</p>
                    <p class="fb"><span class="score" [style.color]="scoreColor(q.score)">{{ q.score }}</span> {{ q.feedback }}</p>
                  } @else { <p class="skip">Skipped</p> }
                </div>
              }
            </div>
            <div class="mt-4 flex gap-2"><asta-btn variant="accent" size="sm" (click)="go('/app/career-readiness')">See readiness impact →</asta-btn><asta-btn variant="ghost" size="sm" (click)="exit()">New interview</asta-btn></div>
          </asta-card>
        } @else {
          <!-- active session -->
          <asta-card class="block motion-card-reveal motion-row-primary active">
            <div class="flex items-center justify-between mb-3">
              <p class="kicker !mb-0">{{ s.typeLabel }} · {{ s.role }}</p>
              <span class="prog">Q{{ Math.min(s.currentIndex + 1, s.total) }} / {{ s.total }}</span>
            </div>
            @if (currentQ(s); as q) {
              <p class="question">{{ q.question }}</p>
              <textarea class="answer" rows="5" [ngModel]="draft()" (ngModelChange)="draft.set($event)" placeholder="Type (or dictate) your answer…" [disabled]="busy()"></textarea>
              @if (lastFeedback()) { <div class="fb-box"><span class="score" [style.color]="scoreColor(lastScore())">{{ lastScore() }}</span> {{ lastFeedback() }}</div> }
              <div class="mt-3 flex gap-2">
                <asta-btn variant="accent" size="sm" (click)="submit(s)" [disabled]="busy() || !draft().trim()">{{ busy() ? 'Scoring…' : 'Submit answer' }}</asta-btn>
                @if (s.currentIndex < s.total - 1) {
                  <asta-btn variant="ghost" size="sm" (click)="skip(s)" [disabled]="busy()">Skip</asta-btn>
                }
                <asta-btn variant="ghost" size="sm" (click)="finish(s)" [disabled]="busy()">Finish &amp; get report</asta-btn>
              </div>
            } @else {
              <asta-empty-state title="All questions answered" description="Finish to get your scored report."><asta-btn variant="accent" (click)="finish(s)">Finish &amp; get report</asta-btn></asta-empty-state>
            }
          </asta-card>
        }
      }
    } @else {
      <!-- picker + history -->
      <asta-card class="block motion-card-reveal motion-row-primary mb-4">
        <p class="kicker mb-3">Start a mock interview</p>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          @for (t of types(); track t.type) {
            <button class="type" (click)="start(t.type)" [disabled]="busy()">
              <span class="t-label">{{ t.label }}</span>
              <span class="t-focus">{{ t.focus }}</span>
            </button>
          }
        </div>
      </asta-card>

      @if (insights(); as ins) {
        <asta-card class="block motion-card-reveal motion-row-2 mb-4 insights">
          <div class="flex items-center justify-between mb-3">
            <p class="kicker !mb-0">Your interview progress</p>
            @if (ins.delta !== null) {
              <span class="delta" [style.color]="ins.delta >= 0 ? 'var(--green-deep)' : 'var(--danger, #ff5d5d)'">
                {{ ins.delta >= 0 ? '▲' : '▼' }} {{ Math.abs(ins.delta) }} vs previous
              </span>
            }
          </div>
          <div class="ins-grid">
            <div class="stat"><span class="sv" [style.color]="scoreColor(ins.best)">{{ ins.best }}</span><span class="sl">Best</span></div>
            <div class="stat"><span class="sv">{{ ins.avg }}</span><span class="sl">Average</span></div>
            <div class="stat"><span class="sv">{{ ins.count }}</span><span class="sl">Completed</span></div>
            <div class="stat"><span class="sv" [style.color]="scoreColor(ins.latest)">{{ ins.latest }}</span><span class="sl">Latest</span></div>
          </div>
          @if (ins.count >= 2) {
            <svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none">
              <polyline [attr.points]="sparkPoints()" fill="none" stroke="var(--peri, #8aa6ff)" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <p class="spark-cap">Overall score across your last {{ ins.count }} interviews</p>
          }
          @if (byType().length) {
            <div class="by-type">
              @for (t of byType(); track t.type) {
                <div class="bt-row">
                  <span class="bt-label">{{ t.label }}</span>
                  <span class="bt-bar"><span class="bt-fill" [style.width.%]="t.best" [style.background]="scoreColor(t.best)"></span></span>
                  <span class="bt-val">{{ t.best }} <span class="bt-n">×{{ t.count }}</span></span>
                </div>
              }
            </div>
          }
        </asta-card>
      }

      <asta-card class="block motion-card-reveal motion-row-3">
        <p class="kicker mb-3">Past interviews</p>
        @if (sessions().length) {
          <div class="space-y-2">
            @for (s of sessions(); track s.id) {
              <button class="hist" (click)="open(s.id)">
                <span class="min-w-0 flex-1 text-left"><span class="h-title">{{ s.typeLabel }} · {{ s.role }}</span><span class="h-meta">{{ date(s.createdAt) }} · {{ s.status }}</span></span>
                @if (s.status === 'finished') { <span class="h-score" [style.color]="scoreColor(s.overallScore)">{{ s.overallScore }}</span> }
              </button>
            }
          </div>
        } @else { <p class="text-sm text-txt-mute">No interviews yet — pick a type above to get your baseline.</p> }
      </asta-card>
    }
  `,
  styles: [`
    :host { display: block; }
    .copy-report { font-size: 11px; color: var(--peri, #8aa6ff); background: transparent; border: none; cursor: pointer; }
    .copy-report:hover { color: var(--green-deep); }
    .type { text-align: left; padding: 12px 14px; border: 1px solid var(--paper-3); border-radius: 12px; background: var(--paper-2); cursor: pointer; transition: border-color .15s, transform .1s; }
    .type:hover { border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); transform: translateY(-1px); }
    .t-label { display: block; font-size: 13.5px; font-weight: 600; }
    .t-focus { display: block; font-size: 11.5px; color: var(--text-mute); margin-top: 2px; }
    .hist { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: 1px solid var(--paper-3); border-radius: 11px; background: var(--paper-2); cursor: pointer; }
    .hist:hover { border-color: color-mix(in oklab, var(--green) 40%, var(--paper-3)); }
    .h-title { display: block; font-size: 13px; font-weight: 600; }
    .h-meta { display: block; font-size: 11px; color: var(--text-mute); }
    .h-score { font-size: 15px; font-weight: 700; }
    .active { border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 25%, var(--paper-3)); }
    .prog { font-size: 11px; color: var(--text-mute); font-variant-numeric: tabular-nums; }
    .question { font-size: 16px; font-weight: 600; line-height: 1.4; margin-bottom: 10px; }
    .answer { width: 100%; padding: 11px 13px; border-radius: 11px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 14px; font-family: inherit; }
    .fb-box { margin-top: 10px; padding: 9px 11px; border-radius: 10px; background: var(--paper-2); border: 1px solid var(--paper-3); font-size: 13px; color: var(--text-soft); }
    .score { font-weight: 700; margin-right: 6px; }
    .report { border: 1px solid color-mix(in oklab, var(--green) 22%, var(--paper-3)); }
    .g-lbl { font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }
    .summary { font-size: 13.5px; color: var(--text-soft); line-height: 1.5; }
    .sub { text-align: center; padding: 8px; border-radius: 10px; background: var(--paper-2); }
    .sv { display: block; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .sl { display: block; font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; }
    .weak { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--coral, #ffb454) 35%, var(--paper-3)); }
    .strength { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 38%, var(--paper-3)); color: var(--green-deep); }
    .qa { padding: 10px 12px; border: 1px solid var(--paper-3); border-radius: 11px; background: var(--paper-2); }
    .q { font-size: 13px; font-weight: 600; }
    .a { font-size: 12.5px; color: var(--text-soft); margin-top: 5px; }
    .fb { font-size: 12px; color: var(--text-mute); margin-top: 5px; }
    .skip { font-size: 12px; color: var(--text-mute); font-style: italic; margin-top: 4px; }
    .insights { border: 1px solid color-mix(in oklab, var(--peri, #8aa6ff) 18%, var(--paper-3)); }
    .delta { font-size: 11.5px; font-weight: 600; }
    .ins-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .stat { text-align: center; padding: 9px 6px; border-radius: 10px; background: var(--paper-2); }
    .stat .sv { display: block; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stat .sl { display: block; font-size: 10px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; margin-top: 1px; }
    .spark { width: 100%; height: 36px; margin-top: 14px; display: block; }
    .spark-cap { font-size: 10.5px; color: var(--text-mute); text-align: center; margin-top: 2px; }
    .by-type { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--paper-3); display: flex; flex-direction: column; gap: 7px; }
    .bt-row { display: grid; grid-template-columns: 130px 1fr auto; align-items: center; gap: 10px; }
    .bt-label { font-size: 12px; color: var(--text-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bt-bar { height: 7px; border-radius: 999px; background: var(--paper-2); overflow: hidden; }
    .bt-fill { display: block; height: 100%; border-radius: 999px; transition: width .3s; }
    .bt-val { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .bt-n { font-size: 10.5px; font-weight: 500; color: var(--text-mute); }
  `],
})
export class InterviewComponent {
  private readonly api = inject(InterviewService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly Math = Math;
  readonly types = signal<InterviewTypeMeta[]>([]);
  readonly sessions = signal<InterviewSession[]>([]);
  readonly session = signal<InterviewSession | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly draft = signal('');
  readonly lastFeedback = signal('');
  readonly lastScore = signal<number | null>(null);

  /** Finished sessions in chronological (oldest→newest) order — server returns newest-first. */
  private readonly finished = computed(() =>
    this.sessions().filter((s) => s.status === 'finished').slice().reverse(),
  );

  readonly insights = computed(() => {
    const f = this.finished();
    if (!f.length) return null;
    const scores = f.map((s) => s.overallScore);
    const latest = scores[scores.length - 1];
    const prev = scores.length >= 2 ? scores[scores.length - 2] : null;
    return {
      count: f.length,
      best: Math.max(...scores),
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      latest,
      delta: prev === null ? null : latest - prev,
    };
  });

  readonly byType = computed(() => {
    const map = new Map<string, { type: string; label: string; best: number; count: number }>();
    for (const s of this.finished()) {
      const e = map.get(s.type) ?? { type: s.type, label: s.typeLabel, best: 0, count: 0 };
      e.best = Math.max(e.best, s.overallScore);
      e.count += 1;
      map.set(s.type, e);
    }
    return [...map.values()].sort((a, b) => b.best - a.best);
  });

  readonly sparkPoints = computed(() => {
    const scores = this.finished().map((s) => s.overallScore);
    if (scores.length < 2) return '';
    const step = 100 / (scores.length - 1);
    return scores.map((v, i) => `${(i * step).toFixed(1)},${(30 - (v / 100) * 28).toFixed(1)}`).join(' ');
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.session(id).subscribe({ next: (s) => { this.session.set(s); this.loading.set(false); }, error: () => { this.loading.set(false); this.toast.error('Session not found'); } });
    } else {
      this.api.types().subscribe({ next: (t) => this.types.set(t), error: () => {} });
      this.api.sessions().subscribe({ next: (s) => { this.sessions.set(s); this.loading.set(false); }, error: () => this.loading.set(false) });
    }
  }

  currentQ(s: InterviewSession) { return s.questions[s.currentIndex] ?? null; }

  start(type: string): void {
    this.busy.set(true);
    this.api.start(type).subscribe({ next: (s) => { this.session.set(s); this.resetTurn(); this.busy.set(false); }, error: () => { this.busy.set(false); this.toast.error('Could not start'); } });
  }
  open(id: string): void {
    this.loading.set(true);
    this.api.session(id).subscribe({ next: (s) => { this.session.set(s); this.loading.set(false); }, error: () => { this.loading.set(false); this.toast.error('Not found'); } });
  }
  submit(s: InterviewSession): void {
    this.busy.set(true);
    this.api.respond(s.id, this.draft().trim()).subscribe({
      next: (updated) => {
        const q = updated.questions[s.currentIndex];
        this.lastScore.set(q?.score ?? null); this.lastFeedback.set(q?.feedback ?? '');
        this.draft.set(''); this.session.set(updated); this.busy.set(false);
      },
      error: () => { this.busy.set(false); this.toast.error('Scoring failed'); },
    });
  }
  skip(s: InterviewSession): void {
    this.busy.set(true);
    this.api.skip(s.id).subscribe({
      next: (updated) => { this.resetTurn(); this.session.set(updated); this.busy.set(false); },
      error: () => { this.busy.set(false); this.toast.error('Could not skip'); },
    });
  }
  finish(s: InterviewSession): void {
    this.busy.set(true);
    this.api.finish(s.id).subscribe({ next: (r) => { this.session.set(r); this.busy.set(false); this.resetTurn(); }, error: () => { this.busy.set(false); this.toast.error('Could not finish'); } });
  }
  exit(): void { this.session.set(null); this.router.navigate(['/app/interview']); this.refreshList(); }
  private refreshList(): void { this.api.types().subscribe({ next: (t) => this.types.set(t) }); this.api.sessions().subscribe({ next: (s) => this.sessions.set(s) }); }
  private resetTurn(): void { this.lastFeedback.set(''); this.lastScore.set(null); this.draft.set(''); }
  go(route: string): void { this.router.navigate([route]); }
  copyReport(s: InterviewSession): void {
    const lines: string[] = [];
    lines.push(`# Interview report — ${s.typeLabel} · ${s.role}`);
    lines.push(`\n**Overall ${s.overallScore}/100** · Technical ${s.technicalScore} · Communication ${s.communicationScore} · Confidence ${s.confidenceScore}\n`);
    if (s.summary) lines.push(s.summary, '');
    if (s.strengths.length) lines.push(`**Strengths:** ${s.strengths.join(', ')}\n`);
    if (s.weakConcepts.length) lines.push(`**Weak areas:** ${s.weakConcepts.join(', ')}\n`);
    lines.push('## Question review');
    for (const q of s.questions) {
      lines.push(`\n**Q: ${q.question}**`);
      if (q.answered) {
        lines.push(`A: ${q.answer}`);
        lines.push(`_Score ${q.score} — ${q.feedback}_`);
      } else lines.push('_Skipped_');
    }
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => this.toast.success('Interview report copied as Markdown'),
      () => this.toast.error('Copy failed'),
    );
  }
  private reportSections(s: InterviewSession): PrintSection[] {
    return [
      { paragraphs: s.summary ? [s.summary] : [] },
      ...(s.strengths.length ? [{ heading: 'Strengths', bullets: s.strengths }] : []),
      ...(s.weakConcepts.length ? [{ heading: 'Weak areas', bullets: s.weakConcepts }] : []),
      {
        heading: 'Question review',
        bullets: s.questions.map((q) =>
          q.answered ? `${q.question} — score ${q.score}: ${q.feedback}` : `${q.question} — skipped`,
        ),
      },
    ];
  }
  private reportSubtitle(s: InterviewSession): string {
    return `${s.role} · Overall ${s.overallScore}/100 · Technical ${s.technicalScore} · Communication ${s.communicationScore} · Confidence ${s.confidenceScore}`;
  }
  printReport(s: InterviewSession): void {
    printDocument(`Interview report — ${s.typeLabel}`, this.reportSubtitle(s), this.reportSections(s));
  }
  downloadReportPdf(s: InterviewSession): void {
    void downloadPdf(`interview-${s.typeLabel}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), `Interview report — ${s.typeLabel}`, this.reportSubtitle(s), this.reportSections(s))
      .then(() => this.toast.success('Report PDF downloaded'));
  }
  date(iso: string): string { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  scoreColor(s: number | null): string { const v = s ?? 0; return v >= 70 ? 'var(--green-deep)' : v >= 50 ? 'var(--coral, #ffb454)' : 'var(--danger, #ff5d5d)'; }
}
