import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

interface GoogleId {
  accounts: {
    id: {
      initialize: (cfg: {
        client_id: string;
        callback: (resp: { credential: string }) => void;
      }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleId;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Google sign-in button (Phase 10 · OAuth). Self-configures from `/auth/google/config`;
 * renders nothing when Google sign-in isn't configured server-side. Loads Google Identity
 * Services on demand, verifies the credential server-side, then routes the user.
 */
@Component({
  selector: 'asta-google-signin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled()) {
      <div class="flex items-center gap-3 my-5">
        <span class="flex-1 h-px" style="background:var(--paper-3)"></span>
        <span class="text-xs text-txt-mute">or</span>
        <span class="flex-1 h-px" style="background:var(--paper-3)"></span>
      </div>
      <div #btn class="grid place-items-center"></div>
    }
  `,
})
export class GoogleSigninComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);

  readonly enabled = signal(false);
  private readonly btn = viewChild<ElementRef<HTMLElement>>('btn');
  private clientId = '';

  ngAfterViewInit(): void {
    this.auth.googleConfig().subscribe({
      next: (cfg) => {
        if (!cfg.enabled || !cfg.clientId) return;
        this.clientId = cfg.clientId;
        this.enabled.set(true);
        this.loadScript().then(() => this.render());
      },
      error: () => undefined,
    });
  }

  private loadScript(): Promise<void> {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve) => {
      const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }

  private render(): void {
    // Defer a tick so the GIS global + the @if-rendered host are both ready.
    setTimeout(() => {
      const host = this.btn()?.nativeElement;
      if (!host || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: this.clientId,
        callback: (resp) => this.zone.run(() => this.onCredential(resp.credential)),
      });
      window.google.accounts.id.renderButton(host, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'pill',
      });
    });
  }

  private onCredential(credential: string): void {
    this.auth.googleLogin(credential).subscribe({
      next: (res) => {
        this.toast.success(`Welcome, ${res.user.name.split(' ')[0]}`);
        void this.router.navigateByUrl(this.auth.postAuthRoute(res.user));
      },
      error: () => this.toast.error('Google sign-in failed'),
    });
  }
}
