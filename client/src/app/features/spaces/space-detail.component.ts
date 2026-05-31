import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { ToastService } from '../../core/services/toast.service';
import { TextToSpeechService } from '../../core/services/text-to-speech.service';
import { SpaceService, StudySpace } from '../../core/services/space.service';

@Component({
  selector: 'asta-space-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent, MarkdownPipe],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[24px] leading-tight mb-2 grad-flow truncate">{{ space()?.title || 'Space' }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ space() ? space()!.sources.length + ' sources' : 'Loading…' }}</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="back()">All spaces</asta-btn>
        @if (space()) { <asta-btn variant="ghost" size="sm" (click)="remove()">Delete</asta-btn> }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="320px" /></asta-card>
    } @else if (loadError() || !space()) {
      <asta-card><asta-empty-state title="Could not load this space" description=""><asta-btn variant="accent" (click)="reload()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else {
      <div class="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
        <div class="min-w-0 space-y-4">
          <!-- ask -->
          <asta-card class="block motion-card-reveal motion-row-primary">
            <p class="kicker mb-2">Ask your sources</p>
            <div class="flex gap-2">
              <input class="sp-input flex-1" [(ngModel)]="question" (keydown.enter)="ask()" placeholder="Ask anything grounded in this space…" [disabled]="asking()" aria-label="Question" />
              <asta-btn variant="accent" size="sm" [loading]="asking()" [disabled]="question.trim().length < 2" (click)="ask()">Ask</asta-btn>
            </div>
            @if (answer()) {
              <div class="answer mt-3" [innerHTML]="answer() | markdown"></div>
              @if (usedSources().length) { <p class="text-[11px] text-txt-mute mt-2">Grounded in: {{ usedSources().join(', ') }}</p> }
            }
          </asta-card>

          <!-- artifacts -->
          @for (a of space()!.artifacts; track a.id) {
            <asta-card class="block motion-card-reveal motion-row-2">
              <div class="flex items-center justify-between mb-1">
                <p class="kicker !mb-0">{{ a.title }}</p>
                @if (a.kind === 'audio_overview') { <asta-btn variant="ghost" size="sm" (click)="playAudio(a.content)">{{ tts.speaking() ? 'Stop' : '▶ Play' }}</asta-btn> }
              </div>
              <div class="prose-asta art" [innerHTML]="a.content | markdown"></div>
            </asta-card>
          }
        </div>

        <!-- rail: sources + generators -->
        <div class="space-y-4">
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-2">Sources</p>
            @for (src of space()!.sources; track src.id) {
              <div class="src-row">
                <span class="min-w-0"><span class="src-title">{{ src.title }}</span><span class="src-type">{{ src.type }}</span></span>
                <button class="x" (click)="removeSource(src.id)" aria-label="Remove">✕</button>
              </div>
            }
            <div class="add-src mt-2">
              <input class="sp-input" [(ngModel)]="srcTitle" placeholder="Source title" maxlength="120" aria-label="Source title" />
              <textarea class="sp-input mt-1.5" [(ngModel)]="srcText" rows="3" placeholder="Paste notes / transcript text…" aria-label="Source text"></textarea>
              <asta-btn variant="ghost" size="sm" class="mt-1.5 inline-block" [disabled]="srcTitle.trim().length < 1" (click)="addSource()">Add source</asta-btn>
            </div>
          </asta-card>

          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-2">Generate</p>
            <div class="grid gap-2">
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='sum'" (click)="summary()">✦ Summary</asta-btn>
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='cards'" (click)="flashcards()">▭ Flashcards</asta-btn>
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='audio'" (click)="audio()">🎙 Audio overview</asta-btn>
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='flow'" (click)="toFlow()">🧭 Learning flow</asta-btn>
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='quiz'" (click)="toQuiz()">✓ Quiz</asta-btn>
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='visual'" (click)="toVisual()">◈ Concept map</asta-btn>
            </div>
          </asta-card>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .sp-input { width: 100%; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 9px 12px; color: var(--text); font-size: 14px; font-family: inherit; }
      .sp-input:focus { outline: none; border-color: var(--green); }
      .answer, .art { font-size: 14px; line-height: 1.6; }
      .src-row { display: flex; align-items: center; gap: 8px; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--paper-3); }
      .src-title { display: block; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .src-type { display: block; font-size: 10px; color: var(--text-mute); text-transform: uppercase; }
      .x { border: none; background: transparent; color: var(--text-mute); cursor: pointer; }
      .x:hover { color: var(--danger, #ff5d5d); }
    `,
  ],
})
export class SpaceDetailComponent {
  private readonly api = inject(SpaceService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly tts = inject(TextToSpeechService);

  readonly space = signal<StudySpace | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly asking = signal(false);
  readonly busy = signal<string | null>(null);
  readonly answer = signal('');
  readonly usedSources = signal<string[]>([]);
  question = '';
  srcTitle = '';
  srcText = '';

  constructor() { this.reload(); }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loadError.set(true); this.loading.set(false); return; }
    this.loading.set(true); this.loadError.set(false);
    this.api.get(id).subscribe({ next: (s) => { this.space.set(s); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }

  private id(): string { return this.space()!.id; }

  ask(): void {
    if (this.question.trim().length < 2) return;
    this.asking.set(true);
    this.api.ask(this.id(), this.question.trim()).subscribe({
      next: (r) => { this.answer.set(r.answer); this.usedSources.set(r.usedSources); this.asking.set(false); },
      error: (e: Error) => { this.asking.set(false); this.toast.error(e.message || 'Could not answer'); },
    });
  }

  addSource(): void {
    if (this.srcTitle.trim().length < 1) return;
    this.api.addSource(this.id(), { type: 'text', title: this.srcTitle.trim(), text: this.srcText.trim() }).subscribe({
      next: (s) => { this.space.set(s); this.srcTitle = ''; this.srcText = ''; this.toast.success('Source added'); },
      error: () => this.toast.error('Could not add source'),
    });
  }
  removeSource(sourceId: string): void {
    this.api.removeSource(this.id(), sourceId).subscribe({ next: (s) => this.space.set(s), error: () => this.toast.error('Could not remove') });
  }

  summary(): void { this.run('sum', this.api.summary(this.id()), 'Summary generated'); }
  flashcards(): void { this.run('cards', this.api.flashcards(this.id()), 'Flashcards generated'); }
  audio(): void {
    this.busy.set('audio');
    this.api.audioOverview(this.id()).subscribe({
      next: (r) => { this.space.set(r.space); this.busy.set(null); this.toast.success('Audio overview ready'); if (this.tts.supported) this.tts.speak(r.script); },
      error: () => { this.busy.set(null); this.toast.error('Could not generate audio'); },
    });
  }
  toFlow(): void {
    this.busy.set('flow');
    this.api.createFlow(this.id()).subscribe({ next: (r) => { this.busy.set(null); this.toast.success('Flow created'); this.router.navigate(['/app/flows', r.flowId]); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Failed'); } });
  }
  toQuiz(): void {
    this.busy.set('quiz');
    this.api.createQuiz(this.id()).subscribe({ next: (r) => { this.busy.set(null); this.toast.success('Quiz created'); this.router.navigate(['/app/quizzes'], { queryParams: { quizId: r.quizId } }); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Failed'); } });
  }
  toVisual(): void {
    this.busy.set('visual');
    this.api.createVisual(this.id()).subscribe({ next: (r) => { this.busy.set(null); this.toast.success('Concept map created'); this.router.navigate(['/app/visuals', r.visualId]); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Failed'); } });
  }

  private run(key: string, obs: import('rxjs').Observable<StudySpace>, msg: string): void {
    this.busy.set(key);
    obs.subscribe({ next: (s) => { this.space.set(s); this.busy.set(null); this.toast.success(msg); }, error: () => { this.busy.set(null); this.toast.error('Failed'); } });
  }

  playAudio(script: string): void {
    if (this.tts.speaking()) { this.tts.cancel(); return; }
    this.tts.speak(script);
  }

  remove(): void {
    this.api.remove(this.id()).subscribe({ next: () => { this.toast.success('Space deleted'); this.router.navigate(['/app/spaces']); }, error: () => this.toast.error('Could not delete') });
  }
  back(): void { this.router.navigate(['/app/spaces']); }
}
