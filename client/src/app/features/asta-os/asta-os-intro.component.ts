import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, output, signal } from '@angular/core';
import { AstaOsOrbComponent } from './asta-os-orb.component';

/**
 * Grand opening. A short, cinematic full-screen reveal when entering Asta OS:
 * the orb blooms, the wordmark draws in, then the whole thing lifts away to
 * reveal the cockpit. Self-dismisses (~2s) and emits `done`. Respects reduced
 * motion (collapses to a brief hold).
 */
@Component({
  selector: 'asta-os-intro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AstaOsOrbComponent],
  template: `
    <div class="intro" [class.out]="leaving()">
      <div class="rings" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="stage">
        <div class="orb-wrap"><asta-os-orb size="hero" state="agents-running" /></div>
        <h1 class="mark">Asta OS</h1>
        <p class="tag">Your AI learning operating system</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 100; display: block; }
      .intro { position: absolute; inset: 0; display: grid; place-items: center; overflow: hidden;
        background: radial-gradient(ellipse at 50% 42%, var(--asta-bg-soft), var(--asta-bg) 70%);
        animation: introIn .5s ease both; }
      .intro.out { animation: introOut .6s cubic-bezier(.4,0,.2,1) forwards; }
      @keyframes introIn { from { opacity: 0; } }
      @keyframes introOut { to { opacity: 0; transform: scale(1.06); filter: blur(6px); } }

      .rings { position: absolute; inset: 0; display: grid; place-items: center; }
      .rings span { position: absolute; width: 220px; height: 220px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--asta-green) 35%, transparent); animation: ripple 2.2s ease-out infinite; }
      .rings span:nth-child(2) { animation-delay: .5s; }
      .rings span:nth-child(3) { animation-delay: 1s; }
      @keyframes ripple { 0% { transform: scale(.4); opacity: .6; } 100% { transform: scale(2.6); opacity: 0; } }

      .stage { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; z-index: 1; }
      .orb-wrap { animation: bloom .9s cubic-bezier(.2,.8,.2,1) both; }
      @keyframes bloom { from { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.08); } to { transform: scale(1); opacity: 1; } }
      .mark { font-family: var(--display); font-size: clamp(34px, 7vw, 64px); font-weight: 700; letter-spacing: -0.02em;
        background: linear-gradient(120deg, var(--asta-text), var(--asta-green) 60%, var(--asta-cyan));
        -webkit-background-clip: text; background-clip: text; color: transparent;
        opacity: 0; animation: rise .7s ease .5s both; }
      .tag { font-size: 14px; color: var(--asta-muted); letter-spacing: .04em; opacity: 0; animation: rise .7s ease .8s both; }
      @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

      @media (prefers-reduced-motion: reduce) {
        .intro, .intro.out, .orb-wrap, .mark, .tag { animation: none; opacity: 1; }
        .rings { display: none; }
        .intro.out { opacity: 0; transition: opacity .2s; }
      }
    `,
  ],
})
export class AstaOsIntroComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly done = output<void>();
  protected readonly leaving = signal(false);

  ngOnInit(): void {
    const hold = setTimeout(() => this.leaving.set(true), 1700);
    const finish = setTimeout(() => this.done.emit(), 2300);
    this.destroyRef.onDestroy(() => {
      clearTimeout(hold);
      clearTimeout(finish);
    });
  }
}
