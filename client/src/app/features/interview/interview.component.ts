import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { InterviewService, InterviewSession, InterviewTypeMeta } from '../../core/services/interview.service';

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
          @if (s.weakConcepts.length) {
            <asta-card class="block motion-card-reveal motion-row-2 mb-4">
              <div class="flex items-center justify-between mb-2"><p class="kicker !mb-0">Weak areas → added to Mistake OS</p><asta-btn variant="ghost" size="sm" (click)="go('/app/mistakes')">Repair →</asta-btn></div>
              <div class="flex flex-wrap gap-1.5">@for (w of s.weakConcepts; track w) { <span class="weak">{{ w }}</span> }</div>
            </asta-card>
          }
          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-3">Question review</p>
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

      <asta-card class="block motion-card-reveal motion-row-2">
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
    .qa { padding: 10px 12px; border: 1px solid var(--paper-3); border-radius: 11px; background: var(--paper-2); }
    .q { font-size: 13px; font-weight: 600; }
    .a { font-size: 12.5px; color: var(--text-soft); margin-top: 5px; }
    .fb { font-size: 12px; color: var(--text-mute); margin-top: 5px; }
    .skip { font-size: 12px; color: var(--text-mute); font-style: italic; margin-top: 4px; }
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
  finish(s: InterviewSession): void {
    this.busy.set(true);
    this.api.finish(s.id).subscribe({ next: (r) => { this.session.set(r); this.busy.set(false); this.resetTurn(); }, error: () => { this.busy.set(false); this.toast.error('Could not finish'); } });
  }
  exit(): void { this.session.set(null); this.router.navigate(['/app/interview']); this.refreshList(); }
  private refreshList(): void { this.api.types().subscribe({ next: (t) => this.types.set(t) }); this.api.sessions().subscribe({ next: (s) => this.sessions.set(s) }); }
  private resetTurn(): void { this.lastFeedback.set(''); this.lastScore.set(null); this.draft.set(''); }
  go(route: string): void { this.router.navigate([route]); }
  date(iso: string): string { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  scoreColor(s: number | null): string { const v = s ?? 0; return v >= 70 ? 'var(--green-deep)' : v >= 50 ? 'var(--coral, #ffb454)' : 'var(--danger, #ff5d5d)'; }
}
