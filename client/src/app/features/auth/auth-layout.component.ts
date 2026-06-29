import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LogoComponent } from '../../shared/ui/logo.component';

/**
 * Cinematic auth shell. The ink panel is a living scene — drifting aurora
 * blooms, a slow dot-grid, floating agent glyphs and a draw-animated path —
 * telling the product story ("many agents, one path") before a single word of
 * copy. The form column floats on a soft glass sheet with a corner bloom.
 * Pure CSS motion; the global reduced-motion rule neutralizes all of it.
 */
@Component({
    selector: 'asta-auth-layout',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet, LogoComponent],
    template: `
    <div class="min-h-screen grid lg:grid-cols-[1.06fr_1fr]">
      <!-- Ink panel — the living scene -->
      <div class="scene relative hidden lg:flex flex-col justify-between p-10 overflow-hidden" style="background:var(--ink)">
        <!-- ambient layers -->
        <div class="bloom bloom-a" aria-hidden="true"></div>
        <div class="bloom bloom-b" aria-hidden="true"></div>
        <div class="dotgrid" aria-hidden="true"></div>

        <asta-logo class="relative z-10" [onDark]="true" [size]="32" />

        <div class="relative z-10 max-w-md">
          <p class="kicker mb-4" style="color:var(--green)">AI-native learning OS</p>
          <h2 class="text-onink" style="font-size:clamp(30px,3.2vw,44px);line-height:1.12">
            Learning is a long &amp; winding road.<br />
            <span class="grad-green">We turn it into a path.</span>
          </h2>
          <p class="text-onink-soft mt-4 text-[16.5px]" style="max-width:42ch">
            A personalized roadmap, an AI tutor, doubt-solving from your own notes,
            quizzes and real projects — orchestrated by agents that know your goal.
          </p>

          <!-- agent glyphs — the "many agents" story, floating gently -->
          <div class="agents mt-8" aria-hidden="true">
            @for (a of agents; track a.label; let i = $index) {
              <span class="agent" [style.animation-delay]="i * 0.7 + 's'">
                <span class="agent-ico">{{ a.glyph }}</span>{{ a.label }}
              </span>
            }
          </div>

          <!-- proof chips -->
          <div class="proof mt-9" aria-hidden="true">
            <span class="proof-chip"><span class="proof-dot"></span>11 agents, one companion</span>
            <span class="proof-chip"><span class="proof-dot"></span>Proof-of-learning ledger</span>
            <span class="proof-chip"><span class="proof-dot"></span>Verified skill passport</span>
          </div>
        </div>

        <!-- draw-animated winding path -->
        <svg class="path-svg absolute -right-10 bottom-0 w-[120%]" viewBox="0 0 500 300" fill="none" aria-hidden="true">
          <path class="path-line" d="M-20 280 C120 280, 160 60, 320 60 S 520 20, 520 20"
            stroke="var(--green)" stroke-width="2" stroke-dasharray="6 8" stroke-linecap="round" />
          <circle class="path-spark" r="4" fill="var(--green)">
            <animateMotion dur="9s" repeatCount="indefinite"
              path="M-20 280 C120 280, 160 60, 320 60 S 520 20, 520 20" />
          </circle>
        </svg>
      </div>

      <!-- Form column — glass sheet -->
      <div class="form-col relative flex items-center justify-center p-6 sm:p-10 overflow-hidden">
        <div class="form-bloom" aria-hidden="true"></div>
        <div class="form-card w-full relative z-10">
          <div class="lg:hidden mb-8"><asta-logo [size]="30" /></div>
          <router-outlet />
        </div>
      </div>
    </div>
  `,
    styles: [
        `
      /* ── living scene layers ─────────────────────────────────────────── */
      .bloom {
        position: absolute;
        width: 560px;
        height: 560px;
        border-radius: 50%;
        filter: blur(90px);
        opacity: 0.5;
        pointer-events: none;
      }
      .bloom-a {
        top: -180px;
        right: -120px;
        background: radial-gradient(circle, color-mix(in oklch, var(--green) 38%, transparent), transparent 70%);
        animation: bloomDrift 16s ease-in-out infinite alternate;
      }
      .bloom-b {
        bottom: -220px;
        left: -160px;
        background: radial-gradient(circle, color-mix(in oklch, var(--peri) 30%, transparent), transparent 70%);
        animation: bloomDrift 20s ease-in-out infinite alternate-reverse;
      }
      @keyframes bloomDrift {
        from { transform: translate(0, 0) scale(1); }
        to { transform: translate(60px, 40px) scale(1.12); }
      }
      .dotgrid {
        position: absolute;
        inset: -60px;
        pointer-events: none;
        opacity: 0.16;
        background-image: radial-gradient(oklch(1 0 0 / 0.5) 1px, transparent 1.5px);
        background-size: 26px 26px;
        animation: gridDrift 50s linear infinite;
      }
      @keyframes gridDrift {
        from { transform: translate(0, 0); }
        to { transform: translate(26px, 26px); }
      }

      /* ── agent glyph chips ───────────────────────────────────────────── */
      .agents { display: flex; flex-wrap: wrap; gap: 8px; max-width: 380px; }
      .agent {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 13px;
        border-radius: 999px;
        font-family: var(--mono);
        font-size: 11.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--on-ink-soft);
        background: oklch(1 0 0 / 0.06);
        border: 1px solid oklch(1 0 0 / 0.1);
        backdrop-filter: blur(8px);
        animation: agentFloat 5.5s ease-in-out infinite;
      }
      .agent-ico { font-size: 13px; }
      @keyframes agentFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }

      /* ── proof chips ─────────────────────────────────────────────────── */
      .proof { display: flex; flex-direction: column; gap: 9px; }
      .proof-chip {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        font-size: 13.5px;
        color: var(--on-ink-soft);
      }
      .proof-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--green);
        box-shadow: 0 0 12px color-mix(in oklch, var(--green) 60%, transparent);
        animation: astaPulse 2.6s ease-in-out infinite;
      }

      /* ── the winding path draws itself ───────────────────────────────── */
      .path-svg { opacity: 0.5; }
      .path-line {
        stroke-dashoffset: 700;
        animation: pathDraw 2.6s var(--ease) 0.3s forwards;
      }
      @keyframes pathDraw { to { stroke-dashoffset: 0; } }

      /* ── form column ─────────────────────────────────────────────────── */
      .form-bloom {
        position: absolute;
        top: -200px;
        right: -200px;
        width: 480px;
        height: 480px;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.55;
        pointer-events: none;
        background: radial-gradient(circle, color-mix(in oklch, var(--green) 16%, transparent), transparent 70%);
      }
      .form-card {
        max-width: 420px;
        animation: astaRevealUp 0.55s var(--ease) 0.1s both;
      }
      @media (min-width: 640px) {
        .form-card {
          padding: 36px 34px;
          border-radius: var(--r-lg);
          background:
            radial-gradient(140% 90% at 0% 0%, color-mix(in oklch, var(--paper-2) 65%, transparent), transparent 56%),
            color-mix(in oklch, var(--paper) 88%, transparent);
          border: 1px solid color-mix(in oklch, var(--paper-3) 80%, transparent);
          box-shadow: var(--shadow-md);
          backdrop-filter: blur(14px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .bloom-a, .bloom-b, .dotgrid, .agent, .proof-dot { animation: none; }
        .path-line { stroke-dashoffset: 0; animation: none; }
        .path-spark { display: none; }
      }
    `,
    ]
})
export class AuthLayoutComponent {
  /** The agent cast — storytelling, not data. */
  readonly agents = [
    { glyph: '🧭', label: 'Roadmap' },
    { glyph: '💬', label: 'Tutor' },
    { glyph: '📚', label: 'RAG' },
    { glyph: '✓', label: 'Quiz' },
    { glyph: '🛠', label: 'Projects' },
    { glyph: '🎯', label: 'Career' },
  ];
}
