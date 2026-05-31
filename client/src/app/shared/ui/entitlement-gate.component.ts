import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { EntitlementService } from '../../core/services/entitlement.service';
import { FeatureKey, FEATURE_LABELS } from '../../core/models';

/**
 * Entitlement gate (Phase 10 · M1). Wrap any plan-limited capability:
 *   <asta-entitlement-gate feature="flow.generations"> …content… </asta-entitlement-gate>
 * Renders the content when allowed; otherwise a compact, on-brand upgrade panel that
 * explains the limit and links to billing. Never a giant hero — fits inside cards.
 */
@Component({
  selector: 'asta-entitlement-gate',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (allowed()) {
      <ng-content />
    } @else {
      <div
        class="rounded-[14px] p-4 flex items-start gap-3"
        style="background:var(--paper-2);border:1px dashed var(--paper-3)"
        role="status"
      >
        <span
          class="grid place-items-center w-9 h-9 rounded-[10px] shrink-0"
          style="background:var(--paper-3);color:var(--green-deep)"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">{{ heading() }}</p>
          <p class="text-xs text-txt-soft mt-0.5">{{ reason() }}</p>
          @if (showUpgrade) {
            <a
              routerLink="/app/billing"
              class="inline-flex items-center gap-1.5 mt-2.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
              style="background:var(--green);color:var(--ink)"
            >
              Upgrade plan
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          }
        </div>
      </div>
    }
  `,
})
export class EntitlementGateComponent {
  private readonly entitlements = inject(EntitlementService);

  /** Feature to gate on. */
  @Input({ required: true }) feature!: FeatureKey;
  /** Override the default heading. */
  @Input() heading_?: string;
  /** Show the upgrade CTA (default true). */
  @Input() showUpgrade = true;

  readonly allowed = computed(() => this.entitlements.can(this.feature));

  heading(): string {
    return this.heading_ ?? `${this.label()} limit reached`;
  }

  reason(): string {
    const f = this.entitlements.feature(this.feature);
    if (f?.reason === 'blocked')
      return `${this.label()} isn't included in your current plan.`;
    if (f && f.limit >= 0)
      return `You've used ${f.used} of ${f.limit} this period. Resets ${this.resetLabel(
        f.resetAt,
      )}.`;
    return `Upgrade your plan to unlock ${this.label().toLowerCase()}.`;
  }

  private label(): string {
    return FEATURE_LABELS[this.feature] ?? this.feature;
  }

  private resetLabel(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? 'next period'
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
