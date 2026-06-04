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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FieldComponent, MagneticDirective, GoogleSigninComponent, OtpVerifyComponent],
  template: `
    @if (otpEmail(); as email) {
      <asta-otp-verify [email]="email" />
      <p class="text-sm text-txt-soft mt-6 text-center">
        <button type="button" class="font-semibold" style="color:var(--green-deep)" (click)="otpEmail.set(null)">Back to log in</button>
      </p>
    } @else {
      <h1 class="text-[30px] mb-1">Welcome back</h1>
      <p class="text-txt-soft mb-7">Log in to continue your path.</p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <asta-field label="Email" [error]="errorFor('email')">
          <input class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
        </asta-field>
        <asta-field label="Password" [error]="errorFor('password')">
          <input class="input" type="password" formControlName="password" autocomplete="current-password" placeholder="••••••••" />
        </asta-field>

        <asta-btn type="submit" astaMagnetic [full]="true" [loading]="loading()" variant="accent">Log in</asta-btn>
      </form>

      <asta-google-signin />

      <p class="text-sm text-txt-soft mt-6 text-center">
        New here?
        <a routerLink="/register" class="font-semibold" style="color:var(--green-deep)">Create an account</a>
      </p>
    }
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly otpEmail = signal<string | null>(null);
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
