import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FieldComponent } from '../../shared/ui/field.component';

@Component({
  selector: 'asta-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FieldComponent],
  template: `
    <h1 class="text-[30px] mb-1">Start your path</h1>
    <p class="text-txt-soft mb-7">Create a free account in seconds.</p>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <asta-field label="Full name" [error]="errorFor('name')">
        <input class="input" type="text" formControlName="name" autocomplete="name" placeholder="Aarav Sharma" />
      </asta-field>
      <asta-field label="Email" [error]="errorFor('email')">
        <input class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
      </asta-field>
      <asta-field label="Password" [error]="errorFor('password')" hint="At least 8 characters">
        <input class="input" type="password" formControlName="password" autocomplete="new-password" placeholder="••••••••" />
      </asta-field>

      <asta-btn type="submit" [full]="true" [loading]="loading()" variant="accent">Create account</asta-btn>
    </form>

    <p class="text-sm text-txt-soft mt-6 text-center">
      Already have an account?
      <a routerLink="/login" class="font-semibold" style="color:var(--green-deep)">Log in</a>
    </p>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

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
    this.loading.set(true);
    const { name, email, password } = this.form.getRawValue();
    this.auth.register(name, email, password).subscribe({
      next: (res) => {
        this.toast.success('Account created — let’s map your path');
        void this.router.navigateByUrl(this.auth.postAuthRoute(res.user));
      },
      error: () => this.loading.set(false),
    });
  }
}
