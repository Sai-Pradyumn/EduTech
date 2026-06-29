import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { TextToSpeechService } from '../../core/services/text-to-speech.service';
import { ToastService } from '../../core/services/toast.service';
import { LearningReplay, ReplayService } from '../../core/services/replay.service';

@Component({
    selector: 'asta-replay',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Learning Replay</h1>
        <span class="goal-pill"><span class="dot"></span>Your recent journey, recapped — what you did, struggled with, and do next</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <asta-btn variant="ghost" size="sm" (click)="generate()" [disabled]="loading()">Regenerate</asta-btn>
        @if (replay()) { <asta-btn variant="ghost" size="sm" (click)="copyRecap()">Copy</asta-btn> }
        @if (replay()) { <asta-btn variant="accent" size="sm" (click)="playRecap()">{{ tts.speaking() ? 'Stop' : '▶ Play recap' }}</asta-btn> }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="280px" /></asta-card>
    } @else if (loadError() || !replay()) {
      <asta-card><asta-empty-state title="Could not build your replay" description=""><asta-btn variant="accent" (click)="generate()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (replay()) {
      @if (replay()!; as r) {
      <asta-card class="block motion-card-reveal motion-row-primary recap mb-4">
        <p class="kicker mb-1">3-minute recap</p>
        <p class="recap-text">{{ r.recapScript }}</p>
        <p class="text-[11px] text-txt-mute mt-2">Readiness {{ r.readinessScore }}/100 · {{ r.pace }} pace · suggested modality: {{ r.modality.modality }} · last {{ r.windowDays }} days · generated {{ ago(r.generatedAt) }}</p>
      </asta-card>

      <div class="grid gap-4 lg:grid-cols-3">
        <asta-card class="block motion-card-reveal motion-row-2">
          <p class="kicker mb-2">What you did <span class="cnt">({{ r.did.length }})</span></p>
          @if (r.did.length === 0) { <p class="text-sm text-txt-mute">No recent verified events.</p> }
          <ul class="list">@for (d of r.did; track d.title) { <li><b>{{ d.title }}</b><span>{{ d.detail }}</span></li> }</ul>
        </asta-card>
        <asta-card class="block motion-card-reveal motion-row-2">
          <p class="kicker mb-2">Where you struggled</p>
          @if (r.struggled.length === 0) { <p class="text-sm text-txt-mute">No major gaps right now.</p> }
          <ul class="list">@for (s of r.struggled; track s.concept) { <li><b>{{ s.concept }}</b><span>severity {{ s.severity }}/100</span></li> }</ul>
        </asta-card>
        <asta-card class="block motion-card-reveal motion-row-2">
          <p class="kicker mb-2">What to do next</p>
          <ul class="list">
            @for (a of r.nextActions; track a.label) {
              <li>
                <button class="next" (click)="go(a.route)"><b>{{ a.label }}</b><span>{{ a.reason }}</span></button>
              </li>
            }
          </ul>
        </asta-card>
      </div>
      }
    }
  `,
    styles: [
        `
      :host { display: block; }
      /* The narrated recap is the stage — violet ring + glow, text rises in. */
      .recap { border: 1px solid color-mix(in oklab, var(--peri,#8aa6ff) 30%, var(--paper-3)); box-shadow: 0 0 22px var(--asta-glow-violet); }
      .recap-text { font-size: 15px; line-height: 1.6; animation: astaRevealUp .5s var(--ease) .15s both; }
      .cnt { color: var(--text-mute); font-weight: 400; }
      .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
      .list li { animation: astaRevealUp .4s var(--ease) both; }
      .list li:nth-child(2) { animation-delay: .05s; }
      .list li:nth-child(3) { animation-delay: .1s; }
      .list li:nth-child(4) { animation-delay: .15s; }
      .list li b { display: block; font-size: 13px; }
      .list li span { display: block; font-size: 12px; color: var(--text-mute); }
      .next { text-align: left; width: 100%; background: var(--paper-2); border: 1px solid var(--paper-3); border-radius: 10px; padding: 8px 10px; cursor: pointer; transition: border-color .15s var(--ease), transform .15s var(--ease); }
      .next:hover { border-color: var(--green); transform: translateX(2px); }
      @media (prefers-reduced-motion: reduce) { .recap-text, .list li { animation: none; } .next:hover { transform: none; } }
    `,
    ]
})
export class ReplayComponent {
  private readonly api = inject(ReplayService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly tts = inject(TextToSpeechService);

  readonly replay = signal<LearningReplay | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  constructor() { this.generate(); }
  generate(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.generate().subscribe({ next: (r) => { this.replay.set(r); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  playRecap(): void {
    const r = this.replay(); if (!r) return;
    if (this.tts.speaking()) { this.tts.cancel(); return; }
    this.tts.speak(r.recapScript);
  }
  go(route: string): void { this.router.navigate([route]); }
  ago(iso: string): string {
    if (!iso) return 'just now';
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'yesterday' : `${d}d ago`;
  }

  /** Export the recap as a shareable markdown digest. */
  copyRecap(): void {
    const r = this.replay();
    if (!r) return;
    const lines = [
      '# Learning Replay',
      '',
      r.recapScript,
      '',
      `Readiness ${r.readinessScore}/100 · ${r.pace} pace · suggested modality: ${r.modality.modality}`,
      '',
      '## What I did',
      ...(r.did.length ? r.did.map((d) => `- ${d.title} — ${d.detail}`) : ['- (no recent verified events)']),
      '',
      '## Where I struggled',
      ...(r.struggled.length ? r.struggled.map((s) => `- ${s.concept} (severity ${s.severity}/100)`) : ['- (no major gaps)']),
      '',
      '## What to do next',
      ...r.nextActions.map((a) => `- ${a.label} — ${a.reason}`),
    ];
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => this.toast.success('Recap copied'),
      () => this.toast.error('Clipboard unavailable'),
    );
  }
}
