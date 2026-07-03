import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { MarketplaceService, Template } from '../../core/services/marketplace.service';

@Component({
    selector: 'asta-creator-studio',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Creator Studio</h1>
        <span class="goal-pill"><span class="dot"></span>Publish reusable learning templates to the marketplace</span>
      </div>
    </header>

    <div class="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
      <div class="min-w-0 space-y-4">
        <asta-card class="block motion-card-reveal motion-row-primary">
          <p class="kicker mb-2">New template</p>
          <div class="grid grid-cols-2 gap-2">
            <select class="inp" [(ngModel)]="form.type">
              <option value="flow">Flow</option><option value="roadmap">Roadmap</option><option value="quiz">Quiz</option>
              <option value="project">Project</option><option value="simulation">Simulation</option><option value="interview">Interview</option>
              <option value="course">Course</option><option value="study_space">Study space</option><option value="visual">Visual</option>
            </select>
            <select class="inp" [(ngModel)]="form.level" aria-label="Level">
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </div>
          <input class="inp mt-2" placeholder="Target role (optional)" [(ngModel)]="form.targetRole" />
          <input class="inp mt-2" placeholder="Title" [(ngModel)]="form.title" />
          <textarea class="inp mt-2" rows="2" placeholder="Description" [(ngModel)]="form.description"></textarea>
          <input class="inp mt-2" placeholder="Tags (comma separated)" [ngModel]="tagsStr()" (ngModelChange)="tagsStr.set($event)" />

          <!-- Type-specific content the clone pipeline actually uses (CREATOR-GAP-001) -->
          @if (form.type === 'quiz') {
            <input class="inp mt-2" placeholder="Quiz topic (what learners are tested on)" [(ngModel)]="meta.topic" />
          } @else if (form.type === 'visual') {
            <input class="inp mt-2" placeholder="Concept to visualize" [(ngModel)]="meta.concept" />
            <select class="inp mt-2" [(ngModel)]="meta.visualType" aria-label="Visual type">
              @for (v of visualTypes; track v) { <option [value]="v">{{ label(v) }}</option> }
            </select>
          } @else if (form.type === 'course') {
            <input class="inp mt-2" placeholder="Audience (who the course is for)" [(ngModel)]="meta.audience" />
          }
          <textarea class="inp mt-2" rows="2" [placeholder]="goalPlaceholder()" [ngModel]="goal()" (ngModelChange)="goal.set($event)"></textarea>
          <p class="hint">{{ hint() }}</p>
          <div class="mt-3"><asta-btn variant="accent" size="sm" (click)="create()" [disabled]="busy() || !form.title">Create draft</asta-btn></div>
        </asta-card>

        <asta-card class="block motion-card-reveal motion-row-2">
          <p class="kicker mb-3">Your templates</p>
          @if (mineError()) {
            <div class="err">Couldn't load your templates. <button class="lnk" (click)="loadMine()">Retry</button></div>
          }
          @if (mine().length) {
            <div class="space-y-2">
              @for (t of mine(); track t.id) {
                <div class="row">
                  <span class="min-w-0 flex-1"><span class="r-title">{{ t.title }}</span><span class="r-meta">{{ t.type }} · {{ t.usageCount }} uses@if (t.rating.count) { · <span class="r-rate">★ {{ t.rating.avg.toFixed(1) }} ({{ t.rating.count }})</span> }</span></span>
                  <span class="status" [attr.data-s]="t.status">{{ t.status }}</span>
                  @if (t.status === 'draft' || t.status === 'rejected') { <asta-btn size="sm" variant="ghost" (click)="submit(t)">Submit</asta-btn> }
                </div>
              }
            </div>
          } @else if (!mineError()) { <p class="text-sm text-txt-mute">No templates yet — create one above.</p> }
        </asta-card>
      </div>

      <div class="space-y-4">
        @if (isAdmin()) {
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-3">Moderation queue</p>
            @if (pendingError()) {
              <div class="err">Couldn't load the queue. <button class="lnk" (click)="loadPending()">Retry</button></div>
            }
            @if (pending().length) {
              <div class="space-y-2">
                @for (t of pending(); track t.id) {
                  <div class="mod">
                    <p class="r-title">{{ t.title }}</p>
                    <p class="r-meta">{{ t.type }} · by {{ t.creatorName }}</p>
                    <div class="flex gap-2 mt-2"><asta-btn size="sm" variant="accent" (click)="review(t, 'published')">Approve</asta-btn><asta-btn size="sm" variant="ghost" (click)="review(t, 'rejected')">Reject</asta-btn></div>
                  </div>
                }
              </div>
            } @else if (!pendingError()) { <asta-empty-state title="Queue clear" description="No templates awaiting review."></asta-empty-state> }
          </asta-card>
        } @else {
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-2">How it works</p>
            <p class="text-sm text-txt-soft">Create a draft, submit it for review, and once an admin approves it your template goes live in the Marketplace for other learners to clone.</p>
          </asta-card>
        }
      </div>
    </div>
  `,
    styles: [`
    :host { display: block; }
    .inp { width: 100%; padding: 8px 11px; border-radius: 9px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 13px; font-family: inherit; }
    .row, .mod { padding: 9px 11px; border: 1px solid var(--paper-3); border-radius: 11px; background: var(--paper-2); }
    .row { display: flex; align-items: center; gap: 10px; }
    .r-title { display: block; font-size: 13px; font-weight: 600; }
    .r-meta { display: block; font-size: 11px; color: var(--text-mute); }
    .r-rate { color: var(--coral, #ffb454); font-weight: 600; }
    .status { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; background: var(--paper-3); color: var(--text-mute); }
    .status[data-s="published"] { background: color-mix(in oklab, var(--green) 20%, transparent); color: var(--green-deep); }
    .status[data-s="pending_review"] { background: color-mix(in oklab, var(--peri, #8aa6ff) 20%, transparent); color: var(--peri, #8aa6ff); }
    .status[data-s="rejected"] { background: color-mix(in oklab, var(--danger, #ff5d5d) 18%, transparent); color: var(--danger, #ff5d5d); }
    .hint { font-size: 11px; color: var(--text-mute); margin-top: 5px; }
    .err { font-size: 12px; color: var(--danger, #ff5d5d); padding: 8px 11px; border: 1px solid color-mix(in oklab, var(--danger, #ff5d5d) 30%, var(--paper-3)); border-radius: 10px; margin-bottom: 8px; }
    .lnk { color: var(--green-deep); font-weight: 600; text-decoration: underline; cursor: pointer; background: none; border: none; padding: 0; font: inherit; }
  `]
})
export class CreatorStudioComponent {
  private readonly api = inject(MarketplaceService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  readonly mine = signal<Template[]>([]);
  readonly pending = signal<Template[]>([]);
  readonly mineError = signal(false);
  readonly pendingError = signal(false);
  readonly busy = signal(false);
  readonly tagsStr = signal('');
  readonly goal = signal('');
  readonly isAdmin = computed(() => this.auth.user()?.role === 'admin');
  /** Curated subset of the server's visual types (any is accepted; others map to mind_map). */
  readonly visualTypes = ['mind_map', 'flowchart', 'concept_graph', 'sequence_diagram', 'system_design', 'comparison', 'timeline', 'cheat_sheet'];
  form = { type: 'flow', title: '', description: '', targetRole: '', level: 'beginner' };
  /** Type-specific content the clone pipeline consumes (topic/concept/visualType/audience). */
  meta = { topic: '', concept: '', visualType: 'mind_map', audience: '' };

  readonly goalPlaceholder = computed(() =>
    this.form.type === 'quiz' || this.form.type === 'visual'
      ? 'Extra context for the AI (optional)…'
      : 'Starter goal/prompt learners will clone…');
  readonly hint = computed(() => {
    switch (this.form.type) {
      case 'quiz': return 'Learners clone this into a real quiz generated from the topic above.';
      case 'visual': return 'Learners clone this into a real visual of the concept above.';
      case 'course': return 'Learners clone this into a full generated course for that audience.';
      case 'simulation': case 'interview': case 'study_space':
        return 'Learners start a new ' + this.form.type.replace(/_/g, ' ') + ' seeded with this goal.';
      default: return 'Learners clone this into a real ' + this.form.type + ' generated from the goal.';
    }
  });

  constructor() {
    this.loadMine();
    if (this.isAdmin()) this.loadPending();
  }
  loadMine(): void { this.api.mine().subscribe({ next: (t) => { this.mine.set(t); this.mineError.set(false); }, error: () => this.mineError.set(true) }); }
  loadPending(): void { this.api.pending().subscribe({ next: (t) => { this.pending.set(t); this.pendingError.set(false); }, error: () => this.pendingError.set(true) }); }

  label(v: string): string { return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

  /** Build the structured content payload the clone pipeline reads, per type. */
  private buildContent(): Record<string, unknown> {
    const c: Record<string, unknown> = {};
    const goal = this.goal().trim();
    if (goal) c['goal'] = goal;
    if (this.form.type === 'quiz' && this.meta.topic.trim()) c['topic'] = this.meta.topic.trim();
    if (this.form.type === 'visual') {
      if (this.meta.concept.trim()) c['concept'] = this.meta.concept.trim();
      c['visualType'] = this.meta.visualType;
    }
    if (this.form.type === 'course' && this.meta.audience.trim()) c['audience'] = this.meta.audience.trim();
    return c;
  }

  create(): void {
    this.busy.set(true);
    const tags = this.tagsStr().split(',').map((s) => s.trim()).filter(Boolean);
    this.api.create({ ...this.form, tags, content: this.buildContent() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.title = ''; this.form.description = ''; this.tagsStr.set(''); this.goal.set('');
        this.meta = { topic: '', concept: '', visualType: 'mind_map', audience: '' };
        this.toast.success('Draft created'); this.loadMine();
      },
      error: () => { this.busy.set(false); this.toast.error('Could not create the template — please try again'); },
    });
  }
  submit(t: Template): void { this.api.submit(t.id).subscribe({ next: () => { this.toast.success('Submitted for review'); this.loadMine(); }, error: () => this.toast.error('Could not submit') }); }
  review(t: Template, decision: 'published' | 'rejected'): void {
    this.api.review(t.id, decision).subscribe({ next: () => { this.toast.success(`Template ${decision}`); this.loadPending(); }, error: () => this.toast.error('Could not review') });
  }
}
