import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EnterpriseService, SessionView } from '../../core/services/enterprise.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

/** Account security & devices (Phase 10 · M6). Active sessions, revoke a device, sign out
 *  everywhere (clears the refresh token). */
@Component({
    selector: 'asta-security',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe],
    template: `
    <header class="asta-page-command-header max-w-app mx-auto">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Security &amp; devices</h1>
        <span class="goal-pill"><span class="dot"></span>where you’re signed in</span>
      </div>
    </header>

    <div class="max-w-app mx-auto space-y-5">
      <div class="card motion-card-reveal motion-row-primary" style="padding:18px">
        <div class="flex items-center justify-between mb-3">
          <p class="kicker">Active sessions</p>
          @if (sessions().length > 1) {
            <button class="text-xs font-semibold" style="color:var(--danger)" [disabled]="busy()" (click)="logoutAll()">
              Sign out everywhere
            </button>
          }
        </div>
        @if (sessions().length) {
          <div class="space-y-1">
            @for (s of sessions(); track s.id) {
              <div class="sec-row flex items-center gap-3 text-sm py-2" style="border-bottom:1px solid var(--paper-3)">
                <span class="sec-ico grid place-items-center w-8 h-8 rounded-[9px] shrink-0" [class.sec-ico-on]="s.current">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                </span>
                <div class="min-w-0 flex-1">
                  <p class="font-medium truncate">{{ s.device }} @if (s.current) { <span class="pill" style="color:var(--green-deep)">this device</span> }</p>
                  <p class="text-xs text-txt-mute font-mono">{{ s.ip || '—' }} · last seen {{ s.lastSeenAt | date: 'MMM d, HH:mm' }}</p>
                </div>
                @if (!s.current) {
                  <button class="text-xs text-txt-mute hover:text-danger" [disabled]="busy()" (click)="revoke(s)">Revoke</button>
                }
              </div>
            }
          </div>
        } @else {
          <p class="text-sm text-txt-mute">No active sessions recorded.</p>
        }
      </div>

      <div class="card motion-card-reveal motion-row-2" style="padding:18px">
        <p class="kicker mb-2">Account protection</p>
        <ul class="text-sm text-txt-soft space-y-1.5">
          <li>✓ Passwords hashed with bcrypt</li>
          <li>✓ Short-lived access tokens + rotating refresh tokens</li>
          <li>✓ Every request carries a traceable request ID</li>
          <li class="text-txt-mute">SSO &amp; SCIM provisioning — available on the Enterprise plan</li>
        </ul>
      </div>
    </div>
  `,
    styles: [
        `
      .sec-row { animation: astaRevealUp 0.4s var(--ease) both; transition: background 0.15s var(--ease); }
      .sec-row:nth-child(2) { animation-delay: 0.05s; }
      .sec-row:nth-child(3) { animation-delay: 0.1s; }
      .sec-row:nth-child(4) { animation-delay: 0.15s; }
      .sec-row:hover { background: color-mix(in oklch, var(--green) 4%, transparent); }
      .sec-ico { background: var(--paper-3); transition: transform 0.3s var(--ease-spring); }
      .sec-row:hover .sec-ico { transform: scale(1.1); }
      .sec-ico-on { background: color-mix(in oklch, var(--green) 14%, transparent); color: var(--green-deep); box-shadow: 0 0 12px var(--asta-accent-glow); }
      @media (prefers-reduced-motion: reduce) { .sec-row { animation: none; } .sec-row:hover .sec-ico { transform: none; } }
    `,
    ]
})
export class SecurityComponent implements OnInit {
  private readonly enterprise = inject(EnterpriseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly sessions = signal<SessionView[]>([]);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.enterprise.sessions().subscribe({ next: (s) => this.sessions.set(s) });
  }

  revoke(s: SessionView): void {
    this.busy.set(true);
    this.enterprise.revokeSession(s.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Device revoked');
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  logoutAll(): void {
    this.busy.set(true);
    this.enterprise.logoutAll().subscribe({
      next: () => {
        this.toast.success('Signed out of all devices');
        this.auth.logout();
      },
      error: () => this.busy.set(false),
    });
  }
}
