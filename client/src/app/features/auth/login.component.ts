import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FieldComponent } from '../../shared/ui/field.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { GoogleSigninComponent } from './google-signin.component';
import { OtpVerifyComponent } from './otp-verify.component';

@Component({
    selector: 'asta-login',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FieldComponent, MagneticDirective, GoogleSigninComponent, OtpVerifyComponent],
    template: `
    @if (otpEmail(); as email) {
      <asta-otp-verify [email]="email" />
      <p class="text-sm text-txt-soft mt-6 text-center">
        <button type="button" class="font-semibold" style="color:var(--green-deep)" (click)="otpEmail.set(null)">Back to log in</button>
      </p>
    } @else {
      <p class="kicker st st-0 mb-3">WELCOME BACK</p>
      <h1 class="st st-0 grad-flow text-[31px] mb-1">Pick up your path.</h1>
      <p class="st st-1 text-txt-soft mb-7">Your roadmap, streak and agents are right where you left them.</p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="st st-1">
          <asta-field label="Email" [error]="errorFor('email')">
            <input class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
          </asta-field>
        </div>
        <div class="st st-2">
          <asta-field label="Password" [error]="errorFor('password')">
            <div class="pw-wrap">
              <input class="input pw-input" [type]="showPw() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" placeholder="••••••••" />
              <button type="button" class="pw-toggle" (click)="showPw.set(!showPw())" [attr.aria-label]="showPw() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showPw()">
                {{ showPw() ? 'Hide' : 'Show' }}
              </button>
            </div>
          </asta-field>
        </div>

        <div class="st st-3">
          <asta-btn type="submit" astaMagnetic [full]="true" [loading]="loading()" variant="accent">Log in <span class="arr">→</span></asta-btn>
        </div>
      </form>

      <div class="st st-3"><asta-google-signin /></div>

      <p class="st st-4 text-sm text-txt-soft mt-6 text-center">
        New here?
        <a routerLink="/register" class="font-semibold" style="color:var(--green-deep)">Create an account</a>
      </p>
    }
  `,
    styles: [
        `
      /* Staggered entrance — composes with the layout's form-card rise. */
      .st { animation: astaRevealUp 0.5s var(--ease) both; }
      .st-0 { animation-delay: 0.16s; }
      .st-1 { animation-delay: 0.24s; }
      .st-2 { animation-delay: 0.32s; }
      .st-3 { animation-delay: 0.4s; }
      .st-4 { animation-delay: 0.48s; }
      .kicker { display: inline-flex; }

      .pw-wrap { position: relative; }
      .pw-input { padding-right: 64px; }
      .pw-toggle {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        border: 0;
        background: transparent;
        cursor: pointer;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--text-mute);
        padding: 4px 6px;
        border-radius: 6px;
        transition: color 0.15s var(--ease);
      }
      .pw-toggle:hover { color: var(--green-deep); }

      @media (prefers-reduced-motion: reduce) {
        .st { animation: none; }
      }
    `,
    ]
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly otpEmail = signal<string | null>(null);
  readonly showPw = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  errorFor(name: 'email' | 'password'): string | null {
    const c = this.form.controls[name];
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'This field is required';
    if (c.hasError('email')) return 'Enter a valid email';
    return null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        if ('pendingVerification' in res) {
          // Account exists but email isn't verified — a fresh code was just sent.
          this.toast.info('Verify your email — we sent you a code');
          this.otpEmail.set(res.email);
          return;
        }
        this.toast.success(`Welcome back, ${res.user.name.split(' ')[0]}`);
        void this.router.navigateByUrl(this.auth.postAuthRoute(res.user));
      },
      error: () => this.loading.set(false),
    });
  }
}
