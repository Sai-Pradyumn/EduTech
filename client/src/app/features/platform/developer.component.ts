import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiKeyView,
  CreatedKey,
  DeveloperService,
  DeliveryView,
  WebhookView,
} from '../../core/services/developer.service';
import { ToastService } from '../../core/services/toast.service';

/** Developer platform (Phase 10 · M11). Org API keys (shown once) + webhooks with test
 *  delivery + delivery log. OrgManage. */
@Component({
    selector: 'asta-developer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, FormsModule],
    template: `
    <header class="asta-page-command-header max-w-app mx-auto">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Developer</h1>
        <span class="goal-pill"><span class="dot"></span>API keys &amp; webhooks</span>
      </div>
    </header>

    <div class="max-w-app mx-auto space-y-5">
      <!-- API keys -->
      <div class="card motion-card-reveal motion-row-primary" style="padding:18px">
        <p class="kicker mb-3">API keys</p>
        @if (newKey(); as k) {
          <div class="dev-newkey rounded-[12px] p-3 mb-3" style="background:color-mix(in oklch, var(--green) 12%, var(--paper));border:1px solid var(--green)">
            <div class="flex items-center justify-between gap-2 mb-1">
              <p class="text-xs text-txt-soft">Copy your key now — it won’t be shown again.</p>
              <button class="rounded-full px-3 py-1 text-xs font-semibold shrink-0" style="background:var(--green);color:var(--ink)" (click)="copyKey(k.key)">Copy key</button>
            </div>
            <code class="text-sm font-mono break-all">{{ k.key }}</code>
          </div>
        }
        <div class="flex gap-2 mb-2">
          <input class="asta-input flex-1" [(ngModel)]="keyName" placeholder="Key name (e.g. LMS sync)" />
          <button class="rounded-full px-4 py-2 text-sm font-semibold shrink-0" style="background:var(--green);color:var(--ink)" [disabled]="busy() || !keyName.trim()" (click)="createKey()">Create key</button>
        </div>
        <input class="asta-input w-full mb-3" [(ngModel)]="keyScopes" placeholder="Scopes (comma-separated, e.g. read:analytics, write:webhooks) — optional" />
        <div class="space-y-1">
          @for (k of keys(); track k.id) {
            <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
              <span class="min-w-0 flex-1 truncate">
                {{ k.name }} <span class="font-mono text-xs text-txt-mute">{{ k.prefix }}…</span>
                @for (sc of k.scopes; track sc) { <span class="scope-tag">{{ sc }}</span> }
                @if (!k.scopes.length) { <span class="scope-tag muted">full access</span> }
              </span>
              <span class="font-mono text-xs text-txt-mute">{{ k.lastUsedAt ? 'used ' + (k.lastUsedAt | date:'MMM d') : 'never used' }}</span>
              <button class="text-xs text-txt-mute hover:text-danger" (click)="revokeKey(k)">Revoke</button>
            </div>
          } @empty { <p class="text-sm text-txt-mute">No API keys yet.</p> }
        </div>
      </div>

      <!-- Webhooks -->
      <div class="card motion-card-reveal motion-row-2" style="padding:18px">
        <p class="kicker mb-3">Webhooks</p>
        <div class="flex gap-2 mb-3">
          <input class="asta-input flex-1" [(ngModel)]="hookUrl" placeholder="https://example.com/webhooks/asta" />
          <button class="rounded-full px-4 py-2 text-sm font-semibold shrink-0" style="background:var(--green);color:var(--ink)" [disabled]="busy() || !hookUrl.trim()" (click)="createWebhook()">Add endpoint</button>
        </div>
        <div class="space-y-1">
          @for (w of webhooks(); track w.id) {
            <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
              <span class="pill" [style.color]="w.active ? 'var(--green-deep)' : 'var(--text-mute)'">{{ w.active ? 'active' : 'off' }}</span>
              <span class="min-w-0 flex-1 truncate font-mono text-xs">{{ w.url }}</span>
              <button class="text-xs font-semibold" style="color:var(--green-deep)" (click)="test(w)">Test</button>
              <button class="text-xs text-txt-mute hover:text-danger" (click)="deleteWebhook(w)">Delete</button>
            </div>
          } @empty { <p class="text-sm text-txt-mute">No webhook endpoints. Events: {{ events().join(', ') }}</p> }
        </div>
      </div>

      <!-- Deliveries -->
      <div class="card" style="padding:18px">
        <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p class="kicker">Recent deliveries</p>
          <div class="flex gap-1.5">
            @for (f of deliveryFilters; track f) {
              <button class="filter-pill" [class.on]="deliveryFilter() === f" (click)="deliveryFilter.set(f)">{{ f }}</button>
            }
          </div>
        </div>
        <div class="space-y-1">
          @for (d of filteredDeliveries(); track d.id) {
            <div class="flex items-center gap-3 text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
              <span class="pill font-mono">{{ d.event }}</span>
              <span class="pill" [style.color]="d.status === 'success' ? 'var(--green-deep)' : 'var(--danger)'">{{ d.status }}{{ d.responseCode ? ' · ' + d.responseCode : '' }}@if (d.attempts > 1) {<span class="text-txt-mute"> · {{ d.attempts }}×</span>}</span>
              <span class="min-w-0 flex-1 truncate text-xs text-txt-mute" [title]="endpointUrl(d.endpointId)">{{ d.error || endpointUrl(d.endpointId) }}</span>
              <span class="font-mono text-xs text-txt-mute">{{ d.createdAt | date:'MMM d, HH:mm' }}</span>
            </div>
          } @empty { <p class="text-sm text-txt-mute">{{ deliveries().length ? 'No ' + deliveryFilter() + ' deliveries.' : 'No deliveries yet — send a test event.' }}</p> }
        </div>
      </div>
    </div>
  `,
    styles: [`
    .asta-input{padding:8px 12px;border-radius:10px;border:1px solid var(--paper-3);background:var(--paper);font-size:14px}
    .asta-input:focus{outline:none;border-color:var(--green)}
    .scope-tag{display:inline-block;margin-left:5px;font-family:var(--mono);font-size:10px;padding:1px 7px;border-radius:999px;color:var(--green-deep);background:color-mix(in oklch,var(--green) 13%,transparent)}
    .scope-tag.muted{color:var(--text-mute);background:color-mix(in oklch,var(--paper-3) 70%,transparent)}
    .filter-pill{font-size:11px;text-transform:capitalize;padding:4px 11px;border-radius:999px;color:var(--text-soft);background:color-mix(in oklch,var(--paper-2) 55%,transparent);border:1px solid var(--paper-3);cursor:pointer;transition:color .18s,border-color .18s,background .18s}
    .filter-pill.on{color:var(--green-deep);border-color:color-mix(in oklch,var(--green) 55%,transparent);background:color-mix(in oklch,var(--green) 12%,transparent)}
    /* The one-time key reveal is THE moment on this screen — pop + glow pulse. */
    .dev-newkey{animation:astaSoftPop .4s var(--ease-spring) both;box-shadow:0 0 0 0 var(--asta-accent-glow);}
    @media (prefers-reduced-motion:reduce){.dev-newkey{animation:none}}
  `]
})
export class DeveloperComponent implements OnInit {
  private readonly dev = inject(DeveloperService);
  private readonly toast = inject(ToastService);

  readonly keys = signal<ApiKeyView[]>([]);
  readonly webhooks = signal<WebhookView[]>([]);
  readonly deliveries = signal<DeliveryView[]>([]);
  readonly events = signal<string[]>([]);
  readonly newKey = signal<CreatedKey | null>(null);
  readonly busy = signal(false);
  keyName = '';
  keyScopes = '';
  hookUrl = '';

  readonly deliveryFilters = ['all', 'success', 'failed'] as const;
  readonly deliveryFilter = signal<(typeof this.deliveryFilters)[number]>('all');

  /** Endpoint id → its current URL (for delivery context); falls back to a short id. */
  private readonly urlById = computed(
    () => new Map(this.webhooks().map((w) => [w.id, w.url])),
  );
  endpointUrl(id: string): string {
    return this.urlById().get(id) ?? `endpoint ${id.slice(0, 8)}`;
  }

  readonly filteredDeliveries = computed(() => {
    const f = this.deliveryFilter();
    if (f === 'all') return this.deliveries();
    return this.deliveries().filter((d) =>
      f === 'success' ? d.status === 'success' : d.status !== 'success',
    );
  });

  ngOnInit(): void {
    this.dev.events().subscribe({ next: (e) => this.events.set(e) });
    this.loadKeys();
    this.loadWebhooks();
    this.loadDeliveries();
  }

  private loadKeys(): void {
    this.dev.keys().subscribe({ next: (k) => this.keys.set(k) });
  }
  private loadWebhooks(): void {
    this.dev.webhooks().subscribe({ next: (w) => this.webhooks.set(w) });
  }
  private loadDeliveries(): void {
    this.dev.deliveries().subscribe({ next: (d) => this.deliveries.set(d) });
  }

  createKey(): void {
    this.busy.set(true);
    const scopes = this.keyScopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.dev.createKey(this.keyName.trim(), scopes).subscribe({
      next: (k) => {
        this.newKey.set(k);
        this.keyName = '';
        this.keyScopes = '';
        this.busy.set(false);
        this.loadKeys();
      },
      error: () => this.busy.set(false),
    });
  }

  copyKey(key: string): void {
    navigator.clipboard?.writeText(key).then(
      () => this.toast.success('API key copied — store it safely'),
      () => this.toast.error('Clipboard unavailable — select and copy manually'),
    );
  }

  revokeKey(k: ApiKeyView): void {
    this.dev.revokeKey(k.id).subscribe({
      next: () => {
        this.toast.success('Key revoked');
        this.loadKeys();
      },
    });
  }

  createWebhook(): void {
    this.busy.set(true);
    this.dev.createWebhook(this.hookUrl.trim(), this.events()).subscribe({
      next: () => {
        this.hookUrl = '';
        this.busy.set(false);
        this.loadWebhooks();
        this.toast.success('Webhook added');
      },
      error: () => this.busy.set(false),
    });
  }

  deleteWebhook(w: WebhookView): void {
    this.dev.deleteWebhook(w.id).subscribe({ next: () => this.loadWebhooks() });
  }

  test(w: WebhookView): void {
    this.dev.testWebhook(w.id).subscribe({
      next: (r) => {
        this.toast[r.status === 'success' ? 'success' : 'info'](`Test ${r.status}`);
        this.loadDeliveries();
      },
    });
  }
}
