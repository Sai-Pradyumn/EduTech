import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { IntegrationService, IntegrationView } from '../../core/services/integration.service';
import { ToastService } from '../../core/services/toast.service';

/** Integrations foundation (Phase 10 · M12). Connect mock/manual/export connectors;
 *  OAuth providers are placeholders. Calendar export is real (.ics). */
@Component({
  selector: 'asta-integrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="asta-page-command-header max-w-app mx-auto">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Integrations</h1>
        <span class="goal-pill"><span class="dot"></span>connect your tools</span>
      </div>
    </header>

    <div class="max-w-app mx-auto grid gap-4 sm:grid-cols-2">
      @for (i of items(); track i.provider) {
        <div class="card" style="padding:18px">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="min-w-0">
              <p class="font-semibold">{{ i.name }} <span class="pill text-[10px]">{{ i.category }}</span></p>
              <p class="text-xs text-txt-soft mt-1">{{ i.description }}</p>
            </div>
            @if (i.connected) { <span class="pill" style="color:var(--green-deep)">connected</span> }
          </div>
          <div class="flex items-center gap-2 mt-3">
            @if (i.mode === 'export') {
              <a class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--green);color:var(--ink)" [href]="calUrl" target="_blank" rel="noopener">Download .ics</a>
            } @else if (i.mode === 'oauth') {
              <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--paper-2);color:var(--text-mute)" disabled>Connect (OAuth — soon)</button>
            } @else if (i.connected) {
              <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--paper-2)" [disabled]="busy()" (click)="disconnect(i)">Disconnect</button>
              <button class="text-xs font-semibold" style="color:var(--green-deep)" [disabled]="busy()" (click)="sync(i)">Sync now</button>
            } @else {
              <button class="rounded-full px-3.5 py-1.5 text-xs font-semibold" style="background:var(--green);color:var(--ink)" [disabled]="busy()" (click)="connect(i)">Connect</button>
            }
          </div>
        </div>
      } @empty {
        @for (n of [0,1,2,3]; track n) { <div class="card" style="padding:18px"><span class="skel" style="display:block;height:60px;border-radius:8px"></span></div> }
      }
    </div>
  `,
  styles: [`.skel{background:linear-gradient(90deg,var(--paper-2) 25%,var(--paper-3) 50%,var(--paper-2) 75%);background-size:200% 100%;animation:s 1.4s ease infinite}@keyframes s{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.skel{animation:none}}`],
})
export class IntegrationsComponent implements OnInit {
  private readonly svc = inject(IntegrationService);
  private readonly toast = inject(ToastService);

  readonly items = signal<IntegrationView[]>([]);
  readonly busy = signal(false);
  readonly calUrl = this.svc.calendarUrl();

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

  sync(i: IntegrationView): void {
    this.busy.set(true);
    this.svc.sync(i.provider).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`${i.name} synced`);
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }
}
