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
  standalone: true,
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
            <input class="inp" placeholder="Target role (optional)" [(ngModel)]="form.targetRole" />
          </div>
          <input class="inp mt-2" placeholder="Title" [(ngModel)]="form.title" />
          <textarea class="inp mt-2" rows="2" placeholder="Description" [(ngModel)]="form.description"></textarea>
          <input class="inp mt-2" placeholder="Tags (comma separated)" [ngModel]="tagsStr()" (ngModelChange)="tagsStr.set($event)" />
          <textarea class="inp mt-2" rows="2" placeholder="Starter goal/prompt learners will clone…" [ngModel]="goal()" (ngModelChange)="goal.set($event)"></textarea>
          <div class="mt-3"><asta-btn variant="accent" size="sm" (click)="create()" [disabled]="busy() || !form.title">Create draft</asta-btn></div>
        </asta-card>

        <asta-card class="block motion-card-reveal motion-row-2">
          <p class="kicker mb-3">Your templates</p>
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
          } @else { <p class="text-sm text-txt-mute">No templates yet — create one above.</p> }
        </asta-card>
      </div>

      <div class="space-y-4">
        @if (isAdmin()) {
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-3">Moderation queue</p>
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
            } @else { <asta-empty-state title="Queue clear" description="No templates awaiting review."></asta-empty-state> }
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
  `],
})
export class CreatorStudioComponent {
  private readonly api = inject(MarketplaceService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  readonly mine = signal<Template[]>([]);
  readonly pending = signal<Template[]>([]);
  readonly busy = signal(false);
  readonly tagsStr = signal('');
  readonly goal = signal('');
  readonly isAdmin = computed(() => this.auth.user()?.role === 'admin');
  form = { type: 'flow', title: '', description: '', targetRole: '' };

  constructor() {
    this.loadMine();
    if (this.isAdmin()) this.loadPending();
  }
  loadMine(): void { this.api.mine().subscribe({ next: (t) => this.mine.set(t), error: () => {} }); }
  loadPending(): void { this.api.pending().subscribe({ next: (t) => this.pending.set(t), error: () => {} }); }

  create(): void {
    this.busy.set(true);
    const tags = this.tagsStr().split(',').map((s) => s.trim()).filter(Boolean);
    this.api.create({ ...this.form, tags, content: { goal: this.goal() } }).subscribe({
      next: () => { this.busy.set(false); this.form.title = ''; this.form.description = ''; this.tagsStr.set(''); this.goal.set(''); this.toast.success('Draft created'); this.loadMine(); },
      error: () => { this.busy.set(false); this.toast.error('Could not create'); },
    });
  }
  submit(t: Template): void { this.api.submit(t.id).subscribe({ next: () => { this.toast.success('Submitted for review'); this.loadMine(); }, error: () => this.toast.error('Could not submit') }); }
  review(t: Template, decision: 'published' | 'rejected'): void {
    this.api.review(t.id, decision).subscribe({ next: () => { this.toast.success(`Template ${decision}`); this.loadPending(); }, error: () => this.toast.error('Could not review') });
  }
}
