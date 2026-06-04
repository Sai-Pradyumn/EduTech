import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { VISUAL_TYPE_META, Visual, VisualService, VisualType } from '../../core/services/visual.service';
import { VisualRendererComponent } from './visual-renderer.component';

@Component({
  selector: 'asta-visual-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent, VisualRendererComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[24px] leading-tight mb-2 grad-flow truncate">{{ visual()?.title || 'Visual' }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ visual() ? meta(visual()!.type).label + ' · ' + visual()!.contentFormat : 'Loading…' }}</span>
      </div>
      <div class="flex gap-2.5 shrink-0 flex-wrap">
        <asta-btn variant="ghost" size="sm" (click)="back()">All visuals</asta-btn>
        @if (visual()) {
          <asta-btn variant="ghost" size="sm" [loading]="regenerating()" (click)="regenerate()">Regenerate</asta-btn>
          <asta-btn variant="ghost" size="sm" (click)="remove()">Delete</asta-btn>
        }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="380px" /></asta-card>
    } @else if (loadError() || !visual()) {
      <asta-card><asta-empty-state title="Could not load this visual" description=""><asta-btn variant="accent" (click)="reload()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else {
      <div class="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
        <asta-card class="block motion-card-reveal motion-row-primary">
          <asta-visual-renderer [visual]="visual()!" />
        </asta-card>

        <asta-card class="block motion-card-reveal motion-row-2">
          <div class="flex items-center justify-between mb-1">
            <p class="kicker !mb-0">Caption</p>
            @if (!editing()) { <button class="edit-link" (click)="startEdit()">Edit</button> }
          </div>
          @if (editing()) {
            <input class="vd-input mb-2" [(ngModel)]="editTitle" placeholder="Title" maxlength="160" aria-label="Title" />
            <textarea class="vd-input" [(ngModel)]="editCaption" rows="3" placeholder="Caption" maxlength="500" aria-label="Caption"></textarea>
            <div class="flex gap-2 mt-2">
              <asta-btn variant="accent" size="sm" [loading]="saving()" (click)="saveEdit()">Save</asta-btn>
              <asta-btn variant="ghost" size="sm" (click)="editing.set(false)">Cancel</asta-btn>
            </div>
          } @else {
            <p class="text-sm">{{ visual()!.caption }}</p>
          }

          @if (visual()!.howToRead) {
            <p class="kicker mt-3 mb-1">How to read this</p>
            <p class="text-sm text-txt-soft">{{ visual()!.howToRead }}</p>
          }

          <div class="flex flex-wrap gap-1.5 my-3 text-[11px] text-txt-mute">
            <span class="meta-pill">{{ meta(visual()!.type).glyph }} {{ meta(visual()!.type).label }}</span>
            <span class="meta-pill">{{ visual()!.level }}</span>
            <span class="meta-pill">{{ visual()!.contentFormat }}</span>
            @if (visual()!.sourceType !== 'manual') { <span class="meta-pill">from {{ visual()!.sourceType }}</span> }
          </div>

          <div class="grid gap-2 mt-2">
            <asta-btn variant="accent" size="sm" (click)="askTutor()">Ask the AI Tutor about this <span class="arr">→</span></asta-btn>
            @if (visual()!.mermaid) {
              <asta-btn variant="ghost" size="sm" (click)="copy(visual()!.mermaid, 'Mermaid copied')">Copy Mermaid</asta-btn>
            }
            <asta-btn variant="ghost" size="sm" (click)="copy(visual()!.content, 'Content copied')">Copy content</asta-btn>
            <asta-btn variant="ghost" size="sm" (click)="download()">Download</asta-btn>
          </div>

          <p class="text-[11px] text-txt-mute mt-3">Provider: {{ visual()!.provider }}</p>
        </asta-card>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .meta-pill { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--paper-3); background: color-mix(in oklab, var(--paper-2) 70%, transparent); }
      .edit-link { font-size: 11px; color: var(--peri, #8aa6ff); background: transparent; border: none; cursor: pointer; }
      .edit-link:hover { color: var(--green-deep); }
      .vd-input { width: 100%; background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 10px; padding: 8px 11px; color: var(--text); font-size: 13.5px; font-family: inherit; }
      .vd-input:focus { outline: none; border-color: var(--green); }
    `,
  ],
})
export class VisualDetailComponent {
  private readonly api = inject(VisualService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly visual = signal<Visual | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly regenerating = signal(false);
  readonly editing = signal(false);
  readonly saving = signal(false);
  editTitle = '';
  editCaption = '';

  constructor() {
    this.reload();
  }

  startEdit(): void {
    const v = this.visual();
    if (!v) return;
    this.editTitle = v.title;
    this.editCaption = v.caption;
    this.editing.set(true);
  }

  saveEdit(): void {
    const v = this.visual();
    if (!v) return;
    const title = this.editTitle.trim();
    const caption = this.editCaption.trim();
    if (!title) { this.toast.error('Title cannot be empty'); return; }
    this.saving.set(true);
    this.api.update(v.id, { title, caption }).subscribe({
      next: (out) => { this.visual.set(out); this.saving.set(false); this.editing.set(false); this.toast.success('Visual updated'); },
      error: () => { this.saving.set(false); this.toast.error('Could not save'); },
    });
  }

  meta(t: VisualType) {
    return VISUAL_TYPE_META[t];
  }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loadError.set(true); this.loading.set(false); return; }
    this.loading.set(true);
    this.loadError.set(false);
    this.api.get(id).subscribe({
      next: (v) => { this.visual.set(v); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  regenerate(): void {
    const v = this.visual();
    if (!v) return;
    this.regenerating.set(true);
    this.api.regenerate(v.id).subscribe({
      next: (out) => { this.visual.set(out); this.regenerating.set(false); this.toast.success('Regenerated'); },
      error: (e: Error) => { this.regenerating.set(false); this.toast.error(e.message || 'Could not regenerate'); },
    });
  }

  remove(): void {
    const v = this.visual();
    if (!v) return;
    this.api.remove(v.id).subscribe({
      next: () => { this.toast.success('Visual deleted'); this.router.navigate(['/app/visuals']); },
      error: () => this.toast.error('Could not delete'),
    });
  }

  askTutor(): void {
    const v = this.visual();
    if (!v) return;
    this.router.navigate(['/app/tutor'], { queryParams: { prompt: `Explain this visual about: ${v.title}` } });
  }

  copy(text: string, msg: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.toast.success(msg),
      () => this.toast.error('Clipboard unavailable'),
    );
  }

  download(): void {
    const v = this.visual();
    if (!v) return;
    const ext = v.contentFormat === 'markdown' ? 'md' : v.contentFormat === 'jsonGraph' ? 'json' : v.contentFormat === 'imageUrl' ? 'svg' : 'txt';
    let data = v.content;
    if (v.contentFormat === 'imageUrl' && v.content.startsWith('data:image/svg+xml')) {
      data = decodeURIComponent(v.content.replace(/^data:image\/svg\+xml;utf8,/, ''));
    }
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${v.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  back(): void {
    this.router.navigate(['/app/visuals']);
  }
}
