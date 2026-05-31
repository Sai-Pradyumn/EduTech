import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { Resume, ResumeService } from '../../core/services/resume.service';

@Component({
  selector: 'asta-resume',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Resume</h1>
        <span class="goal-pill"><span class="dot"></span>An ATS-ready resume generated from your verified evidence</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="accent" size="sm" (click)="generate()" [disabled]="busy()">{{ busy() ? 'Generating…' : 'Generate from evidence' }}</asta-btn>
        @if (r()) { <asta-btn variant="ghost" size="sm" (click)="copyMd()">Copy Markdown</asta-btn> }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="200px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load your resume" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (r()) {
      @if (r(); as rr) {
        @if (!rr.summary && !rr.projects.length) {
          <asta-card class="block"><asta-empty-state title="No resume yet" description="Generate a resume from your Skill Passport, projects and assessments — then fine-tune the wording.">
            <asta-btn variant="accent" (click)="generate()">Generate resume</asta-btn>
          </asta-empty-state></asta-card>
        } @else {
          <div class="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
            <div class="min-w-0 space-y-4">
              <asta-card class="block motion-card-reveal motion-row-primary">
                <p class="kicker mb-1">{{ rr.headline }}</p>
                <label class="lbl">Professional summary</label>
                <textarea class="inp" rows="3" [ngModel]="rr.summary" (ngModelChange)="editSummary($event)"></textarea>
                <div class="mt-2"><asta-btn variant="ghost" size="sm" (click)="saveSummary()" [disabled]="busy()">Save summary</asta-btn></div>
              </asta-card>

              <asta-card class="block motion-card-reveal motion-row-2">
                <p class="kicker mb-2">Highlights</p>
                <ul class="bullets">@for (h of rr.highlights; track h) { <li>{{ h }}</li> }</ul>
              </asta-card>

              <asta-card class="block motion-card-reveal motion-row-3">
                <p class="kicker mb-2">Projects</p>
                @for (pr of rr.projects; track pr.title) {
                  <div class="proj"><p class="proj-title">{{ pr.title }}</p><ul class="bullets">@for (b of pr.bullets; track b) { <li>{{ b }}</li> }</ul></div>
                }
                @if (!rr.projects.length) { <p class="text-sm text-txt-mute">No projects yet — build and review one to add resume bullets.</p> }
              </asta-card>
            </div>

            <div class="space-y-4">
              <asta-card class="block motion-card-reveal motion-row-2">
                <p class="kicker mb-2">Skills</p>
                <div class="flex flex-wrap gap-1.5">@for (s of rr.skills; track s) { <span class="chip">{{ s }}</span> }</div>
              </asta-card>
              <asta-card class="block motion-card-reveal motion-row-3">
                <p class="kicker mb-2">Apply it</p>
                <p class="text-sm text-txt-soft mb-2">Paste a job description to tailor this resume and get a match score.</p>
                <asta-btn variant="accent" size="sm" class="w-full" (click)="go('/app/applications')">Open Applications →</asta-btn>
              </asta-card>
            </div>
          </div>
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .lbl { display: block; font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; margin: 4px 0; }
    .inp { width: 100%; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 14px; font-family: inherit; }
    .bullets { list-style: disc; padding-left: 18px; font-size: 13px; color: var(--text-soft); display: flex; flex-direction: column; gap: 4px; }
    .proj { margin-bottom: 12px; }
    .proj-title { font-size: 13.5px; font-weight: 600; margin-bottom: 3px; }
    .chip { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); color: var(--green-deep); }
  `],
})
export class ResumeComponent {
  private readonly api = inject(ResumeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly r = signal<Resume | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal(false);
  private summaryBuf = '';

  constructor() { this.refresh(); }
  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.me().subscribe({ next: (r) => { this.r.set(r); this.summaryBuf = r.summary; this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  generate(): void {
    this.busy.set(true);
    this.api.generate().subscribe({ next: (r) => { this.r.set(r); this.summaryBuf = r.summary; this.busy.set(false); this.toast.success('Resume generated'); }, error: () => { this.busy.set(false); this.toast.error('Generate failed'); } });
  }
  editSummary(v: string): void { this.summaryBuf = v; const cur = this.r(); if (cur) this.r.set({ ...cur, summary: v }); }
  saveSummary(): void {
    this.busy.set(true);
    this.api.patch({ summary: this.summaryBuf }).subscribe({ next: (r) => { this.r.set(r); this.busy.set(false); this.toast.success('Saved'); }, error: () => { this.busy.set(false); this.toast.error('Save failed'); } });
  }
  copyMd(): void {
    const rr = this.r(); if (!rr) return;
    const md = [
      `# ${rr.headline}`, '', rr.summary, '',
      '## Skills', rr.skills.join(' · '), '',
      '## Highlights', ...rr.highlights.map((h) => `- ${h}`), '',
      '## Projects', ...rr.projects.flatMap((p) => [`### ${p.title}`, ...p.bullets.map((b) => `- ${b}`)]),
    ].join('\n');
    navigator.clipboard?.writeText(md).then(() => this.toast.success('Markdown copied'), () => this.toast.error('Copy failed'));
  }
  go(route: string): void { this.router.navigate([route]); }
}
