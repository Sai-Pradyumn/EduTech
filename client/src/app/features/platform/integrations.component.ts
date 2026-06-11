import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IntegrationService, IntegrationView } from '../../core/services/integration.service';
import { ToastService } from '../../core/services/toast.service';
import { ModalComponent } from '../../shared/ui/modal.component';

/** Integrations (Phase 10 · M12). Webhook (Slack/Discord), CSV (LMS), manual (GitHub) and
 *  export (.ics) connectors are fully functional; OAuth providers activate when keys are set. */
@Component({
  selector: 'asta-integrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ModalComponent],
  template: `
    <header class="asta-page-command-header max-w-app mx-auto">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Integrations</h1>
        <span class="goal-pill"><span class="dot"></span>connect your tools</span>
      </div>
    </header>

    <div class="max-w-app mx-auto grid gap-4 sm:grid-cols-2 motion-stagger">
      @for (i of items(); track i.provider) {
        <div class="card int-card" [class.int-on]="i.connected" style="padding:18px">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="min-w-0">
              <p class="font-semibold">{{ i.name }} <span class="pill text-[10px]">{{ i.category }}</span></p>
              <p class="text-xs text-txt-soft mt-1">{{ i.description }}</p>
            </div>
            @if (i.connected) { <span class="pill" style="color:var(--green-deep)">connected</span> }
          </div>
          <div class="flex items-center gap-2 mt-3 flex-wrap">
            @if (i.mode === 'export') {
              <a class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--green);color:var(--ink)" [href]="calUrl" target="_blank" rel="noopener">Download .ics</a>
            } @else if (i.connected) {
              <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--paper-2)" [disabled]="busy()" (click)="disconnect(i)">Disconnect</button>
              @if (i.mode === 'webhook') {
                <button class="text-xs font-semibold" style="color:var(--green-deep)" [disabled]="busy()" (click)="sync(i)">Send test</button>
                @if (webhookUrlOf(i)) { <button class="text-xs font-semibold text-txt-mute" (click)="copyWebhook(i)">Copy URL</button> }
              } @else if (i.mode === 'csv') {
                <button class="text-xs font-semibold" style="color:var(--green-deep)" [disabled]="busy()" (click)="pickCsv(i)">Re-import CSV</button>
              } @else {
                <button class="text-xs font-semibold" style="color:var(--green-deep)" [disabled]="busy()" (click)="sync(i)">Sync now</button>
              }
            } @else if (i.mode === 'webhook') {
              <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--green);color:var(--ink)" [disabled]="busy()" (click)="openWebhook(i)">Connect webhook</button>
            } @else if (i.mode === 'csv') {
              <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--green);color:var(--ink)" [disabled]="busy()" (click)="pickCsv(i)">Upload CSV</button>
            } @else if (i.mode === 'oauth') {
              <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--green);color:var(--ink)" [disabled]="busy()" (click)="oauth(i)">Connect</button>
            } @else {
              <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--green);color:var(--ink)" [disabled]="busy()" (click)="connect(i)">Connect</button>
            }
          </div>
          @if (i.connected && i.lastSyncAt) {
            <p class="text-[11px] text-txt-mute mt-2.5">Last activity {{ ago(i.lastSyncAt) }}</p>
          }
        </div>
      } @empty {
        @for (n of [0,1,2,3]; track n) { <div class="card" style="padding:18px"><span class="skel" style="display:block;height:60px;border-radius:8px"></span></div> }
      }
    </div>

    <!-- Webhook URL prompt (Slack / Discord) -->
    <asta-modal [open]="!!webhookFor()" (closed)="webhookFor.set(null)">
      @if (webhookFor(); as i) {
        <p class="kicker mb-1">Connect {{ i.name }}</p>
        <p class="text-xs text-txt-soft mb-3">
          Paste an incoming-webhook URL from {{ i.name }}. We'll post a confirmation message to that channel.
        </p>
        <input
          class="w-full rounded-[10px] px-3 py-2 text-sm font-mono"
          style="background:var(--paper-2);border:1px solid var(--paper-3)"
          [placeholder]="i.provider === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://discord.com/api/webhooks/…'"
          [(ngModel)]="webhookUrl" />
        <div class="flex items-center justify-end gap-2 mt-4">
          <button class="text-xs font-semibold text-txt-mute" (click)="webhookFor.set(null)">Cancel</button>
          <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--green);color:var(--ink)" [disabled]="busy()" (click)="saveWebhook()">Connect</button>
        </div>
      }
    </asta-modal>

    <input #csvInput type="file" accept=".csv,text/csv" hidden (change)="onCsv($event)" />
  `,
  styles: [
    `
      .skel{background:linear-gradient(90deg,var(--paper-2) 25%,var(--paper-3) 50%,var(--paper-2) 75%);background-size:200% 100%;animation:s 1.4s ease infinite}
      @keyframes s{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .int-card { transition: transform .22s var(--ease), box-shadow .22s var(--ease), border-color .22s var(--ease); }
      .int-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: color-mix(in oklch, var(--green) 26%, transparent); }
      /* Connected connectors carry a faint live tint so state reads at a glance. */
      .int-on { border-color: color-mix(in oklch, var(--green) 28%, var(--paper-3)); background: radial-gradient(140% 100% at 100% 0%, color-mix(in oklch, var(--green) 7%, transparent), transparent 55%), var(--paper); }
      :host-context([data-theme='dark']) .int-on { background: radial-gradient(140% 100% at 100% 0%, color-mix(in oklch, var(--green) 8%, transparent), transparent 55%), var(--paper-2); }
      @media (prefers-reduced-motion:reduce){.skel{animation:none}.int-card:hover{transform:none}}
    `,
  ],
})
export class IntegrationsComponent implements OnInit {
  private readonly svc = inject(IntegrationService);
  private readonly toast = inject(ToastService);

  readonly items = signal<IntegrationView[]>([]);
  readonly busy = signal(false);
  readonly calUrl = this.svc.calendarUrl();

  readonly webhookFor = signal<IntegrationView | null>(null);
  webhookUrl = '';
  private csvTarget: IntegrationView | null = null;
  @ViewChild('csvInput') csvInput?: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.svc.list().subscribe({ next: (i) => this.items.set(i) });
  }

  connect(i: IntegrationView): void {
    this.busy.set(true);
    this.svc.connect(i.provider).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`${i.name} connected`);
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  openWebhook(i: IntegrationView): void {
    this.webhookUrl = '';
    this.webhookFor.set(i);
  }

  saveWebhook(): void {
    const i = this.webhookFor();
    if (!i) return;
    const url = this.webhookUrl.trim();
    if (!/^https:\/\//i.test(url)) {
      this.toast.error('Enter a valid https:// webhook URL');
      return;
    }
    this.busy.set(true);
    this.svc.connect(i.provider, { webhookUrl: url }).subscribe({
      next: () => {
        this.busy.set(false);
        this.webhookFor.set(null);
        this.toast.success(`${i.name} connected — check your channel`);
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.message || 'Could not connect');
      },
    });
  }

  oauth(i: IntegrationView): void {
    this.busy.set(true);
    this.svc.oauthStart(i.provider).subscribe({
      next: (r) => {
        window.location.href = r.authUrl;
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.message || `${i.name} is not configured yet`);
      },
    });
  }

  pickCsv(i: IntegrationView): void {
    this.csvTarget = i;
    this.csvInput?.nativeElement.click();
  }

  onCsv(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    const target = this.csvTarget;
    input.value = '';
    if (!file || !target) return;
    this.busy.set(true);
    file.text().then((csv) => {
      this.svc.importCsv(target.provider, csv).subscribe({
        next: (r) => {
          this.busy.set(false);
          this.toast.success(`Imported ${r.imported} row(s)${r.skipped ? `, skipped ${r.skipped}` : ''}`);
          this.load();
        },
        error: (e) => {
          this.busy.set(false);
          this.toast.error(e?.message || 'Import failed');
        },
      });
    });
  }

  disconnect(i: IntegrationView): void {
    this.busy.set(true);
    this.svc.disconnect(i.provider).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  webhookUrlOf(i: IntegrationView): string | null {
    const url = i.metadata?.['webhookUrl'];
    return typeof url === 'string' && url ? url : null;
  }

  copyWebhook(i: IntegrationView): void {
    const url = this.webhookUrlOf(i);
    if (!url) return;
    navigator.clipboard?.writeText(url).then(
      () => this.toast.success('Webhook URL copied'),
      () => this.toast.error('Copy failed'),
    );
  }

  ago(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'yesterday' : `${d}d ago`;
  }

  sync(i: IntegrationView): void {
    this.busy.set(true);
    this.svc.sync(i.provider).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(i.mode === 'webhook' ? `Test message sent to ${i.name}` : `${i.name} synced`);
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.message || 'Sync failed');
      },
    });
  }
}
