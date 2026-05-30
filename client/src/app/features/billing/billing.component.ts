import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BillingService } from '../../core/services/billing.service';
import { ToastService } from '../../core/services/toast.service';
import { Plan, PlanId, SubscriptionView, TransactionView, UsageView } from '../../core/models';
import { GaugeComponent } from '../../shared/charts';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { TiltDirective } from '../../shared/directives/tilt.directive';

/** Billing & usage (B5/B6): current plan, AI usage meter, plan upgrade (mock checkout), invoices. */
@Component({
  selector: 'asta-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, GaugeComponent, RevealDirective, TiltDirective],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header max-w-app mx-auto">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Billing &amp; usage</h1>
        <span class="goal-pill"><span class="dot"></span>Your plan, AI usage meter &amp; invoices</span>
      </div>
    </header>

    <div class="max-w-app mx-auto space-y-6">
      <!-- Current plan + usage -->
      <div class="grid gap-5 md:grid-cols-2">
        <div class="card" style="padding:20px" [astaReveal]="0">
          <p class="kicker mb-3" style="color:var(--green-deep)">Current plan</p>
          @if (sub(); as s) {
            <div class="flex items-baseline gap-2">
              <h2 class="font-display text-3xl">{{ s.plan.name }}</h2>
              <span class="text-txt-mute">₹{{ s.plan.priceInr }}/mo</span>
            </div>
            <p class="text-sm text-txt-soft mt-1">{{ s.plan.tagline }}</p>
            @if (s.currentPeriodEnd) {
              <p class="text-xs font-mono text-txt-mute mt-3">Renews {{ s.currentPeriodEnd | date: 'mediumDate' }}</p>
            }
          }
        </div>

        <div class="card" style="padding:20px" [astaReveal]="1">
          <p class="kicker mb-3">AI usage this month</p>
          @if (usage(); as u) {
            <div class="flex items-center gap-5">
              @if (u.aiLimit >= 0) {
                <asta-gauge [value]="u.aiCalls" [max]="u.aiLimit" [size]="120"
                  [tone]="u.overLimit ? 'coral' : 'green'" label="of limit" ariaLabel="AI request usage" />
              } @else {
                <div class="grid place-items-center text-center" style="width:120px;height:120px">
                  <div><p class="font-display text-3xl leading-none" style="color:var(--green-deep)">∞</p><p class="t-label mt-1">unlimited</p></div>
                </div>
              }
              <div class="flex-1 min-w-0 space-y-1.5">
                <p class="text-sm"><span class="font-semibold">{{ u.aiCalls }}</span> / {{ u.aiLimit < 0 ? '∞' : u.aiLimit }} requests</p>
                <p class="text-sm font-mono text-txt-mute">{{ u.tokens }} tokens</p>
                <p class="text-xs font-mono text-txt-mute" title="Estimate: token usage × standard provider rates.">est. cost ~ \${{ u.costUsd }} ⓘ</p>
                @if (u.overLimit) {
                  <p class="text-xs" style="color:var(--danger)">You've hit your plan limit — upgrade for more.</p>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Plans -->
      <div>
        <p class="kicker mb-4">Plans</p>
        <div class="grid gap-4 md:grid-cols-3">
          @for (p of plans(); track p.id; let i = $index) {
            <div class="card relative" style="padding:22px" astaTilt [tiltMax]="4" [astaReveal]="i"
              [style.borderColor]="p.highlight ? 'var(--green)' : null"
              [style.boxShadow]="p.highlight ? 'var(--shadow-md)' : null">
              @if (p.highlight) { <span class="pill absolute" style="top:-12px;right:16px;background:var(--green);color:var(--ink);border:0">Popular</span> }
              <h3 class="font-display text-xl">{{ p.name }}</h3>
              <p class="mt-1"><span class="font-display text-3xl">₹{{ p.priceInr }}</span><span class="text-txt-mute text-sm">/mo</span></p>
              <p class="text-sm text-txt-soft mt-1">{{ p.tagline }}</p>
              <ul class="mt-4 space-y-1.5 text-sm text-txt-soft">
                @for (f of p.features; track f) { <li class="flex gap-2"><span style="color:var(--green-deep)">✓</span>{{ f }}</li> }
              </ul>
              <button class="w-full mt-5 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold"
                [style.background]="isCurrent(p.id) ? 'var(--paper-2)' : 'var(--green)'"
                [style.color]="isCurrent(p.id) ? 'var(--text-mute)' : 'var(--ink)'"
                [disabled]="isCurrent(p.id) || busy()" (click)="upgrade(p.id)">
                {{ isCurrent(p.id) ? 'Current plan' : (p.priceInr === 0 ? 'Switch to Free' : 'Upgrade') }}
              </button>
            </div>
          }
        </div>
        <p class="text-xs text-txt-mute mt-3 font-mono">Mock payment mode — no real charge. Razorpay/Stripe slot behind the same checkout.</p>
      </div>

      <!-- Invoices -->
      @if (txns().length) {
        <div class="card" style="padding:18px" [astaReveal]="0">
          <p class="kicker mb-3">Invoices</p>
          <div class="space-y-1.5">
            @for (t of txns(); track t.id) {
              <div class="flex items-center justify-between text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
                <span class="capitalize">{{ t.planId }} plan</span>
                <span class="font-mono text-txt-mute">{{ t.createdAt | date: 'mediumDate' }}</span>
                <span>₹{{ t.amountInr }}</span>
                <span class="pill" style="color:var(--green-deep)">{{ t.status }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class BillingComponent implements OnInit {
  private readonly billing = inject(BillingService);
  private readonly toast = inject(ToastService);

  readonly plans = signal<Plan[]>([]);
  readonly sub = signal<SubscriptionView | null>(null);
  readonly usage = signal<UsageView | null>(null);
  readonly txns = signal<TransactionView[]>([]);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.billing.plans().subscribe({ next: (p) => this.plans.set(p) });
    this.billing.subscription().subscribe({ next: (s) => this.sub.set(s) });
    this.billing.usage().subscribe({ next: (u) => this.usage.set(u) });
    this.billing.transactions().subscribe({ next: (t) => this.txns.set(t) });
  }

  isCurrent(id: PlanId): boolean {
    return this.sub()?.planId === id;
  }

  upgrade(id: PlanId): void {
    this.busy.set(true);
    this.billing.checkout(id).subscribe({
      next: (res) => {
        this.sub.set(res.subscription);
        this.txns.update((list) => [res.transaction, ...list]);
        this.busy.set(false);
        this.toast.success(`You're now on the ${res.subscription.plan.name} plan`);
      },
      error: () => this.busy.set(false),
    });
  }
}
