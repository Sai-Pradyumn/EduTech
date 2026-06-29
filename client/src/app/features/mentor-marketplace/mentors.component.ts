import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { Mentor, MentorMarketplaceService, MentorProfileInput, MentorSession } from '../../core/services/mentor-marketplace.service';

@Component({
    selector: 'asta-mentors',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Mentors</h1>
        <span class="goal-pill"><span class="dot"></span>Find a mentor for a project, interview or portfolio review</span>
      </div>
      <div class="flex gap-2 shrink-0">
        <asta-btn [variant]="tab() === 'browse' ? 'accent' : 'ghost'" size="sm" (click)="tab.set('browse')">Browse</asta-btn>
        <asta-btn [variant]="tab() === 'sessions' ? 'accent' : 'ghost'" size="sm" (click)="loadSessions()">Sessions</asta-btn>
        <asta-btn [variant]="tab() === 'profile' ? 'accent' : 'ghost'" size="sm" (click)="loadProfile()">Become a mentor</asta-btn>
      </div>
    </header>

    @if (tab() === 'browse') {
      @if (loading()) { <div class="grid gap-3 sm:grid-cols-2">@for (i of [1,2,3,4]; track i) { <asta-card><asta-skeleton h="140px" /></asta-card> }</div> }
      @else if (mentors().length) {
        <div class="toolbar mb-4">
          <input class="inp" style="flex:1 1 220px;margin:0" [ngModel]="mentorQuery()" (ngModelChange)="mentorQuery.set($event)" placeholder="Search mentors — name, skill, headline…" aria-label="Search mentors" />
          <div class="seg">
            <button class="seg-b" [class.on]="pricing() === 'all'" (click)="pricing.set('all')">All</button>
            <button class="seg-b" [class.on]="pricing() === 'free'" (click)="pricing.set('free')">Free</button>
            <button class="seg-b" [class.on]="pricing() === 'paid'" (click)="pricing.set('paid')">Paid</button>
          </div>
          <span class="tb-count">{{ filteredMentors().length }} of {{ mentors().length }}</span>
        </div>
        @if (filteredMentors().length === 0) {
          <asta-card><asta-empty-state title="No matches" description="No mentors match your search or filter."><asta-btn variant="ghost" (click)="clearMentorFilters()">Clear filters</asta-btn></asta-empty-state></asta-card>
        } @else {
        <div class="grid gap-3 sm:grid-cols-2 motion-row-2">
          @for (m of filteredMentors(); track m.id) {
            <asta-card class="block motion-card-reveal">
              <div class="flex items-start gap-3">
                <span class="avatar">{{ m.name[0] }}</span>
                <div class="min-w-0 flex-1">
                  <p class="m-name">{{ m.name }}</p>
                  <p class="m-head">{{ m.headline }}</p>
                </div>
                <span class="price" [class.free]="m.pricingMode === 'free'">{{ m.pricingMode === 'free' ? 'Free' : 'Paid' }}</span>
              </div>
              <div class="flex flex-wrap gap-1 mt-2">@for (e of m.expertise.slice(0,5); track e) { <span class="chip">{{ e }}</span> }</div>
              <p class="m-bio">{{ m.bio }}</p>
              <div class="flex items-center gap-2 mt-2">
                <select class="sel" [(ngModel)]="reqType">
                  <option value="project_review">Project review</option>
                  <option value="interview_review">Interview review</option>
                  <option value="portfolio_review">Portfolio review</option>
                  <option value="roadmap_review">Roadmap review</option>
                  <option value="general">General</option>
                </select>
                <asta-btn variant="accent" size="sm" (click)="request(m)" [disabled]="busy()">Request</asta-btn>
              </div>
            </asta-card>
          }
        </div>
        }
      } @else { <asta-card><asta-empty-state title="No mentors yet" description="Mentors will appear here as they publish profiles. Want to help others? Become a mentor."></asta-empty-state></asta-card> }
    }

    @if (tab() === 'sessions') {
      @if (loading()) { <asta-card><asta-skeleton h="160px" /></asta-card> }
      @else if (sessions().length) {
        <div class="space-y-2">
          @for (s of sessions(); track s.id) {
            <asta-card class="block motion-card-reveal">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="min-w-0">
                  <p class="s-title">{{ label(s.type) }} · {{ s.role === 'student' ? 'with ' + s.counterpartName : s.counterpartName }}</p>
                  @if (s.message) { <p class="s-msg">{{ s.message }}</p> }
                  @if (s.notes) { <p class="s-notes"><b>Mentor notes:</b> {{ s.notes }}</p> }
                </div>
                <div class="flex items-center gap-2">
                  <span class="status" [attr.data-s]="s.status">{{ s.status }}</span>
                  @if (s.role === 'mentor' && s.status === 'requested') { <asta-btn size="sm" variant="accent" (click)="setStatus(s, 'accepted')">Accept</asta-btn> }
                  @if (s.role === 'mentor' && s.status === 'accepted') { <asta-btn size="sm" variant="accent" (click)="setStatus(s, 'completed')">Complete</asta-btn> }
                  @if (s.role === 'student' && (s.status === 'requested' || s.status === 'accepted')) { <asta-btn size="sm" variant="ghost" (click)="setStatus(s, 'cancelled')">Cancel</asta-btn> }
                </div>
              </div>
            </asta-card>
          }
        </div>
      } @else { <asta-card><asta-empty-state title="No sessions yet" description="Request a review from a mentor to get started."></asta-empty-state></asta-card> }
    }

    @if (tab() === 'profile') {
      <asta-card class="block motion-card-reveal">
        <p class="kicker mb-2">Your mentor profile</p>
        <label for="mp-headline" class="lbl">Headline</label>
        <input id="mp-headline" class="inp" [(ngModel)]="prof.headline" placeholder="e.g. Senior Full-Stack Engineer · 6 yrs" />
        <label for="mp-expertise" class="lbl">Expertise (comma separated)</label>
        <input id="mp-expertise" class="inp" [ngModel]="expertiseStr()" (ngModelChange)="expertiseStr.set($event)" placeholder="React, Node, System Design" />
        <label for="mp-bio" class="lbl">Bio</label>
        <textarea id="mp-bio" class="inp" rows="3" [(ngModel)]="prof.bio"></textarea>
        <label for="mp-availability" class="lbl">Availability</label>
        <input id="mp-availability" class="inp" [(ngModel)]="prof.availability" placeholder="Weekends, async reviews" />
        <div class="mt-3"><asta-btn variant="accent" size="sm" (click)="saveProfile()" [disabled]="busy() || !prof.headline">Save profile</asta-btn></div>
      </asta-card>
    }
  `,
    styles: [`
    :host { display: block; }
    .avatar { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, var(--green-deep), var(--green)); color: var(--ink); font-size: 18px; font-weight: 700; flex-shrink: 0; box-shadow: 0 6px 18px var(--asta-accent-glow); transition: transform .35s var(--ease-spring); }
    asta-card:hover .avatar { transform: scale(1.1) rotate(-4deg); }
    .m-name { font-size: 14.5px; font-weight: 600; }
    .m-head { font-size: 12.5px; color: var(--text-soft); }
    .m-bio { font-size: 12.5px; color: var(--text-soft); margin-top: 8px; }
    .price { font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: var(--paper-3); color: var(--text-mute); }
    .price.free { background: color-mix(in oklab, var(--green) 18%, transparent); color: var(--green-deep); }
    .chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--paper-3); color: var(--text-soft); }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .seg { display: inline-flex; border: 1px solid var(--paper-3); border-radius: 9px; overflow: hidden; }
    .seg-b { font-size: 12px; padding: 7px 13px; background: var(--paper-2); color: var(--text-mute); border: none; cursor: pointer; transition: all .12s; }
    .seg-b:not(:last-child) { border-right: 1px solid var(--paper-3); }
    .seg-b.on { background: color-mix(in oklab, var(--green) 16%, transparent); color: var(--green-deep); }
    .tb-count { font-size: 12px; color: var(--text-mute); margin-left: auto; white-space: nowrap; }
    .sel, .inp { background: var(--paper-2); border: 1px solid var(--paper-3); color: var(--text); border-radius: 9px; padding: 7px 10px; font-size: 13px; font-family: inherit; }
    .sel { flex: 1; }
    .inp { width: 100%; margin-bottom: 2px; }
    .lbl { display: block; font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: .04em; margin: 8px 0 4px; }
    .s-title { font-size: 13.5px; font-weight: 600; }
    .s-msg { font-size: 12.5px; color: var(--text-soft); margin-top: 2px; }
    .s-notes { font-size: 12px; color: var(--text-mute); margin-top: 4px; }
    .status { font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: var(--paper-3); color: var(--text-mute); }
    .status[data-s="completed"] { background: color-mix(in oklab, var(--green) 20%, transparent); color: var(--green-deep); }
    .status[data-s="accepted"] { background: color-mix(in oklab, var(--peri, #8aa6ff) 20%, transparent); color: var(--peri, #8aa6ff); }
  `]
})
export class MentorsComponent {
  private readonly api = inject(MentorMarketplaceService);
  private readonly toast = inject(ToastService);
  readonly tab = signal<'browse' | 'sessions' | 'profile'>('browse');
  readonly mentors = signal<Mentor[]>([]);
  readonly sessions = signal<MentorSession[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly expertiseStr = signal('');
  readonly mentorQuery = signal('');
  readonly pricing = signal<'all' | 'free' | 'paid'>('all');
  readonly filteredMentors = computed(() => {
    const q = this.mentorQuery().trim().toLowerCase();
    const p = this.pricing();
    let out = this.mentors();
    if (p !== 'all') out = out.filter((m) => m.pricingMode === p);
    if (q) out = out.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.headline.toLowerCase().includes(q) ||
      m.bio.toLowerCase().includes(q) ||
      m.expertise.some((e) => e.toLowerCase().includes(q)),
    );
    return out;
  });
  clearMentorFilters(): void { this.mentorQuery.set(''); this.pricing.set('all'); }
  reqType = 'project_review';
  prof: MentorProfileInput = { headline: '', bio: '', availability: '' };

  constructor() {
    this.api.list().subscribe({ next: (m) => { this.mentors.set(m); this.loading.set(false); }, error: () => this.loading.set(false) });
    // Deep-link: /app/mentor-sessions opens the Sessions tab directly.
    if (inject(Router).url.includes('mentor-sessions')) this.loadSessions();
  }

  loadSessions(): void {
    this.tab.set('sessions'); this.loading.set(true);
    this.api.sessions().subscribe({ next: (s) => { this.sessions.set(s); this.loading.set(false); }, error: () => this.loading.set(false) });
  }
  loadProfile(): void {
    this.tab.set('profile');
    this.api.myProfile().subscribe({ next: (p) => { if (p) { this.prof = p; this.expertiseStr.set((p.expertise ?? []).join(', ')); } }, error: () => {} });
  }
  request(m: Mentor): void {
    this.busy.set(true);
    this.api.requestSession({ mentorId: m.id, type: this.reqType }).subscribe({
      next: () => { this.busy.set(false); this.toast.success(`Requested a ${this.label(this.reqType)} from ${m.name}`); },
      error: () => { this.busy.set(false); this.toast.error('Could not request'); },
    });
  }
  setStatus(s: MentorSession, status: string): void {
    this.api.setStatus(s.id, status).subscribe({ next: () => { this.toast.success(`Session ${status}`); this.loadSessions(); }, error: () => this.toast.error('Could not update') });
  }
  saveProfile(): void {
    this.busy.set(true);
    const expertise = this.expertiseStr().split(',').map((s) => s.trim()).filter(Boolean);
    this.api.saveProfile({ ...this.prof, expertise }).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Mentor profile saved'); },
      error: () => { this.busy.set(false); this.toast.error('Could not save'); },
    });
  }
  label(t: string): string { return t.replace(/_/g, ' '); }
}
