import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { VoiceActivationService } from '../../core/services/voice-activation.service';
import { AstaOrbState } from './asta-os.types';
import { AstaOsFaceModeComponent } from './asta-os-face-mode.component';

/**
 * "Face Asta" — a fullscreen mentor-call experience. Asta is an expressive orb
 * avatar (listening / thinking / speaking) with live captions, driven by the
 * same voice loop. The learner's camera is optional (real getUserMedia preview,
 * a corner tile) — a clean seam for future realtime avatar/video providers.
 */
@Component({
  selector: 'asta-os-face-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'asta-os-root' },
  imports: [AstaOsFaceModeComponent],
  template: `
    <div class="room">
      <header class="bar">
        <span class="brand">Asta · Face</span>
        <div class="right">
          <button type="button" class="chip" [class.on]="cameraOn()" (click)="toggleCamera()">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7zM1 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H1z" /></svg>
            {{ cameraOn() ? 'Camera on' : 'Camera off' }}
          </button>
          <button type="button" class="close" (click)="close.emit()" aria-label="Leave face mode">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </header>

      <div class="stage">
        <asta-os-face-mode [state]="orbState()" [caption]="caption()" />
        @if (cameraError(); as err) { <p class="cam-err">{{ err }}</p> }
      </div>

      <video #cam class="cam-tile" [class.show]="cameraOn()" autoplay muted playsinline aria-label="Your camera"></video>

      <footer class="controls">
        <button
          type="button"
          class="mic"
          [class.live]="voice.state() === 'listening'"
          [disabled]="!voice.supported"
          (click)="voice.activate()"
          aria-label="Talk to Asta"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>
        @if (!voice.supported) { <p class="privacy">Voice isn’t supported here — type to Asta in chat instead.</p> }
        @else { <p class="privacy">Like sitting with a mentor. Your camera is optional and never leaves your device.</p> }
      </footer>
    </div>
  `,
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 85; display: block; }
      .room { position: absolute; inset: 0; display: flex; flex-direction: column; background: radial-gradient(ellipse at 50% 35%, var(--asta-bg-soft), var(--asta-bg)); }
      .bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; }
      .brand { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--asta-muted); }
      .right { display: flex; align-items: center; gap: 10px; }
      .chip { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--asta-muted); padding: 6px 12px; border-radius: 999px; border: 1px solid var(--asta-border); }
      .chip.on { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .close { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; color: var(--asta-muted); }
      .close:hover { color: var(--asta-text); background: var(--asta-panel); }

      .stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 24px; }
      .cam-err { font-size: 12.5px; color: var(--asta-gold); margin-top: 8px; }

      .cam-tile { position: absolute; right: 22px; bottom: 110px; width: 200px; aspect-ratio: 4/3; object-fit: cover; border-radius: 14px; border: 1px solid var(--asta-border); background: #000; transform: scaleX(-1); opacity: 0; pointer-events: none; transition: opacity .25s ease; box-shadow: 0 20px 50px rgba(0,0,0,.5); }
      .cam-tile.show { opacity: 1; }

      .controls { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 18px 24px 34px; }
      .mic { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 999px; color: var(--asta-text); border: 1px solid var(--asta-border); background: var(--asta-panel); transition: transform .16s ease, background .16s ease, box-shadow .2s ease; }
      .mic:hover:not(:disabled) { transform: translateY(-2px); }
      .mic:disabled { opacity: .4; cursor: default; }
      .mic.live { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); box-shadow: 0 0 30px color-mix(in srgb, var(--asta-green) 55%, transparent); }
      .privacy { font-size: 11.5px; color: var(--asta-subtle); max-width: 460px; text-align: center; }

      /* The room fades up; the live mic breathes like held attention. */
      .room { animation: faceRoomIn .5s var(--ease) both; }
      @keyframes faceRoomIn { from { opacity: 0; } }
      .stage, .controls { animation: astaRevealUp .55s var(--ease) .1s both; }
      .cam-tile.show { animation: camIn .35s var(--ease-spring) both; }
      @keyframes camIn { from { transform: scaleX(-1) scale(.85); } to { transform: scaleX(-1) scale(1); } }
      .mic.live { animation: faceMicBreathe 1.6s ease-in-out infinite; }
      @keyframes faceMicBreathe {
        0%, 100% { box-shadow: 0 0 30px color-mix(in srgb, var(--asta-green) 55%, transparent); }
        50% { box-shadow: 0 0 48px color-mix(in srgb, var(--asta-green) 85%, transparent); }
      }
      @media (prefers-reduced-motion: reduce) { .room, .stage, .controls, .cam-tile.show, .mic.live { animation: none; } }
    `,
  ],
})
export class AstaOsFaceRoomComponent {
  protected readonly voice = inject(VoiceActivationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly close = output<void>();

  private readonly cam = viewChild<ElementRef<HTMLVideoElement>>('cam');
  protected readonly cameraOn = signal(false);
  protected readonly cameraError = signal<string | null>(null);
  private stream?: MediaStream;

  private readonly map: Record<string, AstaOrbState> = {
    idle: 'idle', consent: 'idle', listening: 'listening', thinking: 'thinking',
    speaking: 'speaking', confirm: 'warning', success: 'success', error: 'error',
  };
  protected readonly orbState = computed<AstaOrbState>(() => this.map[this.voice.state()] ?? 'idle');
  protected readonly caption = computed(() => this.voice.response() || this.voice.transcript() || null);

  constructor() {
    this.destroyRef.onDestroy(() => this.stopCamera());
  }

  protected async toggleCamera(): Promise<void> {
    if (this.cameraOn()) {
      this.stopCamera();
      return;
    }
    this.cameraError.set(null);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const el = this.cam()?.nativeElement;
      if (el) el.srcObject = this.stream;
      this.cameraOn.set(true);
    } catch {
      this.cameraError.set('Camera permission was declined or unavailable.');
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    const el = this.cam()?.nativeElement;
    if (el) el.srcObject = null;
    this.cameraOn.set(false);
  }
}
