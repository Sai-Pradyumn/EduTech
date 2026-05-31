import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NetworkStatusService } from '../../core/services/network-status.service';
import { OfflineService, OfflineDraft, OfflineResource } from '../../core/services/offline.service';
import { SyncQueueService } from '../../core/services/sync-queue.service';
import { WebPushService } from '../../core/services/web-push.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { ToastService } from '../../core/services/toast.service';

/** Offline & sync center (Phase 10 · M4). Shows connection state, resources saved for
 *  offline, local drafts, the sync queue and the web-push opt-in. Compact, in-app. */
@Component({
  selector: 'asta-offline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <header class="asta-page-command-header max-w-app mx-auto">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Offline &amp; sync</h1>
        <span class="goal-pill">
          <span class="dot" [style.background]="net.online() ? 'var(--green)' : 'var(--danger)'"></span>
          {{ net.online() ? 'Online' : 'Offline — changes will sync when you reconnect' }}
        </span>
      </div>
    </header>

    <div class="max-w-app mx-auto space-y-5">
      <!-- What works offline -->
      <div class="card" style="padding:18px">
        <p class="kicker mb-2">What you can do offline</p>
        <div class="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p class="text-txt-soft">✓ Read saved roadmaps, flows &amp; notes</p>
          <p class="text-txt-soft">✓ Review saved flashcards</p>
          <p class="text-txt-soft">✓ Draft quiz / project / notes (synced later)</p>
          <p class="text-txt-mute">✗ New AI generation &amp; live voice tutor</p>
          <p class="text-txt-mute">✗ Streaming agents, payments</p>
          <p class="text-txt-mute">✗ Admin realtime dashboards</p>
        </div>
      </div>

      <!-- Saved resources -->
      <div class="card" style="padding:18px">
        <div class="flex items-center justify-between mb-3">
          <p class="kicker">Available offline · {{ offline.resourceCount() }}</p>
        </div>
        @if (resources().length) {
          <div class="space-y-1">
            @for (r of resources(); track r.id) {
              <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
                <span class="pill capitalize">{{ r.kind }}</span>
                <span class="min-w-0 flex-1 truncate">{{ r.title }}</span>
                <span class="font-mono text-xs text-txt-mute">{{ r.savedAt | date: 'MMM d' }}</span>
                <button class="text-xs text-txt-mute hover:text-danger" (click)="remove(r)">Remove</button>
              </div>
            }
          </div>
        } @else {
          <p class="text-sm text-txt-mute">Nothing saved yet. Use “Make available offline” on a roadmap, flow or notes page.</p>
        }
      </div>

      <!-- Drafts + sync queue -->
      <div class="grid gap-5 md:grid-cols-2">
        <div class="card" style="padding:18px">
          <p class="kicker mb-3">Local drafts · {{ offline.draftCount() }}</p>
          @if (drafts().length) {
            <div class="space-y-1">
              @for (d of drafts(); track d.id) {
                <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
                  <span class="pill capitalize">{{ d.kind }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ d.title }}</span>
                  <span class="font-mono text-xs text-txt-mute">{{ d.updatedAt | date: 'MMM d, HH:mm' }}</span>
                </div>
              }
            </div>
          } @else { <p class="text-sm text-txt-mute">No local drafts.</p> }
        </div>

        <div class="card" style="padding:18px">
          <div class="flex items-center justify-between mb-3">
            <p class="kicker">Sync queue · {{ sync.pendingCount() }}</p>
            @if (sync.pendingCount()) {
              <button class="text-xs font-semibold" style="color:var(--green-deep)" [disabled]="!net.online() || sync.syncing()" (click)="flush()">
                {{ sync.syncing() ? 'Syncing…' : 'Sync now' }}
              </button>
            }
          </div>
          @if (sync.pending().length) {
            <div class="space-y-1">
              @for (q of sync.pending(); track q.id) {
                <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
                  <span class="pill font-mono">{{ q.method }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ q.label }}</span>
                  @if (q.attempts > 0) { <span class="font-mono text-xs" style="color:var(--danger)">retry {{ q.attempts }}</span> }
                </div>
              }
            </div>
          } @else { <p class="text-sm text-txt-mute">All changes synced.</p> }
        </div>
      </div>

      <!-- Web push -->
      <div class="card" style="padding:18px">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="kicker mb-1">Push notifications</p>
            <p class="text-sm text-txt-soft">
              @if (!flags.isOn('ENABLE_WEB_PUSH')) { Web push is currently disabled by the platform. }
              @else if (!push.supported) { This browser doesn’t support web push. }
              @else { Get streak reminders &amp; mentor updates even when Asta is closed. }
            </p>
          </div>
          <button class="rounded-full px-4 py-2 text-sm font-semibold shrink-0"
            [style.background]="push.subscribed() ? 'var(--paper-2)' : 'var(--green)'"
            [style.color]="push.subscribed() ? 'var(--text-mute)' : 'var(--ink)'"
            [disabled]="!flags.isOn('ENABLE_WEB_PUSH') || !push.supported || push.subscribed()"
            (click)="enablePush()">
            {{ push.subscribed() ? 'Enabled' : (push.permission() === 'denied' ? 'Blocked' : 'Enable') }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class OfflineComponent implements OnInit {
  readonly net = inject(NetworkStatusService);
  readonly offline = inject(OfflineService);
  readonly sync = inject(SyncQueueService);
  readonly push = inject(WebPushService);
  readonly flags = inject(FeatureFlagService);
  private readonly toast = inject(ToastService);

  readonly resources = signal<OfflineResource[]>([]);
  readonly drafts = signal<OfflineDraft[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    await this.offline.refresh();
    this.resources.set(await this.offline.listResources());
    this.drafts.set(await this.offline.listDrafts());
  }

  async remove(r: OfflineResource): Promise<void> {
    await this.offline.removeResource(r.id);
    this.resources.set(await this.offline.listResources());
  }

  flush(): void {
    void this.sync.flush();
  }

  async enablePush(): Promise<void> {
    const ok = await this.push.enable();
    this.toast[ok ? 'success' : 'info'](
      ok ? 'Push notifications enabled' : 'Push not available right now',
    );
  }
}
