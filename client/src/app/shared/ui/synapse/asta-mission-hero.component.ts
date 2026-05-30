import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Asta Synapse — Mission Hero. A cinematic, lit panel that frames what a screen
 * helps the learner accomplish (NOT a plain page header). Left: eyebrow + title +
 * subtitle + projected action buttons. Right: an animated orb cluster + a
 * "next best action" brief card. Used on every primary screen.
 */
@Component({
  selector: 'asta-mission-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero motion-reveal">
      <div class="copy">
        <div class="eyebrow">
          <span class="pulse"></span>
          {{ eyebrow() }}
        </div>
        <h1 class="title">{{ title() }}</h1>
        @if (subtitle()) { <p class="subtitle">{{ subtitle() }}</p> }
        <div class="actions"><ng-content /></div>
      </div>

      <div class="visual" aria-hidden="true">
        <div class="orb-cluster">
          <span class="orb orb-main"></span>
          <span class="orb orb-sm one"></span>
          <span class="orb orb-sm two"></span>
          <span class="ring"></span>
        </div>
        @if (briefValue()) {
          <div class="brief">
            <span>{{ briefLabel() }}</span>
            <strong>{{ briefValue() }}</strong>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .hero {
        position: relative;
        overflow: hidden;
        border-radius: var(--r-xl);
        padding: 34px;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
        gap: 32px;
        color: #fff;
        background:
          radial-gradient(circle at 84% 18%, var(--asta-glow-cyan), transparent 32%),
          radial-gradient(circle at 14% 92%, var(--asta-glow-violet), transparent 34%),
          linear-gradient(135deg, var(--asta-hero-1) 0%, var(--asta-hero-2) 48%, var(--asta-hero-3) 100%);
        box-shadow: var(--shadow-lg);
      }
      .hero::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(circle, rgba(255, 255, 255, 0.15) 1px, transparent 1px);
        background-size: 30px 30px;
        opacity: 0.16;
        -webkit-mask-image: linear-gradient(90deg, #000, transparent 76%);
        mask-image: linear-gradient(90deg, #000, transparent 76%);
      }
      .hero::after {
        content: '';
        position: absolute;
        right: -120px;
        bottom: -160px;
        width: 420px;
        height: 420px;
        border-radius: 999px;
        background: radial-gradient(circle, var(--asta-accent-glow), transparent 66%);
        filter: blur(8px);
      }
      .copy, .visual { position: relative; z-index: 1; }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 13px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.82);
        font-family: var(--mono);
        font-size: 12px;
        letter-spacing: 0.06em;
      }
      .pulse {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--asta-cyan);
        box-shadow: 0 0 0 6px rgba(34, 211, 238, 0.12);
        animation: astaPulse 2.2s ease-in-out infinite;
      }
      .title {
        font-family: var(--display);
        font-weight: 600;
        font-size: clamp(28px, 3.4vw, 42px);
        line-height: 1.08;
        letter-spacing: -0.025em;
        margin: 16px 0 0;
        color: #fff;
        text-wrap: balance;
      }
      .subtitle { color: rgba(255, 255, 255, 0.74); margin-top: 12px; max-width: 52ch; font-size: 15.5px; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }

      .visual { display: flex; flex-direction: column; justify-content: space-between; gap: 18px; }
      .orb-cluster { position: relative; height: 150px; }
      .orb { position: absolute; border-radius: 999px; }
      .orb-main {
        top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 84px; height: 84px;
        background:
          radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.95), transparent 20%),
          conic-gradient(from 120deg, var(--asta-blue), var(--asta-cyan), var(--asta-violet), var(--asta-emerald), var(--asta-blue));
        box-shadow: 0 0 48px var(--asta-glow-blue), 0 0 90px var(--asta-glow-cyan);
        animation: astaOrbitSpin 22s linear infinite;
      }
      .orb-sm { width: 18px; height: 18px; background: #fff; opacity: 0.85; }
      .orb-sm.one { top: 22%; left: 72%; box-shadow: 0 0 18px var(--asta-cyan); }
      .orb-sm.two { top: 70%; left: 26%; box-shadow: 0 0 18px var(--asta-violet); }
      .ring {
        position: absolute; inset: 50% auto auto 50%;
        width: 150px; height: 150px; transform: translate(-50%, -50%);
        border-radius: 999px; border: 1px dashed rgba(255, 255, 255, 0.2);
        animation: astaOrbitSpin 30s linear infinite reverse;
      }
      .brief {
        display: grid; gap: 4px;
        padding: 16px 18px;
        border-radius: var(--r-md);
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(8px);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }
      .brief span { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255, 255, 255, 0.6); }
      .brief strong { font-size: 16px; font-weight: 600; color: #fff; }

      @media (max-width: 880px) {
        .hero { grid-template-columns: 1fr; padding: 24px; border-radius: var(--r-lg); }
        .orb-cluster { height: 120px; }
      }
    `,
  ],
})
export class AstaMissionHeroComponent {
  readonly eyebrow = input<string>('AI learning system active');
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly briefLabel = input<string>('Next best action');
  readonly briefValue = input<string>('');
}
