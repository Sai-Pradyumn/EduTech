import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ToastContainerComponent } from './shared/ui/toast-container.component';
import { ThemeService } from './core/services/theme.service';
import { CommandPaletteComponent } from './shared/components/command-palette.component';
import { ShortcutsOverlayComponent } from './shared/components/shortcuts-overlay.component';
import { AiDockComponent } from './shared/components/ai-dock.component';
import { AstaVoiceOverlayComponent } from './shared/components/ai/asta-voice-overlay.component';

@Component({
    selector: 'asta-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet, ToastContainerComponent, CommandPaletteComponent, ShortcutsOverlayComponent, AiDockComponent, AstaVoiceOverlayComponent],
    template: `
    <router-outlet />
    <asta-toast-container />
    <!-- Classic-only chrome: Asta OS is self-contained (its own dock, composer and voice room),
         so the floating dock / command palette / legacy voice overlay are hidden there. -->
    @if (!isAstaOs()) {
      <asta-command-palette />
      <asta-shortcuts-overlay />
      <asta-ai-dock />
      <asta-voice-overlay />
    }
  `
})
export class AppComponent {
  private readonly router = inject(Router);
  // Construct the theme controller at startup so its effect stays in sync app-wide.
  private readonly theme = inject(ThemeService);

  /** True while on an Asta OS route — used to suppress classic global chrome. */
  protected readonly isAstaOs = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.startsWith('/app/os')),
    ),
    { initialValue: this.router.url.startsWith('/app/os') },
  );
}
