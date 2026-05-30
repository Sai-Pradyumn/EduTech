import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { OrgService } from './org.service';
import { MyOrg, OrgContext } from '../models';

const ACTIVE_ORG_KEY = 'asta.activeOrg';

/**
 * Holds the user's organizations + the active-org permission context, and persists the
 * active org id to localStorage (read by the auth interceptor as the x-org-id header).
 * Drives permission-gated nav + UI.
 */
@Injectable({ providedIn: 'root' })
export class OrgContextService {
  private readonly auth = inject(AuthService);
  private readonly orgApi = inject(OrgService);

  readonly orgs = signal<MyOrg[]>([]);
  readonly activeOrgId = signal<string | null>(localStorage.getItem(ACTIVE_ORG_KEY));
  readonly context = signal<OrgContext | null>(null);
  readonly loaded = signal(false);

  readonly isPlatformAdmin = computed(() => this.auth.user()?.isPlatformAdmin === true);
  readonly activeOrg = computed(() => this.orgs().find((o) => o.id === this.activeOrgId()) ?? null);
  readonly permissions = computed(() => this.context()?.permissions ?? []);

  has(permission: string): boolean {
    return this.isPlatformAdmin() || this.permissions().includes(permission);
  }

  /** Load memberships + context. Safe to call repeatedly; no-op without a session. */
  load(): void {
    if (!this.auth.isAuthenticated()) return;
    this.orgApi.mine().subscribe({
      next: (orgs) => {
        this.orgs.set(orgs);
        const stored = this.activeOrgId();
        const valid = stored && orgs.some((o) => o.id === stored);
        const next = valid ? stored : orgs[0]?.id ?? null;
        this.setActive(next, false);
        this.refreshContext();
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  switchOrg(id: string): void {
    this.setActive(id, true);
    this.refreshContext();
  }

  private refreshContext(): void {
    if (!this.auth.isAuthenticated()) return;
    this.orgApi.context().subscribe({ next: (c) => this.context.set(c), error: () => this.context.set(null) });
  }

  private setActive(id: string | null, persist: boolean): void {
    this.activeOrgId.set(id);
    if (id) localStorage.setItem(ACTIVE_ORG_KEY, id);
    else localStorage.removeItem(ACTIVE_ORG_KEY);
    if (persist) {
      /* refreshContext handles reload */
    }
  }
}
