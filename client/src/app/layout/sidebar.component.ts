import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LogoComponent } from '../shared/ui/logo.component';
import { NavGroup } from '../core/constants/nav';
import { User } from '../core/models';
import { I18nService } from '../core/services/i18n.service';
import { TranslationKey } from '../core/i18n/translations';

/** Fixed ink sidebar with grouped nav + user mini-card (DESIGN_SPEC §5). */
@Component({
    selector: 'asta-sidebar',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, RouterLinkActive, LogoComponent],
    template: `
    <aside
      class="flex flex-col h-full text-onink-soft"
      style="background:var(--ink);width:var(--sidebar-w)"
    >
      <div class="flex items-center justify-between px-5 pt-5 pb-4">
        <a [routerLink]="isAdmin ? '/admin' : '/app/dashboard'" class="text-onink">
          <asta-logo [onDark]="true" />
        </a>
        @if (isAdmin) {
          <span class="font-mono text-[10px] tracking-widest uppercase text-onink-mute">Admin</span>
        }
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-2">
        @for (group of nav; track group.heading) {
          <p class="px-3 mt-4 mb-2 font-mono text-[10.5px] tracking-widest uppercase text-onink-mute">
            {{ headingLabel(group.heading) }}
          </p>
          @for (item of group.items; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="nav-active"
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: item.route === '/admin' }"
              (click)="navigate.emit()"
              class="nav-item group relative flex items-center gap-3 px-3 py-2.5 rounded-[12px] mb-0.5 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
                stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path [attr.d]="item.icon" />
              </svg>
              <span class="text-[14.5px] font-medium">{{ item.label }}</span>
            </a>
          }
        }
      </nav>

      @if (user) {
        <div class="m-3 p-3 rounded-[14px] flex items-center gap-3" style="background:var(--ink-2)">
          <span class="grid place-items-center w-9 h-9 rounded-full font-display font-semibold text-ink"
            style="background:oklch(0.88 0.04 150)">{{ initial }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-[13.5px] font-semibold text-onink truncate">{{ user.name }}</p>
            <p class="text-[11.5px] text-onink-mute capitalize">{{ user.role }}</p>
          </div>
          <button (click)="logout.emit()" class="text-onink-mute hover:text-onink" aria-label="Log out" title="Log out">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      }
    </aside>
  `,
    styles: [
        `
      .nav-item { transition: background 0.18s var(--ease), color 0.18s var(--ease), transform 0.12s var(--ease-spring); }
      .nav-item:hover { background: var(--ink-2); color: var(--on-ink); }
      .nav-item:active { transform: scale(0.98); }
      .nav-item svg { transition: transform 0.25s var(--ease-spring); }
      .nav-item:hover svg { transform: translateX(2px) scale(1.08); }
      .nav-active {
        background: var(--ink-2);
        color: var(--on-ink);
      }
      .nav-active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 8px;
        bottom: 8px;
        width: 3px;
        border-radius: 3px;
        background: var(--green);
        box-shadow: 0 0 8px color-mix(in oklch, var(--green) 55%, transparent);
        transform-origin: center;
        animation: navGlide 0.3s var(--ease-spring);
      }
      @keyframes navGlide {
        from { opacity: 0; transform: scaleY(0.25); }
        to { opacity: 1; transform: scaleY(1); }
      }
      .nav-active svg { color: var(--green); }
      @media (prefers-reduced-motion: reduce) {
        .nav-active::before { animation: none; }
      }
    `,
    ]
})
export class SidebarComponent {
  @Input({ required: true }) nav: NavGroup[] = [];
  @Input() user: User | null = null;
  @Input() isAdmin = false;
  @Output() logout = new EventEmitter<void>();
  @Output() navigate = new EventEmitter<void>();

  private readonly i18n = inject(I18nService);
  private readonly headingKeys: Record<string, TranslationKey> = {
    Learn: 'nav.learn',
    Account: 'nav.account',
    Workspace: 'nav.workspace',
    Manage: 'nav.manage',
  };

  /** Translate known nav group headings; unknown headings pass through unchanged. */
  headingLabel(heading: string): string {
    const key = this.headingKeys[heading];
    return key ? this.i18n.t(key) : heading;
  }

  get initial(): string {
    return (this.user?.name?.trim()[0] ?? 'A').toUpperCase();
  }
}
