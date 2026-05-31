import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EnterpriseService, SessionView } from '../../core/services/enterprise.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

/** Account security & devices (Phase 10 · M6). Active sessions, revoke a device, sign out
 *  everywhere (clears the refresh token). */
@Component({
  selector: 'asta-security',
  standalone: true,
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
      <div class="card" style="padding:18px">
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
              <div class="flex items-center gap-3 text-sm py-2" style="border-bottom:1px solid var(--paper-3)">
                <span class="grid place-items-center w-8 h-8 rounded-[9px] shrink-0" style="background:var(--paper-3)">
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

      <div class="card" style="padding:18px">
        <p class="kicker mb-2">Account protection</p>
        <ul class="text-sm text-txt-soft space-y-1.5">
          <li>✓ Passwords hashed with bcrypt</li>
          <li>✓ Short-lived access tokens + rotating refresh tokens</li>
          <li>✓ Every request carries a traceable request ID</li>
          <li class="text-txt-mute">SSO / SCIM — available on Enterprise (placeholder)</li>
        </ul>
      </div>
    </div>
  `,
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
