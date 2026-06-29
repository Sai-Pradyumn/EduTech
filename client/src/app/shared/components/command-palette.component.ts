import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ModalComponent } from '../ui/modal.component';
import { SearchComponent } from '../ui/search.component';
import { ADMIN_NAV, STUDENT_NAV } from '../../core/constants/nav';
import { AGENTS } from '../../core/constants/agents';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface Command {
  label: string;
  hint: string;
  route: string;
  group: string;
  /** When set, run this instead of navigating to `route`. */
  action?: () => void;
}

/**
 * Global command palette (⌘K / Ctrl+K). Fuzzy-ish filter over every app route +
 * agent page; arrow keys to move, Enter to go. Mounted once in AppComponent.
 */
@Component({
    selector: 'asta-command-palette',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ModalComponent, SearchComponent],
    template: `
    <asta-modal [open]="open()" align="top" [maxWidth]="600" (closed)="close()">
      @if (open()) {
        <div class="cmdk">
          <asta-search
            placeholder="Jump to… (type a page or agent)"
            [autofocus]="true"
            [debounceMs]="60"
            (valueChange)="query.set($event)"
            (keydown)="onKey($event)"
          />
          <div class="results">
            @for (c of results(); track c.route; let i = $index) {
              <button class="res" [class.active]="i === active()" (click)="run(c)" (mouseenter)="active.set(i)">
                <span class="res-label">{{ c.label }}</span>
                <span class="res-hint mono">{{ c.hint }}</span>
                <span class="res-group mono">{{ c.group }}</span>
              </button>
            } @empty {
              <p class="empty mono">No matches.</p>
            }
          </div>
          <div class="foot mono">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>
      }
    </asta-modal>
  `,
    styles: [
        `
      .cmdk { display: flex; flex-direction: column; gap: 12px; }
      .results { display: flex; flex-direction: column; gap: 2px; max-height: 46vh; overflow: auto; }
      .res {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 11px 12px;
        border-radius: var(--r-xs);
        border: 0;
        border-left: 2px solid transparent;
        background: transparent;
        text-align: left;
        cursor: pointer;
        transition: background 0.12s var(--ease), border-color 0.12s var(--ease), transform 0.12s var(--ease);
      }
      .res.active {
        background: color-mix(in oklch, var(--green) 14%, transparent);
        border-left-color: var(--green);
        transform: translateX(2px);
      }
      .res-label { font-size: 15px; color: var(--text); font-weight: 500; }
      .res-hint { margin-left: auto; font-size: 11.5px; color: var(--text-mute); }
      .res-group { font-size: 10.5px; color: var(--green-deep); text-transform: uppercase; letter-spacing: 0.08em; }
      .empty { padding: 18px 4px; color: var(--text-mute); font-size: 13px; }
      .foot { display: flex; gap: 18px; padding-top: 10px; border-top: 1px solid var(--paper-3); font-size: 11px; color: var(--text-mute); }
      kbd {
        font-family: var(--mono);
        font-size: 10px;
        padding: 1px 5px;
        border: 1px solid var(--paper-3);
        border-radius: 5px;
        margin-right: 3px;
        background: var(--paper-2);
      }
    `,
    ]
})
export class CommandPaletteComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);

  readonly open = signal(false);
  readonly query = signal('');
  readonly active = signal(0);

  private readonly all = computed<Command[]>(() => {
    const groups = this.auth.isAdmin() ? ADMIN_NAV : STUDENT_NAV;
    const navCmds: Command[] = groups.flatMap((g) =>
      g.items.map((it) => ({ label: it.label, hint: it.route.replace('/app/', '').replace('/', ''), route: it.route, group: g.heading })),
    );
    const agentCmds: Command[] = [
      { label: 'Ask the AI Tutor', hint: 'tutor', route: '/app/tutor', group: 'Agents' },
      { label: 'Mentor Room', hint: 'mentor', route: '/app/mentor-room', group: 'Agents' },
      { label: 'Doubt Solver', hint: 'doubt', route: '/app/doubt-solver', group: 'Agents' },
      { label: 'Career Coach', hint: 'career', route: '/app/career-coach', group: 'Agents' },
      { label: 'Study Notes', hint: AGENTS.content_creator.id, route: '/app/content-studio', group: 'Agents' },
    ];
    const actionCmds: Command[] = [
      { label: 'New learning flow', hint: 'create', route: '/app/flows/new', group: 'Actions' },
      { label: 'Toggle theme (light / dark)', hint: 'theme', route: '#theme', group: 'Actions', action: () => this.theme.cycle() },
      { label: 'Sign out', hint: 'logout', route: '#signout', group: 'Actions', action: () => this.auth.logout() },
    ];
    // de-dup by route
    const seen = new Set<string>();
    return [...navCmds, ...agentCmds, ...actionCmds].filter((c) => (seen.has(c.route) ? false : seen.add(c.route)));
  });

  readonly results = computed<Command[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.all();
    return this.all().filter((c) => (c.label + ' ' + c.hint + ' ' + c.group).toLowerCase().includes(q));
  });

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.toggle();
    }
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) {
      this.query.set('');
      this.active.set(0);
    }
  }

  close(): void {
    this.open.set(false);
  }

  onKey(e: KeyboardEvent): void {
    const max = this.results().length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.set(Math.min(max, this.active() + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.set(Math.max(0, this.active() - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = this.results()[this.active()];
      if (c) this.run(c);
    }
  }

  run(c: Command): void {
    this.close();
    if (c.action) { c.action(); return; }
    void this.router.navigateByUrl(c.route);
  }
}
