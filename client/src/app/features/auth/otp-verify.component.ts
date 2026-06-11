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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent],
  template: `
    <h1 class="text-[30px] mb-1">Check your email</h1>
    <p class="text-txt-soft mb-7">We sent a 6-digit code to <span class="font-semibold">{{ email() }}</span>.</p>

    <label for="otp-code" class="block mb-2 text-sm text-txt-soft">Verification code</label>
    <input
      id="otp-code"
      class="input text-center"
      style="font-size:28px;letter-spacing:14px;font-family:var(--font-mono,monospace)"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="6"
      placeholder="••••••"
      [(ngModel)]="code"
      (ngModelChange)="onInput()"
      (keyup.enter)="verify()" />

    <asta-btn class="block mt-5" [full]="true" [loading]="loading()" [disabled]="code.length !== 6" variant="accent" (click)="verify()">
      Verify &amp; continue
    </asta-btn>

    <div class="text-sm text-txt-soft mt-6 text-center">
      @if (cooldown() > 0) {
        <span>Resend code in {{ cooldown() }}s</span>
      } @else {
        Didn't get it?
        <button type="button" class="font-semibold" style="color:var(--green-deep)" [disabled]="resending()" (click)="resend()">Resend code</button>
      }
    </div>
  `,
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
