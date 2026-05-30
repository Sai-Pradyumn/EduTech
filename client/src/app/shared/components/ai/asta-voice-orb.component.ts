import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { VoiceState } from '../../../core/services/voice-activation.service';

/**
 * The Asta voice orb — a CSS/SVG identity element whose animation reflects the
 * voice state machine: ambient idle breathing, an animated waveform while
 * listening, an orbiting ring while thinking, and concentric ripples while
 * speaking. No images; reduced-motion collapses to a calm static orb.
 */
@Component({
  selector: 'asta-voice-orb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="orb-wrap" [attr.data-state]="state" [style.--orb-size.px]="size">
      <span class="halo"></span>
      <span class="ring"></span>
      <span class="core">
        @if (state === 'listening') {
          <span class="wave">
            @for (b of bars; track b) { <i [style.--i]="b"></i> }
          </span>
        } @else if (state === 'thinking') {
          <span class="spinner"></span>
        } @else {
          <span class="glyph"></span>
        }
      </span>
      @if (state === 'speaking') {
        <span class="ripple r1"></span>
        <span class="ripple r2"></span>
      }
    </div>
  `,
  styles: [
    `
      .orb-wrap {
        --orb-size: 132px;
        position: relative;
        width: var(--orb-size);
        height: var(--orb-size);
        display: grid;
        place-items: center;
        flex: none;
      }
      .core {
        position: relative;
        width: 64%;
        height: 64%;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 34% 28%, var(--green), var(--peri) 62%, var(--coral) 130%);
        box-shadow: 0 8px 30px color-mix(in oklch, var(--peri) 45%, transparent),
          inset 0 2px 8px oklch(1 0 0 / 0.4);
      }
      .halo {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle, color-mix(in oklch, var(--peri) 30%, transparent), transparent 68%);
        animation: breathe 3.6s var(--ease) infinite;
      }
      .ring {
        position: absolute;
        inset: 8%;
        border-radius: 50%;
        border: 1.5px solid color-mix(in oklch, var(--green) 45%, transparent);
        opacity: 0.6;
      }
      .glyph {
        width: 34%;
        height: 34%;
        border-radius: 50%;
        background: oklch(1 0 0 / 0.85);
        box-shadow: 0 0 14px oklch(1 0 0 / 0.6);
        animation: pulse 2.4s var(--ease) infinite;
      }
      /* Listening waveform */
      .wave {
        display: flex;
        align-items: center;
        gap: 3px;
        height: 40%;
      }
      .wave i {
        display: block;
        width: 3.5px;
        height: 20%;
        border-radius: 3px;
        background: oklch(1 0 0 / 0.92);
        animation: bar 0.9s ease-in-out infinite;
        animation-delay: calc(var(--i) * 0.09s);
      }
      /* Thinking spinner */
      .spinner {
        width: 42%;
        height: 42%;
        border-radius: 50%;
        border: 2.5px solid oklch(1 0 0 / 0.25);
        border-top-color: oklch(1 0 0 / 0.95);
        animation: spin 0.85s linear infinite;
      }
      /* Speaking ripples */
      .ripple {
        position: absolute;
        inset: 4%;
        border-radius: 50%;
        border: 1.5px solid color-mix(in oklch, var(--green) 60%, transparent);
        animation: ripple 1.8s var(--ease) infinite;
      }
      .ripple.r2 { animation-delay: 0.9s; }

      .orb-wrap[data-state='error'] .core {
        background: radial-gradient(circle at 34% 28%, var(--coral), var(--danger) 120%);
      }
      .orb-wrap[data-state='success'] .core {
        background: radial-gradient(circle at 34% 28%, var(--green), var(--green-deep) 120%);
      }

      @keyframes breathe { 0%, 100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.12); opacity: 1; } }
      @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.18); opacity: 1; } }
      @keyframes bar { 0%, 100% { height: 18%; } 50% { height: 95%; } }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes ripple { 0% { transform: scale(0.7); opacity: 0.8; } 100% { transform: scale(1.7); opacity: 0; } }

      @media (prefers-reduced-motion: reduce) {
        .halo, .glyph, .wave i, .spinner, .ripple { animation: none; }
        .spinner { border-top-color: oklch(1 0 0 / 0.6); }
      }
    `,
  ],
})
export class AstaVoiceOrbComponent {
  @Input() state: VoiceState = 'idle';
  @Input() size = 132;
  /** Static list to render the waveform bars (count only; values come from CSS). */
  readonly bars = [0, 1, 2, 3, 4, 5, 6];
}
