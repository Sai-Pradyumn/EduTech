import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { ToastService } from '../../core/services/toast.service';
import { FeatureFlagView } from '../../core/models';

/**
 * Feature-flag control room (Phase 10 · M16). Role.Admin. Flip flags at runtime — including
 * a one-click kill switch for expensive AI paths. Reads /admin/feature-flags.
 */
@Component({
  selector: 'asta-admin-feature-flags',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Feature flags</h1>
        <span class="goal-pill"><span class="dot"></span>release control &amp; AI kill switches</span>
      </div>
    </header>

    <div class="space-y-2.5">
      @for (f of flags(); track f.key) {
        <div class="card ff-row flex items-center gap-4" [class.ff-on]="f.enabled" style="padding:16px 18px">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-sm">{{ f.label }}</span>
              <span class="pill font-mono text-[10px]">{{ f.key }}</span>
              @if (f.beta) { <span class="pill" style="color:var(--peri-deep)">beta</span> }
              @if (f.killable) { <span class="pill" style="color:var(--danger)">killable</span> }
              @if (f.overridden) { <span class="pill text-txt-mute">overridden</span> }
              @if (f.rolloutPercent < 100) { <span class="pill" style="color:var(--peri-deep)">rollout {{ f.rolloutPercent }}%</span> }
              @if (f.allowedPlans.length) { <span class="pill text-txt-mute">plans: {{ f.allowedPlans.join(', ') }}</span> }
            </div>
            <p class="text-xs text-txt-soft mt-1">{{ f.description }}</p>
          </div>
          <button
            class="toggle shrink-0"
            role="switch"
            [attr.aria-checked]="f.enabled"
            [class.on]="f.enabled"
            [disabled]="busy() === f.key"
            (click)="toggle(f)"
          >
            <span class="knob"></span>
          </button>
        </div>
      } @empty {
        @for (n of [0,1,2,3,4]; track n) {
          <div class="card" style="padding:16px 18px"><span class="skel" style="width:100%;height:36px"></span></div>
        }
      }
    </div>
  `,
  styles: [
    `
      .ff-row { animation: astaRevealUp .4s var(--ease) both; transition: border-color .2s var(--ease), transform .2s var(--ease); }
      .ff-row:nth-child(2) { animation-delay: .05s; }
      .ff-row:nth-child(3) { animation-delay: .1s; }
      .ff-row:nth-child(4) { animation-delay: .15s; }
      .ff-row:nth-child(5) { animation-delay: .2s; }
      .ff-row:hover { transform: translateY(-1px); }
      /* Enabled flags carry a faint live edge so scan-reading the wall is instant. */
      .ff-on { border-color: color-mix(in oklch, var(--green) 26%, var(--paper-3)); }
      .toggle { position: relative; width: 46px; height: 26px; border-radius: 999px; background: var(--paper-3); transition: background .2s, box-shadow .2s; }
      .toggle.on { background: var(--green); box-shadow: 0 0 12px var(--asta-accent-glow); }
      .toggle .knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: var(--shadow-sm); transition: transform .2s var(--ease-spring); }
      .toggle.on .knob { transform: translateX(20px); }
      .toggle:disabled { opacity: .5; }
      .skel { display:block; border-radius:8px; background:linear-gradient(90deg,var(--paper-2) 25%,var(--paper-3) 50%,var(--paper-2) 75%); background-size:200% 100%; animation:skel-shimmer 1.4s ease infinite; }
      @keyframes skel-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      @media (prefers-reduced-motion: reduce) { .skel,.toggle .knob { animation:none; transition:none } .ff-row { animation:none } .ff-row:hover { transform:none } }
    `,
  ],
})
export class AdminFeatureFlagsComponent implements OnInit {
  private readonly flagsApi = inject(FeatureFlagService);
  private readonly toast = inject(ToastService);

  readonly flags = signal<FeatureFlagView[]>([]);
  readonly busy = signal<string | null>(null);

  ngOnInit(): void {
    this.flagsApi.list().subscribe({ next: (f) => this.flags.set(f) });
  }

  toggle(f: FeatureFlagView): void {
    this.busy.set(f.key);
    this.flagsApi.set(f.key, { enabled: !f.enabled }).subscribe({
      next: (updated) => {
        this.flags.update((list) =>
          list.map((x) => (x.key === updated.key ? updated : x)),
        );
        this.busy.set(null);
        this.toast.success(`${updated.label} ${updated.enabled ? 'enabled' : 'disabled'}`);
      },
      error: () => this.busy.set(null),
    });
  }
}
