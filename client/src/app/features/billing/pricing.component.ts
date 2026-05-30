import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../shared/ui/logo.component';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle.component';
import { BillingService } from '../../core/services/billing.service';
import { Plan } from '../../core/models';

/** Public pricing page (B5). Reads the plan catalog; CTAs route to register. */
@Component({
  selector: 'asta-pricing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LogoComponent, ThemeToggleComponent],
  template: `
    <div style="background:var(--paper);color:var(--text);min-height:100vh">
      <nav class="flex items-center justify-between px-6 py-4 mx-auto" style="max-width:var(--maxw,1240px)">
        <a routerLink="/"><asta-logo [size]="28" /></a>
        <div class="flex items-center gap-3">
          <asta-theme-toggle />
          <a routerLink="/login" class="text-sm font-semibold text-txt-soft hover:text-txt">Log in</a>
        </div>
      </nav>

      <header class="text-center px-6 pt-10 pb-12 mx-auto" style="max-width:760px">
        <p class="kicker justify-center mb-4" style="color:var(--green-deep)">Pricing</p>
        <h1 class="font-display" style="font-size:clamp(34px,5vw,56px);line-height:1.12">Start free. Upgrade when you're ready.</h1>
        <p class="text-txt-soft mt-4 text-lg">Every plan runs on the full agent OS. Mock payment mode — no real charge in the demo.</p>
      </header>

      <div class="grid gap-4 md:grid-cols-3 px-6 pb-20 mx-auto motion-row-panel" style="max-width:1040px">
        @for (p of plans(); track p.id; let i = $index) {
          <div class="card relative motion-card-reveal" style="padding:24px" [style.--motion-card-index]="i" [style.borderColor]="p.highlight ? 'var(--green)' : null" [style.boxShadow]="p.highlight ? 'var(--shadow-lg)' : null">
            @if (p.highlight) { <span class="pill absolute" style="top:-12px;right:18px;background:var(--green);color:var(--ink);border:0">Popular</span> }
            <h3 class="font-display text-2xl">{{ p.name }}</h3>
            <p class="mt-1"><span class="font-display text-4xl">₹{{ p.priceInr }}</span><span class="text-txt-mute">/mo</span></p>
            <p class="text-sm text-txt-soft mt-1">{{ p.tagline }}</p>
            <ul class="mt-5 space-y-2 text-sm text-txt-soft">
              @for (f of p.features; track f) { <li class="flex gap-2"><span style="color:var(--green-deep)">✓</span>{{ f }}</li> }
            </ul>
            <a routerLink="/register" class="block text-center w-full mt-6 rounded-full px-4 py-3 text-sm font-semibold"
              [style.background]="p.highlight ? 'var(--green)' : 'transparent'"
              [style.color]="p.highlight ? 'var(--ink)' : 'var(--text)'"
              [style.border]="p.highlight ? 'none' : '1.5px solid var(--paper-3)'">
              {{ p.priceInr === 0 ? 'Start free' : 'Get ' + p.name }}
            </a>
          </div>
        } @empty {
          @for (n of [0, 1, 2]; track n) {
            <div class="card motion-card-reveal" style="padding:24px" [style.--motion-card-index]="n">
              <span class="skel" style="width:50%;height:24px;margin-bottom:12px"></span>
              <span class="skel" style="width:40%;height:36px;margin-bottom:12px"></span>
              <span class="skel" style="width:90%;height:14px;margin-bottom:8px"></span>
              <span class="skel" style="width:75%;height:14px"></span>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .skel { display: block; border-radius: 8px; background: linear-gradient(90deg, var(--paper-2) 25%, var(--paper-3) 50%, var(--paper-2) 75%); background-size: 200% 100%; animation: skel-shimmer 1.4s ease infinite; }
      @keyframes skel-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      @media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
    `,
  ],
})
export class PricingComponent implements OnInit {
  private readonly billing = inject(BillingService);
  readonly plans = signal<Plan[]>([]);

  ngOnInit(): void {
    this.billing.plans().subscribe({ next: (p) => this.plans.set(p) });
  }
}
