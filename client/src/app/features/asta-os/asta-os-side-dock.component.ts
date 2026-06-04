import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AstaModeService } from '../../core/services/asta-mode.service';
import { AstaOsOrbComponent } from './asta-os-orb.component';
import { ASTA_TOOLS, AstaTool } from './asta-os-tools';

interface DockRoute {
  readonly label: string;
  readonly route: string;
  readonly icon: string;
}

/**
 * Collapsed vertical rail — the only chrome in Asta OS. Everything stays inside:
 * Asta OS routes (cockpit / practice / notebook) and native tool panels. The only
 * deliberate way out is the Classic switch at the bottom.
 */
@Component({
  selector: 'asta-os-side-dock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, AstaOsOrbComponent],
  template: `
    <nav class="dock" aria-label="Asta OS">
      <div class="brand"><asta-os-orb size="sm" /></div>

      <div class="items">
        @for (it of routes; track it.route) {
          <a [routerLink]="it.route" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="item">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="it.icon" /></svg>
            <span class="tip">{{ it.label }}</span>
          </a>
        }
        <span class="div"></span>
        @for (it of tools; track it.id) {
          <button type="button" class="item" (click)="openTool.emit(it.id)" [attr.aria-label]="it.label">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="it.icon" /></svg>
            <span class="tip">{{ it.label }}</span>
          </button>
        }
      </div>

      <div class="foot">
        <button type="button" class="item" (click)="toClassic()" aria-label="Switch to Classic Mode">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" /></svg>
          <span class="tip">Classic</span>
        </button>
      </div>
    </nav>
  `,
  styles: [
    `
      .dock { display: flex; flex-direction: column; align-items: center; gap: 14px; height: 100%; padding: 16px 10px; }
      .brand { padding: 4px 0 4px; }
      .items, .foot { display: flex; flex-direction: column; gap: 6px; width: 100%; align-items: center; }
      .items { flex: 1; overflow-y: auto; overflow-x: visible; scrollbar-width: none; }
      .items::-webkit-scrollbar { width: 0; }
      .div { width: 24px; height: 1px; background: var(--asta-border); margin: 6px 0; }
      .item { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 13px; color: var(--asta-muted); transition: color .16s ease, background .16s ease; }
      .item:hover { color: var(--asta-text); background: var(--asta-panel); }
      .item.active { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); }
      .tip { position: absolute; left: calc(100% + 10px); white-space: nowrap; font-size: 12px; padding: 4px 9px; border-radius: 8px; background: var(--asta-bg-elevated); border: 1px solid var(--asta-border); color: var(--asta-text); opacity: 0; transform: translateX(-4px); pointer-events: none; transition: opacity .16s ease, transform .16s ease; z-index: 20; }
      .item:hover .tip, .item:focus-visible .tip { opacity: 1; transform: translateX(0); }
    `,
  ],
})
export class AstaOsSideDockComponent {
  private readonly mode = inject(AstaModeService);
  private readonly router = inject(Router);
  readonly openTool = output<string>();

  protected readonly routes: DockRoute[] = [
    { label: 'Asta', route: '/app/os', icon: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3' },
    { label: 'Practice', route: '/app/os/practice', icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
    { label: 'Notebook', route: '/app/os/notebook', icon: 'M4 4h16v12H4zM2 20h20M9 9l2 2 4-4' },
  ];
  /** All native panel tools, straight from the registry. */
  protected readonly tools: AstaTool[] = ASTA_TOOLS.filter((t) => t.kind === 'panel');

  protected toClassic(): void {
    this.mode.set('classic');
    void this.router.navigateByUrl('/app/dashboard');
  }
}
