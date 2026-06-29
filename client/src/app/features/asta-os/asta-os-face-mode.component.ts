import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AstaOrbState } from './asta-os.types';
import { AstaOsOrbComponent } from './asta-os-orb.component';

/**
 * "Face Asta" — an MVP avatar surface that feels like sitting across from a
 * mentor. The hero orb carries the expression (listening / thinking / speaking)
 * and the latest line shows as a caption. No paid avatar/WebRTC provider yet;
 * this is a clean seam for a future realtime voice/video provider.
 */
@Component({
    selector: 'asta-os-face-mode',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AstaOsOrbComponent],
    template: `
    <div class="face">
      <div class="halo"><asta-os-orb [state]="state()" size="hero" /></div>
      <p class="status">{{ statusLabel() }}</p>
      @if (caption(); as c) {
        <p class="caption" aria-live="polite">{{ c }}</p>
      } @else {
        <p class="caption muted">Say hello, or ask Asta to teach you something.</p>
      }
    </div>
  `,
    styles: [
        `
      .face { display: flex; flex-direction: column; align-items: center; gap: 22px; padding: 32px 16px; text-align: center; }
      .halo { padding: 26px; border-radius: 999px; background: radial-gradient(circle, color-mix(in srgb, var(--asta-green) 12%, transparent), transparent 70%); }
      .status { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--asta-muted); }
      .caption { max-width: 560px; font-size: 17px; line-height: 1.5; color: var(--asta-text); }
      .caption.muted { color: var(--asta-subtle); }
    `,
    ]
})
export class AstaOsFaceModeComponent {
  readonly state = input<AstaOrbState>('idle');
  readonly caption = input<string | null>(null);

  private readonly labels: Record<AstaOrbState, string> = {
    idle: 'Ready when you are',
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
    'agents-running': 'Working on it…',
    success: 'Done',
    warning: 'One moment',
    error: 'Let’s try that again',
  };
  protected statusLabel(): string {
    return this.labels[this.state()];
  }
}
