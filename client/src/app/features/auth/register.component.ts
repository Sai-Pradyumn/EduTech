import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
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
      <p class="kicker st st-0 mb-3">FREE TO START</p>
      <h1 class="st st-0 grad-flow text-[31px] mb-1">Start your path.</h1>
      <p class="st st-1 text-txt-soft mb-7">One account. Eleven agents. A plan built around your goal.</p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="st st-1">
          <asta-field label="Full name" [error]="errorFor('name')">
            <input class="input" type="text" formControlName="name" autocomplete="name" placeholder="Aarav Sharma" />
          </asta-field>
        </div>
        <div class="st st-2">
          <asta-field label="Email" [error]="errorFor('email')" [hint]="domainHint()">
            <input class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@gmail.com" />
          </asta-field>
        </div>
        <div class="st st-3">
          <asta-field label="Password" [error]="errorFor('password')" hint="At least 8 characters">
            <div class="pw-wrap">
              <input class="input pw-input" [type]="showPw() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" placeholder="••••••••" />
              <button type="button" class="pw-toggle" (click)="showPw.set(!showPw())" [attr.aria-label]="showPw() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showPw()">
                {{ showPw() ? 'Hide' : 'Show' }}
              </button>
            </div>
          </asta-field>
          <!-- live strength meter — pure view, derived from the control value -->
          @if (pwValue()) {
            <div class="pw-meter" aria-hidden="true">
              <span class="pw-bar" [class.on]="pwScore() >= 1"></span>
              <span class="pw-bar" [class.on]="pwScore() >= 2"></span>
              <span class="pw-bar" [class.on]="pwScore() >= 3"></span>
              <span class="pw-lbl">{{ pwLabel() }}</span>
            </div>
          }
        </div>

        <div class="st st-4">
          <asta-btn type="submit" astaMagnetic [full]="true" [loading]="loading()" variant="accent">Create account <span class="arr">→</span></asta-btn>
        </div>
      </form>

      <div class="st st-4"><asta-google-signin /></div>

      <p class="st st-5 text-sm text-txt-soft mt-6 text-center">
        Already have an account?
        <a routerLink="/login" class="font-semibold" style="color:var(--green-deep)">Log in</a>
      </p>
    }
  `,
  styles: [
    `
      .st { animation: astaRevealUp 0.5s var(--ease) both; }
      .st-0 { animation-delay: 0.16s; }
      .st-1 { animation-delay: 0.24s; }
      .st-2 { animation-delay: 0.32s; }
      .st-3 { animation-delay: 0.4s; }
      .st-4 { animation-delay: 0.48s; }
      .st-5 { animation-delay: 0.56s; }
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

      .pw-meter { display: flex; align-items: center; gap: 5px; margin: -6px 0 12px; }
      .pw-bar {
        width: 34px;
        height: 3.5px;
        border-radius: 99px;
        background: var(--paper-3);
        transition: background 0.25s var(--ease);
      }
      .pw-bar.on { background: var(--green); }
      .pw-lbl { font-size: 11.5px; color: var(--text-mute); margin-left: 4px; font-family: var(--mono); letter-spacing: 0.06em; text-transform: uppercase; }

      @media (prefers-reduced-motion: reduce) {
        .st { animation: none; }
      }
    `,
  ],
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly otpEmail = signal<string | null>(null);
  readonly allowedDomains = signal<string[]>([]);
  readonly showPw = signal(false);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Live password value as a signal — drives the strength meter (view-only). */
  readonly pwValue = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  readonly pwScore = computed(() => {
    const v = this.pwValue();
    let s = 0;
    if (v.length >= 8) s++;
    if (v.length >= 12 || (/[A-Z]/.test(v) && /[0-9]/.test(v))) s++;
    if (v.length >= 12 && /[^A-Za-z0-9]/.test(v)) s++;
    return s;
  });
  readonly pwLabel = computed(() => ['Too short', 'Okay', 'Good', 'Strong'][this.pwScore()]);

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
