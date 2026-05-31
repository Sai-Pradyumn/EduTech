import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BillingService } from '../../core/services/billing.service';
import { EntitlementService } from '../../core/services/entitlement.service';
import { ProductAnalyticsService } from '../../core/services/product-analytics.service';
import { ToastService } from '../../core/services/toast.service';
import { EntitlementSummary, FEATURE_LABELS, FeatureKey, Plan, PlanId, SubscriptionView, TransactionView, UsageView } from '../../core/models';
import { GaugeComponent } from '../../shared/charts';

/** Billing & usage (B5/B6): current plan, AI usage meter, plan upgrade (mock checkout), invoices. */
@Component({
  selector: 'asta-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, GaugeComponent],
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
      <div class="grid gap-5 md:grid-cols-2 motion-row-primary">
        <div class="card motion-card-reveal" style="padding:20px;--motion-card-index:0">
          <p class="kicker mb-3" style="color:var(--green-deep)">Current plan</p>
          @if (sub(); as s) {
            <div class="flex items-baseline gap-2">
              <h2 class="font-display text-3xl">{{ s.plan.name }}</h2>
              <span class="text-txt-mute">₹{{ s.plan.priceInr }}/mo</span>
            </div>
            <p class="text-sm text-txt-soft mt-1">{{ s.plan.tagline }}</p>
            @if (s.currentPeriodEnd) {
              <p class="text-xs font-mono text-txt-mute mt-3">
                {{ s.cancelAtPeriodEnd ? 'Ends' : 'Renews' }} {{ s.currentPeriodEnd | date: 'mediumDate' }}
              </p>
            }
            <div class="flex items-center gap-2 mt-3">
              <span class="pill" style="color:var(--green-deep)">{{ s.status }}</span>
              <span class="pill text-txt-mute">via {{ s.provider }}</span>
              @if (s.planId !== 'free' && !s.cancelAtPeriodEnd) {
                <button class="text-xs text-txt-mute hover:text-danger ml-auto" [disabled]="busy()" (click)="cancel()">Cancel plan</button>
              }
            </div>
          } @else {
            <span class="skel" style="width:50%;height:30px;margin-bottom:8px"></span>
            <span class="skel" style="width:70%;height:14px"></span>
          }
        </div>

        <div class="card motion-card-reveal" style="padding:20px;--motion-card-index:1">
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
          } @else {
            <div class="flex items-center gap-5">
              <span class="skel" style="width:120px;height:120px;border-radius:50%"></span>
              <div class="flex-1 space-y-2">
                <span class="skel" style="width:80%;height:14px"></span>
                <span class="skel" style="width:60%;height:14px"></span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Plan limits & AI cost breakdown -->
      <div class="grid gap-5 md:grid-cols-2">
        <div class="card" style="padding:20px">
          <p class="kicker mb-3">Plan limits this period</p>
          @if (meters().length) {
            <div class="space-y-3">
              @for (m of meters(); track m.key) {
                <div>
                  <div class="flex items-center justify-between text-sm mb-1">
                    <span>{{ m.label }}</span>
                    <span class="font-mono text-txt-mute">
                      {{ m.used }}<span> / {{ m.unlimited ? '∞' : m.limit }}</span>
                    </span>
                  </div>
                  <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--paper-3)">
                    <div class="h-full rounded-full" style="transition:width .4s var(--ease-spring)"
                      [style.width.%]="m.unlimited ? 8 : m.pct"
                      [style.background]="m.over ? 'var(--danger)' : 'var(--green)'"></div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <span class="skel" style="width:100%;height:80px"></span>
          }
        </div>

        <div class="card" style="padding:20px">
          <p class="kicker mb-3">AI cost by feature</p>
          @if (usage(); as u) {
            @if (u.byFeature.length) {
              <div class="space-y-1.5">
                @for (f of u.byFeature; track f.feature) {
                  <div class="flex items-center justify-between text-sm py-1.5" style="border-bottom:1px solid var(--paper-3)">
                    <span class="capitalize">{{ f.feature }}</span>
                    <span class="font-mono text-txt-mute">{{ f.calls }} calls</span>
                    <span class="font-mono">~\${{ f.costUsd }}</span>
                  </div>
                }
              </div>
            } @else {
              <p class="text-sm text-txt-mute">No AI usage yet this period.</p>
            }
          } @else {
            <span class="skel" style="width:100%;height:80px"></span>
          }
        </div>
      </div>

      <!-- Plans -->
      <div>
        <p class="kicker mb-4">Plans</p>
        <div class="grid gap-4 md:grid-cols-3 motion-row-panel">
          @for (p of plans(); track p.id; let i = $index) {
            <div class="card relative motion-card-reveal" style="padding:22px" [style.--motion-card-index]="i"
              [style.borderColor]="p.highlight ? 'var(--green)' : null"
              [style.boxShadow]="p.highlight ? 'var(--shadow-md)' : null">
              @if (p.highlight) { <span class="pill absolute" style="top:-12px;right:16px;background:var(--green);color:var(--ink);border:0">Popular</span> }
              <h3 class="font-display text-xl">{{ p.name }}</h3>
              @if (p.id === 'enterprise') {
                <p class="mt-1"><span class="font-display text-2xl">Custom</span></p>
              } @else {
                <p class="mt-1"><span class="font-display text-3xl">₹{{ p.priceInr }}</span><span class="text-txt-mute text-sm">/mo</span></p>
              }
              <p class="text-[11px] font-mono uppercase tracking-wide text-txt-mute mt-0.5">{{ p.scope === 'org' ? 'Organization' : 'Individual' }}</p>
              <p class="text-sm text-txt-soft mt-1">{{ p.tagline }}</p>
              <ul class="mt-4 space-y-1.5 text-sm text-txt-soft">
                @for (f of p.features; track f) { <li class="flex gap-2"><span style="color:var(--green-deep)">✓</span>{{ f }}</li> }
              </ul>
              <button class="w-full mt-5 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold"
                [style.background]="isCurrent(p.id) ? 'var(--paper-2)' : 'var(--green)'"
                [style.color]="isCurrent(p.id) ? 'var(--text-mute)' : 'var(--ink)'"
                [disabled]="isCurrent(p.id) || busy() || p.id === 'enterprise'" (click)="upgrade(p.id)">
                {{ isCurrent(p.id) ? 'Current plan' : (p.id === 'enterprise' ? 'Contact sales' : (p.id === 'free' ? 'Switch to Free' : 'Upgrade')) }}
              </button>
            </div>
          } @empty {
            @for (n of [0, 1, 2]; track n) {
              <div class="card motion-card-reveal motion-row-panel" style="padding:22px" [style.--motion-card-index]="n">
                <span class="skel" style="width:50%;height:22px;margin-bottom:10px"></span>
                <span class="skel" style="width:40%;height:30px;margin-bottom:10px"></span>
                <span class="skel" style="width:90%;height:14px"></span>
              </div>
            }
          }
        </div>
        <p class="text-xs text-txt-mute mt-3 font-mono">Mock payment mode — no real charge. Razorpay/Stripe slot behind the same checkout.</p>
      </div>

      <!-- Invoices -->
      @if (txns().length) {
        <div class="card motion-card-reveal motion-lower" style="padding:18px;--motion-card-index:0">
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
  styles: [
    `
      .skel { display: block; border-radius: 8px; background: linear-gradient(90deg, var(--paper-2) 25%, var(--paper-3) 50%, var(--paper-2) 75%); background-size: 200% 100%; animation: skel-shimmer 1.4s ease infinite; }
      @keyframes skel-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      @media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
    `,
  ],
})
export class BillingComponent implements OnInit {
  private readonly billing = inject(BillingService);
  private readonly entitlements = inject(EntitlementService);
  private readonly analytics = inject(ProductAnalyticsService);
  private readonly toast = inject(ToastService);

  readonly plans = signal<Plan[]>([]);
  readonly sub = signal<SubscriptionView | null>(null);
  readonly usage = signal<UsageView | null>(null);
  readonly txns = signal<TransactionView[]>([]);
  readonly ent = signal<EntitlementSummary | null>(null);
  readonly busy = signal(false);

  /** Meter rows worth surfacing on the billing page (monthly + key flags). */
  private readonly meterKeys: FeatureKey[] = [
    'ai.messages',
    'flow.generations',
    'visual.generations',
    'quiz.generations',
    'project.reviews',
    'rag.documents',
  ];

  readonly meters = computed(() => {
    const s = this.ent();
    if (!s) return [];
    return this.meterKeys
      .map((k) => s.features.find((f) => f.featureKey === k))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((f) => ({
        key: f.featureKey,
        label: FEATURE_LABELS[f.featureKey] ?? f.featureKey,
        used: f.used,
        limit: f.limit,
        pct:
          f.limit > 0 ? Math.min(100, Math.round((f.used / f.limit) * 100)) : 0,
        unlimited: f.limit < 0,
        over: f.limit >= 0 && f.used >= f.limit,
      }));
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.billing.plans().subscribe({ next: (p) => this.plans.set(p) });
    this.billing.subscription().subscribe({ next: (s) => this.sub.set(s) });
    this.billing.usage().subscribe({ next: (u) => this.usage.set(u) });
    this.billing.transactions().subscribe({ next: (t) => this.txns.set(t) });
    this.entitlements.load().subscribe({ next: (e) => this.ent.set(e) });
  }

  isCurrent(id: PlanId): boolean {
    return this.sub()?.planId === id;
  }

  upgrade(id: PlanId): void {
    this.busy.set(true);
    this.analytics.track('billing_upgrade_clicked', { plan: id });
    this.billing.changePlan(id).subscribe({
      next: (subscription) => {
        this.sub.set(subscription);
        this.busy.set(false);
        if (id !== 'free') this.analytics.track('subscription_started', { plan: id });
        this.billing.transactions().subscribe({ next: (t) => this.txns.set(t) });
        this.entitlements.load().subscribe({ next: (e) => this.ent.set(e) });
        this.toast.success(`You're now on the ${subscription.plan.name} plan`);
      },
      error: () => this.busy.set(false),
    });
  }

  cancel(): void {
    this.busy.set(true);
    this.billing.cancel().subscribe({
      next: (s) => {
        this.sub.set(s);
        this.busy.set(false);
        this.toast.success('Subscription will end at the period close.');
      },
      error: () => this.busy.set(false),
    });
  }
}
