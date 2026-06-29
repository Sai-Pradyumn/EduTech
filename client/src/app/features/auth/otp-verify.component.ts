import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/ui/button.component';

/**
 * Step 2 of email signup: enter the 6-digit code sent to the email. Verifies → starts a
 * session → routes onward. Includes a resend button with a 60s cooldown.
 */
@Component({
    selector: 'asta-otp-verify',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ButtonComponent],
    template: `
    <span class="otp-glyph st st-0" aria-hidden="true">
      <span class="otp-halo"></span>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--green-deep)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="m2 7 10 7 10-7" />
      </svg>
    </span>
    <p class="kicker st st-0 mb-3">ONE LAST STEP</p>
    <h1 class="st st-0 grad-flow text-[30px] mb-1">Check your email.</h1>
    <p class="st st-1 text-txt-soft mb-7">We sent a 6-digit code to <span class="font-semibold">{{ email() }}</span>.</p>

    <label for="otp-code" class="st st-1 block mb-2 text-sm text-txt-soft">Verification code</label>
    <input
      id="otp-code"
      class="input otp-input st st-2 text-center"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="6"
      placeholder="••••••"
      [(ngModel)]="code"
      (ngModelChange)="onInput()"
      (keyup.enter)="verify()" />

    <div class="st st-3">
      <asta-btn class="block mt-5" [full]="true" [loading]="loading()" [disabled]="code.length !== 6" variant="accent" (click)="verify()">
        Verify &amp; continue
      </asta-btn>
    </div>

    <div class="st st-4 text-sm text-txt-soft mt-6 text-center">
      @if (cooldown() > 0) {
        <span class="otp-wait"><span class="otp-tick" aria-hidden="true"></span>Resend code in {{ cooldown() }}s</span>
      } @else {
        Didn't get it?
        <button type="button" class="font-semibold" style="color:var(--green-deep)" [disabled]="resending()" (click)="resend()">Resend code</button>
      }
    </div>
  `,
    styles: [
        `
      .st { animation: astaRevealUp 0.5s var(--ease) both; }
      .st-0 { animation-delay: 0.12s; }
      .st-1 { animation-delay: 0.2s; }
      .st-2 { animation-delay: 0.28s; }
      .st-3 { animation-delay: 0.36s; }
      .st-4 { animation-delay: 0.44s; }
      .kicker { display: inline-flex; }

      .otp-glyph {
        position: relative;
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        margin-bottom: 18px;
        border-radius: 16px;
        background: color-mix(in oklch, var(--green) 14%, transparent);
      }
      .otp-halo {
        position: absolute;
        inset: -6px;
        border-radius: 20px;
        pointer-events: none;
        background: radial-gradient(circle, color-mix(in oklch, var(--green) 24%, transparent), transparent 70%);
        animation: otpBreathe 3s ease-in-out infinite;
      }
      @keyframes otpBreathe {
        0%, 100% { opacity: 0.45; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
      }

      .otp-input {
        font-size: 28px;
        letter-spacing: 14px;
        font-family: var(--mono);
        transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), letter-spacing 0.2s var(--ease);
      }
      .otp-input:focus {
        border-color: var(--green);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--green) 18%, transparent);
      }

      .otp-wait { display: inline-flex; align-items: center; gap: 8px; }
      .otp-tick {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--green);
        animation: astaPulse 2s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .st, .otp-halo, .otp-tick { animation: none; }
      }
    `,
    ]
})
export class OtpVerifyComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly email = input.required<string>();
  code = '';
  readonly loading = signal(false);
  readonly resending = signal(false);
  readonly cooldown = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.startCooldown();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  onInput(): void {
    this.code = this.code.replace(/\D/g, '').slice(0, 6);
    if (this.code.length === 6) this.verify();
  }

  verify(): void {
    if (this.code.length !== 6 || this.loading()) return;
    this.loading.set(true);
    this.auth.verifyOtp(this.email(), this.code).subscribe({
      next: (res) => {
        this.toast.success('Email verified — welcome to Asta');
        void this.router.navigateByUrl(this.auth.postAuthRoute(res.user));
      },
      error: () => {
        // The error interceptor surfaces the message; just reset for another try.
        this.loading.set(false);
        this.code = '';
      },
    });
  }

  resend(): void {
    if (this.cooldown() > 0 || this.resending()) return;
    this.resending.set(true);
    this.auth.resendOtp(this.email()).subscribe({
      next: () => {
        this.resending.set(false);
        this.toast.success('A new code is on its way');
        this.startCooldown();
      },
      error: () => {
        this.resending.set(false);
        this.startCooldown();
      },
    });
  }

  private startCooldown(): void {
    this.cooldown.set(60);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const next = this.cooldown() - 1;
      this.cooldown.set(next);
      if (next <= 0 && this.timer) clearInterval(this.timer);
    }, 1000);
  }
}
