import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { NotificationService, NotificationView } from '../../core/services/notification.service';

/**
 * Full notification history (`/app/notifications`). The topbar bell shows only the
 * latest 30; this page fetches more, filters by type + read state, and supports
 * mark-read / mark-all-read. Read-only data via NotificationService.
 */
@Component({
  selector: 'asta-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Notifications</h1>
        <span class="goal-pill"><span class="dot"></span>Your full activity feed — progression, nudges, sessions &amp; announcements</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        @if (unreadCount() > 0) { <asta-btn variant="ghost" size="sm" (click)="markAll()">Mark all read</asta-btn> }
        <asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn>
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="220px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load notifications" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (all().length === 0) {
      <asta-card class="block"><asta-empty-state title="No notifications yet" description="As you learn, Asta posts progression updates, nudges, session reminders and announcements here." /></asta-card>
    } @else {
      <!-- filters -->
      <div class="nt-filters mb-3">
        <button class="nt-chip" [class.on]="typeFilter() === 'all'" (click)="typeFilter.set('all')">All <span class="ct">{{ all().length }}</span></button>
        @for (t of typesPresent(); track t) {
          <button class="nt-chip" [class.on]="typeFilter() === t" (click)="typeFilter.set(t)">{{ glyph(t) }} {{ label(t) }} <span class="ct">{{ typeCount(t) }}</span></button>
        }
        <span class="nt-sep"></span>
        <button class="nt-chip" [class.on]="unreadOnly()" (click)="unreadOnly.set(!unreadOnly())">Unread only @if (unreadCount() > 0) { <span class="ct">{{ unreadCount() }}</span> }</button>
      </div>

      @if (visible().length === 0) {
        <asta-card class="block"><p class="text-sm text-txt-mute py-4 text-center">No notifications match this filter.</p></asta-card>
      } @else {
        <asta-card class="block" [padded]="false">
          <div class="nt-list">
            @for (n of visible(); track n.id) {
              <button class="nt-row" [class.unread]="!n.read" (click)="open(n)">
                <span class="nt-glyph" aria-hidden="true">{{ glyph(n.type) }}</span>
                <span class="min-w-0 flex-1">
                  <span class="nt-title">
                    @if (!n.read) { <span class="nt-dot" aria-label="unread"></span> }
                    {{ n.title }}
                  </span>
                  @if (n.body) { <span class="nt-body">{{ n.body }}</span> }
                  @if (n.link) { <span class="nt-open">Open →</span> }
                </span>
                <span class="nt-time">{{ ago(n.createdAt) }}</span>
              </button>
            }
          </div>
        </asta-card>
        <p class="nt-count">{{ visible().length }} of {{ all().length }} shown</p>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .nt-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .nt-chip { font-size: 12px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text-mute); cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
    .nt-chip:hover { color: var(--text-soft); }
    .nt-chip.on { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); background: color-mix(in oklab, var(--green) 12%, transparent); }
    .nt-chip .ct { font-weight: 700; opacity: .75; }
    .nt-sep { width: 1px; height: 18px; background: var(--paper-3); margin: 0 4px; }
    .nt-list { display: flex; flex-direction: column; }
    .nt-row { display: flex; gap: 12px; align-items: flex-start; text-align: left; width: 100%; padding: 12px 16px; border-bottom: 1px solid var(--paper-2); background: transparent; cursor: pointer; transition: background .15s, transform .15s var(--ease); animation: astaRevealUp .4s var(--ease) both; }
    .nt-row:nth-child(2) { animation-delay: .04s; }
    .nt-row:nth-child(3) { animation-delay: .08s; }
    .nt-row:nth-child(4) { animation-delay: .12s; }
    .nt-row:nth-child(5) { animation-delay: .16s; }
    .nt-row:nth-child(6) { animation-delay: .2s; }
    .nt-row:last-child { border-bottom: none; }
    .nt-row:hover { background: color-mix(in oklab, var(--green) 5%, transparent); transform: translateX(3px); }
    .nt-row.unread { background: color-mix(in oklab, var(--green) 6%, transparent); }
    .nt-glyph { font-size: 14px; flex-shrink: 0; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: color-mix(in oklch, var(--green) 11%, transparent); transition: transform .3s var(--ease-spring); }
    .nt-row:hover .nt-glyph { transform: scale(1.12) rotate(-6deg); }
    .nt-title { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 600; color: var(--text); }
    .nt-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); flex-shrink: 0; box-shadow: 0 0 8px var(--asta-accent-glow); animation: astaPulse 2.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .nt-row, .nt-dot { animation: none; } .nt-row:hover { transform: none; } }
    .nt-body { display: block; font-size: 12.5px; color: var(--text-mute); margin-top: 2px; }
    .nt-open { display: inline-block; font-size: 11.5px; font-weight: 600; color: var(--green-deep); margin-top: 3px; }
    .nt-time { font-size: 11px; font-family: var(--mono); color: var(--text-mute); flex-shrink: 0; }
    .nt-count { font-size: 11px; font-family: var(--mono); color: var(--text-mute); margin-top: 10px; }
  `],
})
export class NotificationsComponent implements OnInit {
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  readonly all = signal<NotificationView[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly typeFilter = signal<string>('all');
  readonly unreadOnly = signal(false);

  private readonly typeGlyphs: Record<string, string> = {
    progression: '📈', nudge: '💡', announcement: '📣', session: '🎥', info: '🔔',
  };
  private readonly typeLabels: Record<string, string> = {
    progression: 'Progression', nudge: 'Nudges', announcement: 'Announcements', session: 'Sessions', info: 'Info',
  };

  readonly unreadCount = computed(() => this.all().filter((n) => !n.read).length);
  readonly typesPresent = computed(() =>
    [...new Set(this.all().map((n) => n.type))].sort((a, b) => a.localeCompare(b)),
  );
  readonly visible = computed(() => {
    const t = this.typeFilter();
    const unread = this.unreadOnly();
    return this.all().filter((n) => {
      if (t !== 'all' && n.type !== t) return false;
      if (unread && n.read) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.notify.fetch(200).subscribe({
      next: (res) => { this.all.set(res.items); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  glyph(type: string): string { return this.typeGlyphs[type] ?? '🔔'; }
  label(type: string): string { return this.typeLabels[type] ?? type; }
  typeCount(type: string): number { return this.all().filter((n) => n.type === type).length; }

  /** Mark read (locally + on the bell) and follow any deep link. */
  open(n: NotificationView): void {
    if (!n.read) {
      this.all.update((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      this.notify.markRead(n.id);
    }
    if (n.link) void this.router.navigateByUrl(n.link);
  }

  markAll(): void {
    this.all.update((list) => list.map((n) => ({ ...n, read: true })));
    this.notify.markAllRead();
  }

  ago(iso: string): string {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
  }
}
