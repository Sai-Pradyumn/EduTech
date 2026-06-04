import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RingComponent } from '../../shared/ui/ring.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { Application, ApplicationService, JdMatch } from '../../core/services/resume.service';

@Component({
  selector: 'asta-applications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, RingComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Applications</h1>
        <span class="goal-pill"><span class="dot"></span>Paste a job description — Asta matches it to your verified skills</span>
      </div>
    </header>

    <div class="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
      <!-- analyzer -->
      <asta-card class="block motion-card-reveal motion-row-primary">
        <p class="kicker mb-2">Analyze a job description</p>
        <div class="grid grid-cols-2 gap-2">
          <input class="inp" placeholder="Company" [ngModel]="company()" (ngModelChange)="company.set($event)" />
          <input class="inp" placeholder="Role" [ngModel]="role()" (ngModelChange)="role.set($event)" />
        </div>
        <textarea class="inp mt-2" rows="7" placeholder="Paste the job description here…" [ngModel]="jd()" (ngModelChange)="jd.set($event)"></textarea>
        <div class="mt-2 flex gap-2">
          <asta-btn variant="accent" size="sm" (click)="analyze()" [disabled]="busy() || !canSubmit()">{{ busy() ? 'Analyzing…' : 'Analyze match' }}</asta-btn>
          @if (match()) { <asta-btn variant="ghost" size="sm" (click)="save()" [disabled]="busy()">Save to tracker</asta-btn> }
        </div>

        @if (match(); as m) {
          <div class="result mt-4">
            <div class="flex items-center gap-4 flex-wrap">
              <div class="text-center shrink-0"><asta-ring [value]="m.matchScore" [size]="74" /><p class="g-lbl">Match</p></div>
              <div class="min-w-0 flex-1">
                @if (m.matchedSkills.length) { <p class="mb-1"><span class="tag ok">Matched</span> <span class="sk">{{ m.matchedSkills.join(', ') }}</span></p> }
                @if (m.missingSkills.length) { <p><span class="tag miss">Missing</span> <span class="sk">{{ m.missingSkills.join(', ') }}</span></p> }
              </div>
            </div>
            @if (m.tailoredSummary) {
              <div class="cover mt-3"><div class="flex items-center justify-between mb-1"><p class="kicker !mb-0">Tailored summary</p><button class="copy" (click)="copy(m.tailoredSummary)">Copy</button></div><p class="prep !mt-0">{{ m.tailoredSummary }}</p></div>
            }
            <p class="prep"><span class="tag fast">Prep</span> {{ m.prepPlan }}</p>
            <div class="cover"><div class="flex items-center justify-between mb-1"><p class="kicker !mb-0">Tailored cover letter</p><button class="copy" (click)="copy(m.coverLetter)">Copy</button></div><pre class="cl">{{ m.coverLetter }}</pre></div>
          </div>
        }
      </asta-card>

      <!-- tracker -->
      <asta-card class="block motion-card-reveal motion-row-2">
        <p class="kicker mb-3">Application tracker</p>
        @if (loading()) { <asta-skeleton h="120px" /> }
        @else if (apps().length) {
          <div class="ftabs mb-3">
            <button class="ft" [class.on]="filter() === 'all'" (click)="filter.set('all')">All <span class="ct">{{ apps().length }}</span></button>
            @for (s of statuses; track s) {
              @if (counts()[s]) {
                <button class="ft" [class.on]="filter() === s" (click)="filter.set(s)">{{ s }} <span class="ct">{{ counts()[s] }}</span></button>
              }
            }
          </div>
          @if (filteredApps().length) {
            <div class="space-y-2">
              @for (a of filteredApps(); track a.id) {
                <div class="app" [class.open]="expandedId() === a.id">
                  <div class="flex items-center justify-between gap-2 cursor-pointer" (click)="toggle(a.id)">
                    <span class="min-w-0"><span class="a-role">{{ a.role }}</span><span class="a-co">{{ a.company }} · {{ ago(a.createdAt) }}</span></span>
                    <span class="a-score" [style.color]="scoreColor(a.matchScore)">{{ a.matchScore }}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-1.5">
                    <select class="status" [value]="a.status" (click)="$event.stopPropagation()" (change)="setStatus(a, $event)">
                      @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
                    </select>
                    <button class="exp" (click)="toggle(a.id)">{{ expandedId() === a.id ? 'Hide' : 'Details' }}</button>
                    <button class="rm" (click)="remove(a.id)">✕</button>
                  </div>

                  @if (expandedId() === a.id) {
                    <div class="detail">
                      @if (a.matchedSkills.length) { <p class="dline"><span class="tag ok">Matched</span> <span class="sk">{{ a.matchedSkills.join(', ') }}</span></p> }
                      @if (a.missingSkills.length) { <p class="dline"><span class="tag miss">Missing</span> <span class="sk">{{ a.missingSkills.join(', ') }}</span></p> }
                      @if (a.prepPlan) { <p class="dline"><span class="tag fast">Prep</span> <span class="sk">{{ a.prepPlan }}</span></p> }
                      @if (a.tailoredSummary) {
                        <div class="sub"><div class="flex items-center justify-between mb-1"><span class="dlbl">Tailored summary</span><button class="copy" (click)="copy(a.tailoredSummary)">Copy</button></div><p class="sk">{{ a.tailoredSummary }}</p></div>
                      }
                      @if (a.coverLetter) {
                        <div class="sub"><div class="flex items-center justify-between mb-1"><span class="dlbl">Cover letter</span><button class="copy" (click)="copy(a.coverLetter)">Copy</button></div><pre class="cl">{{ a.coverLetter }}</pre></div>
                      }
                      <div class="sub"><span class="dlbl">Notes</span>
                        <textarea class="note" rows="2" placeholder="Add a note (e.g. recruiter contact, deadline)…" [value]="a.notes" (blur)="saveNotes(a, $any($event.target).value)"></textarea>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          } @else { <p class="text-sm text-txt-mute">No {{ filter() }} applications.</p> }
        } @else { <p class="text-sm text-txt-mute">No applications yet — analyze a JD and save it here.</p> }
      </asta-card>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .inp { width: 100%; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 13.5px; font-family: inherit; }
    .result { border-top: 1px solid var(--paper-3); padding-top: 14px; }
    .g-lbl { font-size: 10.5px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; text-align: center; }
    .tag { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 1px 6px; border-radius: 999px; margin-right: 6px; }
    .tag.ok { background: color-mix(in oklab, var(--green) 18%, transparent); color: var(--green-deep); }
    .tag.miss { background: color-mix(in oklab, var(--coral, #ffb454) 18%, transparent); color: var(--coral, #ffb454); }
    .tag.fast { background: color-mix(in oklab, var(--peri, #8aa6ff) 18%, transparent); color: var(--peri, #8aa6ff); }
    .sk { font-size: 12.5px; color: var(--text-soft); }
    .prep { font-size: 12.5px; color: var(--text-soft); margin-top: 10px; line-height: 1.5; }
    .cover { margin-top: 12px; }
    .cl { white-space: pre-wrap; font-family: inherit; font-size: 12.5px; color: var(--text-soft); background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 10px; padding: 10px 12px; max-height: 240px; overflow: auto; }
    .copy { font-size: 11px; color: var(--peri, #8aa6ff); background: transparent; border: none; cursor: pointer; }
    .ftabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .ft { font-size: 11px; text-transform: capitalize; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-mute); cursor: pointer; transition: all .12s; }
    .ft:hover { color: var(--text-soft); }
    .ft.on { background: color-mix(in oklab, var(--peri, #8aa6ff) 16%, transparent); color: var(--peri, #8aa6ff); border-color: color-mix(in oklab, var(--peri, #8aa6ff) 35%, transparent); }
    .ft .ct { font-weight: 700; opacity: .8; }
    .app { padding: 9px 11px; border: 1px solid var(--paper-3); border-radius: 11px; background: var(--paper-2); transition: border-color .12s; }
    .app.open { border-color: color-mix(in oklab, var(--peri, #8aa6ff) 30%, var(--paper-3)); }
    .a-role { display: block; font-size: 13px; font-weight: 600; }
    .a-co { display: block; font-size: 11.5px; color: var(--text-mute); }
    .a-score { font-size: 16px; font-weight: 700; }
    .status { background: var(--paper); border: 1px solid var(--paper-3); color: var(--text); border-radius: 8px; padding: 4px 8px; font-size: 12px; text-transform: capitalize; }
    .exp { font-size: 11px; color: var(--peri, #8aa6ff); background: transparent; border: none; cursor: pointer; }
    .rm { background: transparent; border: none; color: var(--text-mute); cursor: pointer; margin-left: auto; }
    .rm:hover { color: var(--danger, #ff5d5d); }
    .detail { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--paper-3); }
    .dline { font-size: 12px; line-height: 1.5; margin-bottom: 6px; }
    .sub { margin-top: 10px; }
    .dlbl { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-mute); font-weight: 700; }
    .note { width: 100%; margin-top: 4px; padding: 7px 10px; border-radius: 9px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text); font-size: 12.5px; font-family: inherit; resize: vertical; }
  `],
})
export class ApplicationsComponent {
  private readonly api = inject(ApplicationService);
  private readonly toast = inject(ToastService);
  readonly statuses: Application['status'][] = ['saved', 'applied', 'interviewing', 'offer', 'rejected'];
  readonly company = signal('');
  readonly role = signal('');
  readonly jd = signal('');
  readonly match = signal<JdMatch | null>(null);
  readonly apps = signal<Application[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly filter = signal<'all' | Application['status']>('all');
  readonly expandedId = signal<string | null>(null);

  readonly counts = computed(() => {
    const c: Record<string, number> = {};
    for (const a of this.apps()) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  });
  readonly filteredApps = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.apps() : this.apps().filter((a) => a.status === f);
  });

  constructor() { this.api.list().subscribe({ next: (a) => { this.apps.set(a); this.loading.set(false); }, error: () => this.loading.set(false) }); }

  toggle(id: string): void { this.expandedId.set(this.expandedId() === id ? null : id); }
  ago(iso: string): string {
    if (!iso) return '';
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
  }
  saveNotes(a: Application, value: string): void {
    const notes = value.trim();
    if (notes === (a.notes ?? '')) return;
    this.api.update(a.id, { notes }).subscribe({
      next: (u) => this.apps.set(this.apps().map((x) => (x.id === u.id ? u : x))),
      error: () => this.toast.error('Could not save note'),
    });
  }

  canSubmit(): boolean { return this.company().trim().length > 0 && this.role().trim().length > 0 && this.jd().trim().length >= 20; }

  analyze(): void {
    this.busy.set(true);
    this.api.analyze({ company: this.company().trim(), role: this.role().trim(), jdText: this.jd().trim() }).subscribe({
      next: (m) => { this.match.set(m); this.busy.set(false); },
      error: () => { this.busy.set(false); this.toast.error('Analysis failed'); },
    });
  }
  save(): void {
    this.busy.set(true);
    this.api.create({ company: this.company().trim(), role: this.role().trim(), jdText: this.jd().trim() }).subscribe({
      next: (a) => { this.apps.set([a, ...this.apps()]); this.busy.set(false); this.toast.success('Saved to tracker'); },
      error: () => { this.busy.set(false); this.toast.error('Save failed'); },
    });
  }
  setStatus(a: Application, ev: Event): void {
    const status = (ev.target as HTMLSelectElement).value;
    this.api.update(a.id, { status }).subscribe({ next: (u) => this.apps.set(this.apps().map((x) => (x.id === u.id ? u : x))), error: () => this.toast.error('Could not update') });
  }
  remove(id: string): void { this.api.remove(id).subscribe({ next: () => this.apps.set(this.apps().filter((a) => a.id !== id)), error: () => this.toast.error('Could not remove') }); }
  copy(text: string): void { navigator.clipboard?.writeText(text).then(() => this.toast.success('Copied'), () => this.toast.error('Copy failed')); }
  scoreColor(s: number): string { return s >= 70 ? 'var(--green-deep)' : s >= 45 ? 'var(--coral, #ffb454)' : 'var(--danger, #ff5d5d)'; }
}
