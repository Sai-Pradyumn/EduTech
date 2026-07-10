import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgentService } from '../../core/services/agent.service';
import { AgentSessionSummary, SessionSearchHit } from '../../core/models';

/**
 * Session control: start a fresh session ("new") or reopen a past one. A compact
 * popover (not a ChatGPT-style sidebar) — keeps Asta OS feeling like a workspace,
 * not a chat log. Lazy-loads sessions when opened. Typing 2+ characters switches
 * the list to a cross-session search (titles + message content, server-side);
 * the star pins a session to the top of every history list.
 */
@Component({
  selector: 'asta-os-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <button type="button" class="icon" (click)="newSession.emit()" title="New session" aria-label="New session">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" class="icon" [class.on]="open()" (click)="toggle()" [attr.aria-expanded]="open()" title="History" aria-label="Session history">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" /></svg>
      </button>

      @if (open()) {
        <div class="pop" role="menu">
          <input class="find" [(ngModel)]="q" (ngModelChange)="onQuery($event)" placeholder="Search all sessions…" aria-label="Search all past sessions" />

          @if (q.trim().length >= 2) {
            <p class="kick">Matches everywhere</p>
            @if (searching()) {
              <p class="muted">Searching…</p>
            } @else if (searchError()) {
              <p class="muted">Search failed — <button type="button" class="lnk" (click)="onQuery(q)">Retry</button></p>
            } @else if (hits().length) {
              @for (h of hits(); track h.sessionId) {
                <button type="button" class="item" role="menuitem" (click)="pick(h.sessionId)">
                  <span class="dot" aria-hidden="true"></span>
                  <span class="meta">
                    <span class="title">{{ h.title }}</span>
                    @if (h.snippet) { <span class="snip">{{ h.snippet }}</span> }
                    <span class="when">{{ h.agentType }}{{ h.when ? ' · ' + rel(h.when) : '' }}</span>
                  </span>
                </button>
              }
            } @else {
              <p class="muted">No matches in any session.</p>
            }
          } @else {
            <p class="kick">Recent sessions</p>
            @if (loading()) {
              <p class="muted">Loading…</p>
            } @else {
              <!-- Stale sessions stay listed under the error note; only hide the list when there is nothing to show. -->
              @if (loadError()) {
                <p class="muted">Couldn't load sessions — <button type="button" class="lnk" (click)="refresh()">Retry</button></p>
              }
              @if (sessions().length) {
              @for (s of sessions(); track s.id) {
                <div class="row">
                  <button type="button" class="item" role="menuitem" (click)="pick(s.id)">
                    <span class="dot" aria-hidden="true"></span>
                    <span class="meta"><span class="title">{{ s.title || 'Untitled session' }}</span><span class="when">{{ s.agentType }}{{ s.lastMessageAt ? ' · ' + rel(s.lastMessageAt) : '' }}</span></span>
                  </button>
                  <button type="button" class="pin" [class.on]="s.pinned" (click)="togglePin(s)"
                    [attr.aria-label]="s.pinned ? 'Unpin session' : 'Pin session to top'"
                    [title]="s.pinned ? 'Unpin' : 'Pin to top'">
                    <svg viewBox="0 0 24 24" width="14" height="14" [attr.fill]="s.pinned ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 7.1-1.01z"/></svg>
                  </button>
                </div>
              }
            } @else {
              <p class="muted">No past sessions yet.</p>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .wrap { position: relative; display: inline-flex; gap: 4px; }
      .icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--asta-muted); border: 1px solid var(--asta-border); background: var(--asta-panel); transition: color .16s ease, background .16s ease, transform .12s ease; }
      .icon:hover { color: var(--asta-text); transform: translateY(-1px); }
      .icon.on { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }

      .pop { position: absolute; top: calc(100% + 8px); right: 0; z-index: 70; width: 320px; max-height: 420px; overflow-y: auto; padding: 8px; border-radius: 14px; background: var(--asta-bg-elevated); border: 1px solid var(--asta-border); box-shadow: 0 24px 60px rgba(0,0,0,.5); backdrop-filter: blur(14px); animation: pop .16s ease; }
      @keyframes pop { from { opacity: 0; transform: translateY(-6px); } }
      @media (prefers-reduced-motion: reduce) { .pop { animation: none; } }
      .find { width: 100%; margin-bottom: 6px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--asta-border); background: var(--asta-panel); color: var(--asta-text); font-size: 13px; outline: none; }
      .find:focus { border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); }
      .kick { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-subtle); padding: 4px 8px 8px; }
      .muted { font-size: 13px; color: var(--asta-muted); padding: 6px 8px; }
      .row { display: flex; align-items: center; gap: 2px; }
      .row .item { flex: 1; min-width: 0; }
      .item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 10px; text-align: left; color: var(--asta-muted); transition: background .14s ease, color .14s ease; }
      .item:hover { background: var(--asta-panel); color: var(--asta-text); }
      .pin { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--asta-subtle); flex-shrink: 0; transition: color .14s ease, background .14s ease; }
      .pin:hover { color: var(--asta-text); background: var(--asta-panel); }
      .pin.on { color: var(--asta-green); }
      .dot { width: 7px; height: 7px; border-radius: 999px; background: var(--asta-green); flex-shrink: 0; }
      .meta { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
      .title { font-size: 13px; font-weight: 600; color: var(--asta-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .snip { font-size: 11.5px; color: var(--asta-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .when { font-size: 11px; color: var(--asta-subtle); text-transform: capitalize; }
    `,
  ],
})
export class AstaOsHistoryComponent {
  private readonly agent = inject(AgentService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly select = output<string>();
  readonly newSession = output<void>();

  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly sessions = signal<AgentSessionSummary[]>([]);

  // ── Cross-session search ──
  protected q = '';
  protected readonly hits = signal<SessionSearchHit[]>([]);
  protected readonly searching = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) this.refresh();
  }

  protected pick(id: string): void {
    this.open.set(false);
    this.select.emit(id);
  }

  protected onQuery(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const query = value.trim();
    if (query.length < 2) {
      this.hits.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchTimer = setTimeout(() => {
      this.agent
        .searchSessions(query)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (h) => {
            if (this.q.trim() === query) this.hits.set(h);
            this.searching.set(false);
          },
          error: () => this.searching.set(false),
        });
    }, 250);
  }

  /** Optimistic: flip + re-sort locally, revert if the server declines. */
  protected togglePin(s: AgentSessionSummary): void {
    const next = !s.pinned;
    const resort = (list: AgentSessionSummary[]): AgentSessionSummary[] =>
      [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    this.sessions.update((list) =>
      resort(list.map((x) => (x.id === s.id ? { ...x, pinned: next } : x))),
    );
    this.agent
      .pinSession(s.id, next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () =>
          this.sessions.update((list) =>
            resort(list.map((x) => (x.id === s.id ? { ...x, pinned: !next } : x))),
          ),
      });
  }

  private refresh(): void {
    this.loading.set(true);
    this.agent
      .listSessions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => { this.sessions.set(s); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  protected rel(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
