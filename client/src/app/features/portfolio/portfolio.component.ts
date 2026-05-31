import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { Portfolio, PortfolioService } from '../../core/services/portfolio.service';

@Component({
  selector: 'asta-portfolio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Portfolio</h1>
        <span class="goal-pill"><span class="dot"></span>A public portfolio built from your verified evidence</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="generate()" [disabled]="busy()">{{ busy() ? 'Generating…' : 'Generate from evidence' }}</asta-btn>
        @if (p(); as pp) {
          @if (pp.status === 'published') {
            <asta-btn variant="ghost" size="sm" (click)="copyLink()">Copy link</asta-btn>
            <asta-btn variant="ghost" size="sm" (click)="setStatus(false)" [disabled]="busy()">Unpublish</asta-btn>
          } @else {
            <asta-btn variant="accent" size="sm" (click)="setStatus(true)" [disabled]="busy()">Publish</asta-btn>
          }
        }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="120px" /></asta-card>
      <asta-card class="mt-3"><asta-skeleton h="220px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load your portfolio" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (p()) {
      @if (p(); as pp) {
        <div class="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
          <div class="min-w-0 space-y-4">
            <asta-card class="block motion-card-reveal motion-row-primary">
              <p class="kicker mb-2">Profile</p>
              <label class="lbl">Title</label>
              <input class="inp" [ngModel]="pp.title" (ngModelChange)="edit('title', $event)" />
              <label class="lbl">Tagline</label>
              <input class="inp" [ngModel]="pp.tagline" (ngModelChange)="edit('tagline', $event)" />
              <label class="lbl">About</label>
              <textarea class="inp" rows="4" [ngModel]="pp.about" (ngModelChange)="edit('about', $event)"></textarea>
              <div class="flex flex-wrap gap-1.5 mt-2">@for (s of pp.skills; track s) { <span class="chip">{{ s }}</span> }</div>
              <div class="mt-3"><asta-btn variant="ghost" size="sm" (click)="save()" [disabled]="busy()">Save changes</asta-btn></div>
            </asta-card>

            <asta-card class="block motion-card-reveal motion-row-2">
              <p class="kicker mb-3">Projects ({{ pp.projects.length }})</p>
              @if (pp.projects.length) {
                <div class="space-y-2.5">
                  @for (pr of pp.projects; track pr.projectId) {
                    <div class="proj">
                      <div class="flex items-center justify-between gap-2"><span class="proj-title">{{ pr.title }}</span><div class="flex flex-wrap gap-1">@for (t of pr.stack.slice(0,4); track t) { <span class="tech">{{ t }}</span> }</div></div>
                      <p class="proj-cs">{{ pr.caseStudy }}</p>
                      <div class="flex gap-2 mt-1 text-[11px]">@if (pr.githubUrl) { <a [href]="pr.githubUrl" target="_blank" rel="noopener" class="lnk">repo</a> }@if (pr.demoUrl) { <a [href]="pr.demoUrl" target="_blank" rel="noopener" class="lnk">demo</a> }</div>
                    </div>
                  }
                </div>
              } @else { <p class="text-sm text-txt-mute">No projects yet — generate from evidence, or add reviewed projects from your Skill Passport.</p> }
            </asta-card>
          </div>

          <div class="space-y-4">
            <asta-card class="block motion-card-reveal motion-row-2">
              <p class="kicker mb-2">Visibility</p>
              <span class="vis-badge" [class.pub]="pp.status === 'published'">{{ pp.status === 'published' ? 'Published' : 'Draft' }}</span>
              <p class="text-[11px] text-txt-mute mt-2 break-all">Public link: /p/{{ pp.username }}</p>
              <div class="mt-3 space-y-1">
                <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.showProjects" (change)="setting('showProjects', $event)"> Show projects</label>
                <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.showCertificates" (change)="setting('showCertificates', $event)"> Show certificates</label>
                <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.showTimeline" (change)="setting('showTimeline', $event)"> Show timeline</label>
                <label class="tog"><input type="checkbox" [checked]="pp.publicSettings.showContact" (change)="setting('showContact', $event)"> Show contact links</label>
              </div>
            </asta-card>
            <asta-card class="block motion-card-reveal motion-row-3">
              <p class="kicker mb-2">Tip</p>
              <p class="text-sm text-txt-soft">Review projects in Project Studio, add them to your Skill Passport, then "Generate from evidence" to refresh your portfolio with AI-written case studies.</p>
            </asta-card>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .lbl { display: block; font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; margin: 8px 0 4px; }
    .inp { width: 100%; padding: 8px 11px; border-radius: 9px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 13.5px; font-family: inherit; }
    .chip { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--green) 40%, var(--paper-3)); color: var(--green-deep); }
    .proj { padding: 10px 12px; border: 1px solid var(--paper-3); border-radius: 12px; background: var(--paper-2); }
    .proj-title { font-size: 13.5px; font-weight: 600; }
    .proj-cs { font-size: 12.5px; color: var(--text-soft); margin-top: 4px; }
    .tech { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: var(--paper-3); color: var(--text-soft); }
    .lnk { color: var(--peri, #8aa6ff); }
    .vis-badge { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 3px 9px; border-radius: 999px; background: var(--paper-3); color: var(--text-mute); }
    .vis-badge.pub { background: color-mix(in oklab, var(--green) 20%, transparent); color: var(--green-deep); }
    .tog { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
  `],
})
export class PortfolioComponent {
  private readonly api = inject(PortfolioService);
  private readonly toast = inject(ToastService);
  readonly p = signal<Portfolio | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly busy = signal(false);
  private patchBuf: Partial<Portfolio> = {};

  constructor() { this.refresh(); }

  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.me().subscribe({ next: (p) => { this.p.set(p); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  edit(key: keyof Portfolio, val: string): void {
    const cur = this.p(); if (!cur) return;
    this.p.set({ ...cur, [key]: val } as Portfolio);
    this.patchBuf = { ...this.patchBuf, [key]: val };
  }
  save(): void {
    if (!Object.keys(this.patchBuf).length) return;
    this.busy.set(true);
    this.api.patch(this.patchBuf).subscribe({ next: (p) => { this.p.set(p); this.patchBuf = {}; this.busy.set(false); this.toast.success('Saved'); }, error: () => { this.busy.set(false); this.toast.error('Save failed'); } });
  }
  setting(key: string, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    this.api.patch({ publicSettings: { [key]: checked } as Portfolio['publicSettings'] }).subscribe({ next: (p) => this.p.set(p), error: () => this.toast.error('Could not save') });
  }
  generate(): void {
    this.busy.set(true);
    this.api.generate().subscribe({ next: (p) => { this.p.set(p); this.busy.set(false); this.toast.success('Portfolio generated'); }, error: () => { this.busy.set(false); this.toast.error('Generate failed'); } });
  }
  setStatus(publish: boolean): void {
    this.busy.set(true);
    const obs = publish ? this.api.publish() : this.api.unpublish();
    obs.subscribe({ next: (p) => { this.p.set(p); this.busy.set(false); this.toast.success(publish ? 'Published' : 'Unpublished'); }, error: () => { this.busy.set(false); this.toast.error('Failed'); } });
  }
  copyLink(): void {
    const pp = this.p(); if (!pp) return;
    navigator.clipboard?.writeText(`${location.origin}/p/${pp.username}`).then(() => this.toast.success('Link copied'), () => this.toast.error('Copy failed'));
  }
}
