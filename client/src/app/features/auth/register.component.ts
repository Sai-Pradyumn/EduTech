import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FieldComponent } from '../../shared/ui/field.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { GoogleSigninComponent } from './google-signin.component';
import { OtpVerifyComponent } from './otp-verify.component';

@Component({
  selector: 'asta-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FieldComponent, MagneticDirective, GoogleSigninComponent, OtpVerifyComponent],
  template: `
    @if (otpEmail(); as email) {
      <asta-otp-verify [email]="email" />
      <p class="text-sm text-txt-soft mt-6 text-center">
        Wrong email?
        <button type="button" class="font-semibold" style="color:var(--green-deep)" (click)="otpEmail.set(null)">Go back</button>
      </p>
    } @else {
      <h1 class="text-[30px] mb-1">Start your path</h1>
      <p class="text-txt-soft mb-7">Create a free account in seconds.</p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <asta-field label="Full name" [error]="errorFor('name')">
          <input class="input" type="text" formControlName="name" autocomplete="name" placeholder="Aarav Sharma" />
        </asta-field>
        <asta-field label="Email" [error]="errorFor('email')" [hint]="domainHint()">
          <input class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@gmail.com" />
        </asta-field>
        <asta-field label="Password" [error]="errorFor('password')" hint="At least 8 characters">
          <input class="input" type="password" formControlName="password" autocomplete="new-password" placeholder="••••••••" />
        </asta-field>

        <asta-btn type="submit" astaMagnetic [full]="true" [loading]="loading()" variant="accent">Create account</asta-btn>
      </form>

      <asta-google-signin />

      <p class="text-sm text-txt-soft mt-6 text-center">
        Already have an account?
        <a routerLink="/login" class="font-semibold" style="color:var(--green-deep)">Log in</a>
      </p>
    }
  `,
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly otpEmail = signal<string | null>(null);
  readonly allowedDomains = signal<string[]>([]);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.auth.signupConfig().subscribe({ next: (c) => this.allowedDomains.set(c.allowedDomains) });
  }

  domainHint(): string {
    const d = this.allowedDomains();
    if (!d.length) return '';
    const head = d.slice(0, 4).join(', ');
    return `We accept: ${head}${d.length > 4 ? '…' : ''}`;
  }

  errorFor(name: 'name' | 'email' | 'password'): string | null {
    const c = this.form.controls[name];
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'This field is required';
    if (c.hasError('email')) return 'Enter a valid email';
    if (c.hasError('minlength')) {
      return name === 'password' ? 'Password must be at least 8 characters' : 'Too short';
    }
    return null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, password } = this.form.getRawValue();
    // Friendly client-side domain pre-check (server enforces authoritatively).
    const domains = this.allowedDomains();
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    if (domains.length && !domains.includes(domain)) {
      this.toast.error(`Please use one of: ${domains.slice(0, 5).join(', ')}`);
      return;
    }
    this.loading.set(true);
    this.auth.register(name, email, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.toast.success('Code sent — check your email');
        this.otpEmail.set(res.email);
      },
      error: () => this.loading.set(false),
    });
  }
}
