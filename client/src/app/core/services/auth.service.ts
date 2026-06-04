import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResult, User } from '../models';

const ACCESS_KEY = 'asta.accessToken';
const REFRESH_KEY = 'asta.refreshToken';

/** Auth state + session lifecycle. Exposes Signals for the view layer. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }
  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  /** Step 1 of signup: creates an unverified account + emails an OTP (no session yet). */
  register(name: string, email: string, password: string): Observable<{ pendingVerification: true; email: string }> {
    return this.api.post<{ pendingVerification: true; email: string }>('/auth/register', { name, email, password });
  }

  /** Step 2 of signup: verify the OTP code → starts a session. */
  verifyOtp(email: string, code: string): Observable<AuthResult> {
    return this.api
      .post<AuthResult>('/auth/verify-otp', { email, code })
      .pipe(tap((res) => this.applySession(res)));
  }

  resendOtp(email: string): Observable<{ sent: true }> {
    return this.api.post<{ sent: true }>('/auth/resend-otp', { email });
  }

  /** Allowed email domains for signup (drives the form hint + pre-check). */
  signupConfig(): Observable<{ allowedDomains: string[] }> {
    return this.api.get<{ allowedDomains: string[] }>('/auth/signup-config');
  }

  login(email: string, password: string): Observable<AuthResult | { pendingVerification: true; email: string }> {
    return this.api
      .post<AuthResult | { pendingVerification: true; email: string }>('/auth/login', { email, password })
      .pipe(tap((res) => { if ('user' in res) this.applySession(res); }));
  }

  /** Whether Google sign-in is configured + the client id to initialize GIS. */
  googleConfig(): Observable<{ enabled: boolean; clientId: string }> {
    return this.api.get<{ enabled: boolean; clientId: string }>('/auth/google/config');
  }

  /** Exchange a Google ID-token credential for an Asta session. */
  googleLogin(credential: string): Observable<AuthResult> {
    return this.api
      .post<AuthResult>('/auth/google', { credential })
      .pipe(tap((res) => this.applySession(res)));
  }

  /** Restores the session on app start from a stored token. */
  loadCurrentUser(): Observable<{ user: User }> {
    return this.api.get<{ user: User }>('/auth/me').pipe(tap((res) => this.user.set(res.user)));
  }

  logout(): void {
    this.api.post('/auth/logout').subscribe({ next: () => {}, error: () => {} });
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }

  clearSession(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.user.set(null);
  }

  /** Where to send the user after auth, based on role + onboarding state. */
  postAuthRoute(user: User): string {
    if (user.role === 'admin') return '/admin';
    // Onboarded students land on `/app`, where astaModeRedirectGuard resolves the
    // saved experience (Asta OS vs Classic) from localStorage.
    return user.isOnboarded ? '/app' : '/onboarding';
  }

  private applySession(res: AuthResult): void {
    this.setTokens(res.accessToken, res.refreshToken);
    this.user.set(res.user);
  }
}
