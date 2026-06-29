import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../shared/ui/logo.component';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle.component';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { BillingService } from '../../core/services/billing.service';
import { Plan } from '../../core/models';

/**
 * Public pricing page (B5) — full marketing rebuild. Cinematic hero, featured
 * plan card, "every plan includes" strip, FAQ and a closing CTA band. Reads the
 * same plan catalog; every CTA routes to /register. Pure CSS motion, neutralized
 * globally under prefers-reduced-motion.
 */
@Component({
    selector: 'asta-pricing',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, LogoComponent, ThemeToggleComponent, MagneticDirective],
    template: `
    <div class="pr-root">
      <!-- ambient -->
      <div class="pr-bloom pr-bloom-a" aria-hidden="true"></div>
      <div class="pr-bloom pr-bloom-b" aria-hidden="true"></div>

      <nav class="pr-nav">
        <a routerLink="/"><asta-logo [size]="28" /></a>
        <div class="flex items-center gap-3">
          <asta-theme-toggle />
          <a routerLink="/login" class="text-sm font-semibold text-txt-soft hover:text-txt">Log in</a>
          <a routerLink="/register" class="pr-nav-cta">Get started</a>
        </div>
      </nav>

      <!-- hero -->
      <header class="pr-hero">
        <p class="kicker justify-center mb-4">PRICING</p>
        <h1 class="grad-flow" style="font-size:clamp(36px,5.2vw,60px);line-height:1.1">
          Start free. Upgrade<br />when you're ready.
        </h1>
        <p class="text-txt-soft mt-5 text-lg" style="max-width:52ch;margin-inline:auto">
          Every plan runs on the full agent OS — roadmap, tutor, quizzes, proof ledger and
          skill passport included. Mock payment mode: no real charge in the demo.
        </p>
        <div class="pr-trust" aria-hidden="true">
          <span class="pr-trust-chip"><span class="dot"></span>No credit card to start</span>
          <span class="pr-trust-chip"><span class="dot"></span>Cancel anytime</span>
          <span class="pr-trust-chip"><span class="dot"></span>11 AI agents on every plan</span>
        </div>
      </header>

      <!-- plans -->
      <div class="pr-grid">
        @for (p of plans(); track p.id; let i = $index) {
          <div class="pr-card" [class.pr-featured]="p.highlight" [style.animation-delay]="0.08 * i + 's'">
            @if (p.highlight) { <span class="pr-pop">Most popular</span> }
            <h3 class="font-display text-2xl">{{ p.name }}</h3>
            <p class="pr-price">
              <span class="pr-amount">₹{{ p.priceInr }}</span><span class="pr-per">/mo</span>
            </p>
            <p class="text-sm text-txt-soft mt-1">{{ p.tagline }}</p>
            <ul class="pr-feats">
              @for (f of p.features; track f) {
                <li><span class="pr-tick">✓</span>{{ f }}</li>
              }
            </ul>
            <a routerLink="/register" astaMagnetic class="pr-cta" [class.pr-cta-accent]="p.highlight">
              {{ p.priceInr === 0 ? 'Start free' : 'Get ' + p.name }} <span class="arr">→</span>
            </a>
          </div>
        } @empty {
          @for (n of [0, 1, 2]; track n) {
            <div class="pr-card" [style.animation-delay]="0.08 * n + 's'">
              <span class="skel" style="width:50%;height:24px;margin-bottom:12px"></span>
              <span class="skel" style="width:40%;height:36px;margin-bottom:12px"></span>
              <span class="skel" style="width:90%;height:14px;margin-bottom:8px"></span>
              <span class="skel" style="width:75%;height:14px"></span>
            </div>
          }
        }
      </div>

      <!-- every plan includes -->
      <section class="pr-incl">
        <p class="kicker justify-center mb-8">EVERY PLAN INCLUDES</p>
        <div class="pr-incl-grid">
          @for (x of included; track x.title) {
            <div class="pr-incl-item">
              <span class="pr-incl-ico" aria-hidden="true">{{ x.glyph }}</span>
              <div>
                <p class="font-semibold text-[15px]">{{ x.title }}</p>
                <p class="text-sm text-txt-soft mt-0.5">{{ x.desc }}</p>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- FAQ -->
      <section class="pr-faq">
        <p class="kicker justify-center mb-8">QUESTIONS</p>
        <div class="pr-faq-list">
          @for (f of faqs; track f.q) {
            <details class="pr-faq-item">
              <summary>{{ f.q }}<span class="pr-faq-chev" aria-hidden="true">＋</span></summary>
              <p>{{ f.a }}</p>
            </details>
          }
        </div>
      </section>

      <!-- closing CTA -->
      <section class="pr-band">
        <div class="pr-band-inner">
          <h2 class="text-onink" style="font-size:clamp(26px,3.4vw,40px)">Your goal deserves a path.</h2>
          <p class="text-onink-soft mt-2">Create a free account and generate your first roadmap in minutes.</p>
          <a routerLink="/register" astaMagnetic class="pr-band-cta">Start free <span class="arr">→</span></a>
        </div>
      </section>
    </div>
  `,
    styles: [
        `
      .pr-root { position: relative; min-height: 100vh; background: var(--paper); color: var(--text); overflow-x: clip; }

      /* ambient blooms */
      .pr-bloom { position: absolute; width: 640px; height: 640px; border-radius: 50%; filter: blur(110px); opacity: 0.4; pointer-events: none; }
      .pr-bloom-a { top: -260px; right: -180px; background: radial-gradient(circle, color-mix(in oklch, var(--green) 26%, transparent), transparent 70%); }
      .pr-bloom-b { top: 480px; left: -260px; background: radial-gradient(circle, color-mix(in oklch, var(--peri) 20%, transparent), transparent 70%); }

      /* nav */
      .pr-nav {
        position: sticky; top: 0; z-index: 20;
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 24px; margin-inline: auto; max-width: var(--maxw-content);
        backdrop-filter: blur(14px);
        background: color-mix(in oklch, var(--paper) 72%, transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--paper-3) 60%, transparent);
      }
      .pr-nav-cta {
        font-size: 13.5px; font-weight: 700; padding: 9px 18px; border-radius: 999px;
        background: var(--green); color: var(--ink);
        transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease);
      }
      .pr-nav-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 26px var(--asta-accent-glow); }

      /* hero */
      .pr-hero { position: relative; z-index: 1; text-align: center; padding: 72px 24px 56px; animation: astaRevealUp 0.55s var(--ease) both; }
      .pr-trust { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 26px; }
      .pr-trust-chip {
        display: inline-flex; align-items: center; gap: 8px;
        font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.12em; text-transform: uppercase;
        color: var(--text-soft); padding: 8px 14px; border-radius: 999px;
        border: 1px solid var(--paper-3); background: color-mix(in oklch, var(--paper-2) 70%, transparent);
      }
      .pr-trust-chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); }

      /* plan grid */
      .pr-grid {
        position: relative; z-index: 1;
        display: grid; gap: 18px; padding: 0 24px 30px; margin-inline: auto; max-width: 1080px;
      }
      @media (min-width: 768px) { .pr-grid { grid-template-columns: repeat(3, 1fr); align-items: stretch; } }
      .pr-card {
        position: relative; display: flex; flex-direction: column; padding: 28px 26px;
        border-radius: var(--r-lg);
        background:
          radial-gradient(135% 95% at 0% 0%, color-mix(in oklch, var(--paper-2) 60%, transparent), transparent 56%),
          var(--paper);
        border: 1px solid color-mix(in oklch, var(--paper-3) 80%, transparent);
        box-shadow: var(--shadow-sm);
        animation: astaRevealUp 0.55s var(--ease) both;
        transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), border-color 0.25s var(--ease);
      }
      .pr-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); border-color: color-mix(in oklch, var(--green) 30%, transparent); }
      :root[data-theme='dark'] .pr-card {
        background:
          radial-gradient(135% 95% at 0% 0%, oklch(1 0 0 / 0.05), transparent 56%),
          var(--paper-2);
      }
      .pr-featured {
        border-color: color-mix(in oklch, var(--green) 45%, transparent);
        box-shadow: var(--shadow-md), 0 0 0 1px color-mix(in oklch, var(--green) 35%, transparent), 0 24px 70px var(--asta-accent-glow);
      }
      @media (min-width: 768px) { .pr-featured { transform: scale(1.04); } .pr-featured:hover { transform: scale(1.04) translateY(-5px); } }
      .pr-pop {
        position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
        font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
        padding: 6px 14px; border-radius: 999px; background: var(--green); color: var(--ink); font-weight: 700;
        box-shadow: 0 6px 22px var(--asta-accent-glow);
      }
      .pr-price { margin-top: 10px; display: flex; align-items: baseline; gap: 4px; }
      .pr-amount { font-family: var(--display); font-size: 42px; font-weight: 600; letter-spacing: -0.02em; }
      .pr-per { color: var(--text-mute); }
      .pr-feats { margin-top: 20px; display: grid; gap: 9px; font-size: 14px; color: var(--text-soft); flex: 1; }
      .pr-feats li { display: flex; gap: 9px; align-items: flex-start; }
      .pr-tick {
        flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px;
        display: grid; place-items: center; border-radius: 50%;
        font-size: 10px; font-weight: 700; color: var(--green-deep);
        background: color-mix(in oklch, var(--green) 14%, transparent);
      }
      .pr-cta {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        margin-top: 24px; padding: 12px 18px; border-radius: 999px;
        font-size: 14px; font-weight: 700; text-align: center;
        color: var(--text); border: 1.5px solid var(--paper-3);
        transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
      }
      .pr-cta:hover { border-color: color-mix(in oklch, var(--green) 45%, transparent); transform: translateY(-1px); }
      .pr-cta-accent { background: var(--green); color: var(--ink); border-color: transparent; }
      .pr-cta-accent:hover { box-shadow: 0 10px 30px var(--asta-accent-glow); }

      /* included strip */
      .pr-incl { position: relative; z-index: 1; padding: 60px 24px 20px; text-align: center; }
      .pr-incl-grid {
        display: grid; gap: 14px; margin-inline: auto; max-width: 980px; text-align: left;
      }
      @media (min-width: 640px) { .pr-incl-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (min-width: 1024px) { .pr-incl-grid { grid-template-columns: repeat(3, 1fr); } }
      .pr-incl-item {
        display: flex; gap: 13px; align-items: flex-start; padding: 18px;
        border-radius: var(--r-md); border: 1px solid color-mix(in oklch, var(--paper-3) 70%, transparent);
        background: color-mix(in oklch, var(--paper-2) 55%, transparent);
        transition: transform 0.2s var(--ease), border-color 0.2s var(--ease);
      }
      .pr-incl-item:hover { transform: translateY(-2px); border-color: color-mix(in oklch, var(--green) 28%, transparent); }
      .pr-incl-ico {
        flex-shrink: 0; width: 38px; height: 38px; display: grid; place-items: center;
        border-radius: 11px; font-size: 17px;
        background: color-mix(in oklch, var(--green) 13%, transparent);
      }

      /* FAQ */
      .pr-faq { position: relative; z-index: 1; padding: 56px 24px 30px; text-align: center; }
      .pr-faq-list { margin-inline: auto; max-width: 680px; text-align: left; display: grid; gap: 10px; }
      .pr-faq-item {
        border: 1px solid color-mix(in oklch, var(--paper-3) 75%, transparent);
        border-radius: var(--r-md); background: color-mix(in oklch, var(--paper-2) 45%, transparent);
        padding: 0 18px; transition: border-color 0.2s var(--ease);
      }
      .pr-faq-item:hover { border-color: color-mix(in oklch, var(--green) 26%, transparent); }
      .pr-faq-item summary {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        cursor: pointer; list-style: none; padding: 15px 0;
        font-weight: 600; font-size: 15px;
      }
      .pr-faq-item summary::-webkit-details-marker { display: none; }
      .pr-faq-chev { color: var(--green-deep); font-size: 15px; transition: transform 0.25s var(--ease); }
      .pr-faq-item[open] .pr-faq-chev { transform: rotate(45deg); }
      .pr-faq-item p { padding: 0 0 16px; font-size: 14.5px; color: var(--text-soft); line-height: 1.6; }

      /* closing band */
      .pr-band { padding: 60px 24px 80px; position: relative; z-index: 1; }
      .pr-band-inner {
        margin-inline: auto; max-width: 880px; text-align: center;
        padding: 56px 32px; border-radius: var(--r-xl);
        background:
          radial-gradient(120% 140% at 85% 0%, color-mix(in oklch, var(--green) 22%, transparent), transparent 52%),
          radial-gradient(120% 140% at 8% 100%, color-mix(in oklch, var(--peri) 16%, transparent), transparent 56%),
          var(--ink);
        box-shadow: var(--shadow-ink);
      }
      .pr-band-cta {
        display: inline-flex; align-items: center; gap: 7px; margin-top: 26px;
        padding: 13px 26px; border-radius: 999px; font-size: 15px; font-weight: 700;
        background: var(--green); color: var(--ink);
        transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease);
      }
      .pr-band-cta:hover { transform: translateY(-2px); box-shadow: 0 14px 40px color-mix(in oklch, var(--green) 40%, transparent); }

      /* skeletons */
      .skel { display: block; border-radius: 8px; background: linear-gradient(90deg, var(--paper-2) 25%, var(--paper-3) 50%, var(--paper-2) 75%); background-size: 200% 100%; animation: skel-shimmer 1.4s ease infinite; }
      @keyframes skel-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

      @media (prefers-reduced-motion: reduce) {
        .skel, .pr-hero, .pr-card { animation: none; }
      }
    `,
    ]
})
export class PricingComponent implements OnInit {
  private readonly billing = inject(BillingService);
  readonly plans = signal<Plan[]>([]);

  /** Storytelling strip — what the product ships on every tier. */
  readonly included = [
    { glyph: '🧭', title: 'AI roadmap', desc: 'A week-by-week plan generated around your goal, level and timeline.' },
    { glyph: '💬', title: 'AI tutor & doubt-solving', desc: 'Live streaming answers, grounded in your own uploaded notes.' },
    { glyph: '✓', title: 'Adaptive quizzes', desc: 'Weak areas detected and fed back into your plan automatically.' },
    { glyph: '🛠', title: 'Real projects', desc: 'Blueprints, kanban and AI review — proof, not just completion.' },
    { glyph: '📜', title: 'Proof ledger & passport', desc: 'A verified, shareable record of everything you actually did.' },
    { glyph: '🎯', title: 'Career readiness', desc: 'An explainable score, gap matrix and 7-day action plan.' },
  ];

  readonly faqs = [
    { q: 'Is the free plan actually usable?', a: 'Yes — the full agent OS runs on every tier. Free has monthly AI usage limits; paid plans raise them and unlock team features.' },
    { q: 'Do I need a credit card to start?', a: 'No. Create an account, finish onboarding and generate your first roadmap — no payment details required.' },
    { q: 'Can I cancel or change plans anytime?', a: 'Anytime, from the billing page. Your learning data, ledger and passport stay yours on every plan.' },
    { q: 'What does "mock payment mode" mean?', a: 'This demo runs the full checkout flow against a mock provider — no real money moves. Production wires Stripe or Razorpay behind the same flow.' },
    { q: 'Is my data used to train AI models?', a: 'No. Your notes and activity power your own roadmap, retrieval and analytics — and you can export or delete everything from Data & Privacy.' },
  ];

  ngOnInit(): void {
    this.billing.plans().subscribe({ next: (p) => this.plans.set(p) });
  }
}
