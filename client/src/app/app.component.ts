import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/ui/toast-container.component';
import { ThemeService } from './core/services/theme.service';
import { CommandPaletteComponent } from './shared/components/command-palette.component';
import { AiDockComponent } from './shared/components/ai-dock.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastContainerComponent, CommandPaletteComponent, AiDockComponent],
  template: `
    <router-outlet />
    <asta-toast-container />
    <asta-command-palette />
    <asta-ai-dock />
  `,
})
export class AppComponent {
  // Construct the theme controller at startup so its effect stays in sync app-wide.
  private readonly theme = inject(ThemeService);
}
