import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { AuroraComponent } from '../shared/components/aurora.component';
import { ConstellationComponent } from '../shared/components/constellation.component';
import { RouteTransitionDirective } from '../shared/directives/route-transition.directive';
import { AuthService } from '../core/services/auth.service';
import { OrgContextService } from '../core/services/org-context.service';
import { DailyPlanService } from '../core/services/daily-plan.service';
import { EntitlementService } from '../core/services/entitlement.service';
import { FeatureFlagService } from '../core/services/feature-flag.service';
import { ProductAnalyticsService } from '../core/services/product-analytics.service';
import { NetworkStatusService } from '../core/services/network-status.service';
import { SyncQueueService } from '../core/services/sync-queue.service';
import { OfflineService } from '../core/services/offline.service';
import { ADMIN_NAV, ROUTE_PERMISSIONS, STUDENT_NAV, workspaceNav } from '../core/constants/nav';

/** App shell: fixed sidebar + sticky topbar + routed content (DESIGN_SPEC §5). */
@Component({
    selector: 'asta-shell',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, RouteTransitionDirective, SidebarComponent, TopbarComponent, AuroraComponent, ConstellationComponent],
    template: `
    <!-- Skip link (a11y §9) — first focusable; jumps past the nav to main content. -->
    <a href="#main-content" class="skip-link">Skip to content</a>
    <!-- Fixed-viewport split: the document never scrolls; the sidebar column and
         the main content column are each their own independent scroll region (A2). -->
    <div class="asta-shell relative lg:grid" style="grid-template-columns:var(--sidebar-w) 1fr">
      <!-- Desktop sidebar — own scroll region -->
      <div class="hidden lg:block h-dvh overflow-y-auto overscroll-contain scroll-area" style="border-right:1px solid var(--paper-3)">
        <asta-sidebar [nav]="nav()" [user]="user()" [isAdmin]="isAdmin()" (logout)="logout()" />
      </div>

      <!-- Mobile off-canvas drawer -->
      @if (drawerOpen()) {
        <div class="fixed inset-0 z-50 lg:hidden">
          <!-- Backdrop click is a mouse convenience; keyboard users close via ESC (onEsc) or in-drawer navigation. -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <div class="absolute inset-0" style="background:oklch(0.19 0.035 264 / .5)" (click)="drawerOpen.set(false)"></div>
          <div class="absolute left-0 top-0 h-full overflow-y-auto scroll-area">
            <asta-sidebar
              [nav]="nav()" [user]="user()" [isAdmin]="isAdmin()"
              (logout)="logout()" (navigate)="drawerOpen.set(false)"
            />
          </div>
        </div>
      }

      <!-- Content column — fixed height, topbar pinned, main scrolls independently -->
      <div class="relative flex flex-col h-dvh min-h-0 min-w-0">
        <!-- Ambient background pinned to the content column (so it never drifts
             with sidebar scroll) and tinted per-route via --bg-accent-* (A3). -->
        <div class="ambient" aria-hidden="true" [style]="ambientTint()">
          <asta-aurora [intensity]="0.5" scrollSelector="[data-asta-scroll]" />
          <asta-constellation [opacity]="0.4" />
        </div>

        <asta-topbar
          class="shrink-0 relative z-[2]"
          [title]="title()" [isAdmin]="isAdmin()" [streak]="dailyStreak()"
          (toggleMenu)="drawerOpen.set(true)"
        />
        <!-- Offline / pending-sync banner (M4) -->
        @if (!net.online() || sync.pendingCount()) {
          <a routerLink="/app/offline"
            class="shrink-0 relative z-[2] flex items-center gap-2 px-5 md:px-8 py-1.5 text-[12.5px] font-medium"
            [style.background]="net.online() ? 'var(--paper-2)' : 'color-mix(in oklch, var(--danger) 14%, var(--paper))'">
            <span class="w-1.5 h-1.5 rounded-full" [style.background]="net.online() ? 'var(--green)' : 'var(--danger)'"></span>
            @if (!net.online()) { <span>You’re offline — keep studying; changes sync on reconnect.</span> }
            @else { <span>{{ sync.pendingCount() }} change(s) waiting to sync →</span> }
          </a>
        }
        <main
          #mainScroll id="main-content" tabindex="-1" data-asta-scroll astaRouteTransition
          class="relative z-[1] flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-area"
        >
          <div class="px-5 md:px-8 py-6 md:py-8 mx-auto w-full pb-24 lg:pb-10" style="max-width:var(--maxw,1360px)">
            <router-outlet />
          </div>
        </main>
      </div>

      <!-- Mobile bottom-nav (B14 · PWA) — primary routes, hidden on desktop -->
      <nav class="botnav lg:hidden" aria-label="Primary">
        @for (item of bottomNav(); track item.route) {
          <a [routerLink]="item.route" routerLinkActive="bn-on" ariaCurrentWhenActive="page" class="bn">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="item.icon"></path></svg>
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>
    </div>
  `,
    styles: [
        `
      /* Root is a fixed-viewport split: nothing here scrolls — the sidebar and
         main columns own their scroll. h-dvh keeps it correct under mobile chrome. */
      .asta-shell {
        height: 100dvh;
        overflow: hidden;
      }
      /* Programmatic post-navigation focus moves into #main-content; don't paint
         a focus ring around the whole content region for that mouse/route case. */
      #main-content:focus { outline: none; }
      /* Ambient background is pinned (absolute) to the content column, behind it,
         so it stays put while main scrolls and never bleeds under the sidebar. */
      .ambient {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
      }
      /* Skip-to-content link: off-screen until focused (a11y §9). */
      .skip-link {
        position: fixed;
        top: 8px;
        left: 8px;
        z-index: 100;
        transform: translateY(-150%);
        background: var(--ink);
        color: var(--on-ink);
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        transition: transform 0.18s var(--ease);
      }
      .skip-link:focus { transform: translateY(0); }
      /* Mobile bottom navigation (PWA). MUST be hidden on desktop: the component
         style here outranks Tailwind's lg:hidden (scoped attr selector wins on
         specificity), so we own the hide/show entirely via this media query. */
      .botnav { display: none; }
      @media (max-width: 1023.98px) {
        .botnav {
          display: flex;
          justify-content: space-around;
          align-items: stretch;
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: calc(12px + env(safe-area-inset-bottom));
          z-index: 70;
          padding: 8px 6px;
          border-radius: 999px;
          background: color-mix(in oklch, var(--ink) 90%, transparent);
          backdrop-filter: blur(20px);
          border: 1px solid var(--paper-3);
          box-shadow: 0 20px 60px oklch(0 0 0 / 0.42);
        }
      }
      .bn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        flex: 1;
        padding: 6px 0;
        font-size: 10px;
        font-family: var(--mono);
        color: var(--text-mute);
        border-radius: 10px;
        transition: color 0.15s;
      }
      .bn-on {
        color: var(--green-deep);
      }
      /* Route enter transition (replayed by astaRouteTransition on each navigation) */
      .route-enter {
        animation: routeEnter 0.32s cubic-bezier(0.22, 1, 0.36, 1);
      }
      @keyframes routeEnter {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .route-enter {
          animation: none;
        }
      }
    `,
    ]
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly orgCtx = inject(OrgContextService);
  private readonly router = inject(Router);
  private readonly entitlements = inject(EntitlementService);
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly analytics = inject(ProductAnalyticsService);
  private readonly offline = inject(OfflineService);
  readonly net = inject(NetworkStatusService);
  readonly sync = inject(SyncQueueService);
  private readonly dailyPlan = inject(DailyPlanService);
  /** Canonical learning streak (same daily-plan streak the Today screen shows). */
  readonly dailyStreak = signal(0);
  private streakLoaded = false;

  readonly user = this.auth.user;
  readonly isAdmin = this.auth.isAdmin;
  readonly nav = computed(() => {
    const base = this.isAdmin() ? ADMIN_NAV : STUDENT_NAV;
    const isPlatformAdmin = this.orgCtx.isPlatformAdmin();
    // Hide screens whose backend rejects a plain student, so the sidebar can't route
    // the user into a guaranteed 403 (P0 — sidebar/authorization mismatch). The
    // route→permission map is shared with the command palette (ROUTE_PERMISSIONS).
    const canSee = (route: string): boolean => {
      const perm = ROUTE_PERMISSIONS[route];
      return !perm || this.orgCtx.has(perm);
    };
    const gated = base
      .map((group) => ({
        ...group,
        items: group.items.filter((it) => canSee(it.route)),
      }))
      .filter((group) => group.items.length > 0);
    return [
      ...gated,
      ...workspaceNav({
        hasOrg: this.orgCtx.orgs().length > 0,
        isPlatformAdmin,
        canMentor: this.orgCtx.has('student.view'),
        canReports: this.orgCtx.has('admin.reports.view'),
      }),
    ];
  });

  /** Primary routes for the mobile bottom-nav (students; admins use the drawer). */
  readonly bottomNav = computed(() => {
    if (this.isAdmin()) {
      return [
        { label: 'Home', route: '/admin', icon: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z' },
        { label: 'Students', route: '/admin/students', icon: 'M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
        { label: 'Analytics', route: '/admin/analytics', icon: 'M3 3v18h18M18 17V9M13 17V5M8 17v-3' },
      ];
    }
    return [
      { label: 'Home', route: '/app/dashboard', icon: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z' },
      { label: 'Tutor', route: '/app/tutor', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z' },
      { label: 'Roadmap', route: '/app/roadmap', icon: 'M4 19c0-8 7-14 16-14M4 19h.01M20 5h.01' },
      { label: 'Quizzes', route: '/app/quizzes', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
      { label: 'Progress', route: '/app/progress', icon: 'M3 3v18h18M7 15l4-4 3 3 5-6' },
    ];
  });

  /** The main content scroll container (A2) — reset to top on each navigation. */
  private readonly mainScroll = viewChild<ElementRef<HTMLElement>>('mainScroll');

  constructor() {
    this.orgCtx.load();
    // Phase 10: load entitlements + feature flags once so gates/flags resolve app-wide.
    this.featureFlags.load().subscribe({ error: () => undefined });
    void this.offline.refresh();
    effect(() => {
      if (this.user() && !this.isAdmin()) {
        this.entitlements.load().subscribe({ error: () => undefined });
        this.analytics.track('user_returned');
      }
    });
    // Canonical learning streak for the topbar (students only) — the same
    // daily-plan streak the Today screen features, so the two never disagree.
    // Fetched once; errors leave the streak at 0.
    effect(() => {
      if (this.user() && !this.isAdmin() && !this.streakLoaded) {
        this.streakLoaded = true;
        this.dailyPlan.streak().subscribe({
          next: (s) => this.dailyStreak.set(s.current),
          error: () => { this.streakLoaded = false; },
        });
      }
    });
    // Scroll-position restoration + a11y focus management: on every completed
    // navigation jump the main container to the top and (after the first load)
    // move focus into it, so keyboard/screen-reader users land on new content.
    effect(() => {
      const end = this.navEnd();
      const el = this.mainScroll()?.nativeElement;
      el?.scrollTo({ top: 0, behavior: 'auto' });
      if (end && !this.firstNav) el?.focus({ preventScroll: true });
      if (end) this.firstNav = false;
    });
  }

  private firstNav = true;

  private readonly navEnd = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)),
  );

  readonly drawerOpen = signal(false);

  /** Close the mobile drawer on ESC (keyboard parity with the backdrop click). */
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.drawerOpen()) this.drawerOpen.set(false);
  }

  /**
   * Per-route accent tint for the ambient background (A3): the dominant aurora
   * bloom shifts toward the active section's accent token, so the backdrop feels
   * connected to where you are. Falls back to the global accent elsewhere.
   */
  readonly ambientTint = computed<Record<string, string>>(() => {
    this.navEnd();
    const url = this.router.url;
    const section = (re: RegExp) => re.test(url);
    let accent = 'var(--accent)';
    if (section(/\/knowledge|\/roadmap/)) accent = 'var(--peri)';
    else if (section(/\/projects|\/quizzes/)) accent = 'var(--coral)';
    else if (section(/\/tutor|mentor-room|doubt-solver|career-coach|content-studio|\/voice-room/)) accent = 'var(--green)';
    return { '--bg-accent-1': accent };
  });

  /** Page title resolved from the deepest activated route's `title` data. */
  readonly title = computed(() => {
    this.navEnd();
    let route = this.router.routerState.snapshot.root;
    let t = '';
    while (route.firstChild) {
      route = route.firstChild;
      if (typeof route.data['title'] === 'string') t = route.data['title'];
    }
    return t;
  });

  logout(): void {
    this.auth.logout();
  }
}
