import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { VisualBlock } from '../../../core/models';
import { AiConceptMapComponent } from './ai-concept-map.component';
import { AiSkillRadarComponent, RadarAxis } from './ai-skill-radar.component';
import { CardComponent } from '../../ui/card.component';
import { RingComponent } from '../../ui/ring.component';

/** Renders a single AgentResponse visual block by type. */
@Component({
  selector: 'ai-visual-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AiConceptMapComponent, AiSkillRadarComponent, CardComponent, RingComponent],
  template: `
    @switch (block().type) {
      @case ('concept_map') {
        <ai-concept-map [data]="$any(block())" />
      }
      @case ('skill_gap') {
        <asta-card>
          <p class="kicker mb-3">{{ $any(block()).title }}</p>
          <ai-skill-radar [data]="radarAxes()" />
        </asta-card>
      }
      @case ('study_plan') {
        <asta-card>
          <p class="kicker mb-3">{{ $any(block()).title }}</p>
          <ul class="space-y-2">
            @for (it of $any(block()).items; track $index) {
              <li class="flex items-center justify-between text-sm">
                <span class="flex gap-2"><span style="color:var(--green-deep)">•</span>{{ it.label }}</span>
                @if (it.minutes) { <span class="font-mono text-xs text-txt-mute">{{ it.minutes }}m</span> }
              </li>
            }
          </ul>
        </asta-card>
      }
      @case ('practice') {
        <asta-card accentVar="var(--coral)">
          <p class="kicker mb-2" style="color:var(--coral-deep)">{{ $any(block()).title }}</p>
          <p class="text-sm mb-2">{{ $any(block()).prompt }}</p>
          @if ($any(block()).hint) { <p class="text-[13px] text-txt-mute">Hint: {{ $any(block()).hint }}</p> }
        </asta-card>
      }
      @case ('quiz') {
        <asta-card>
          <p class="kicker mb-3">{{ $any(block()).title }}</p>
          @for (q of $any(block()).questions; track $index) {
            <div class="mb-3">
              <p class="text-sm font-medium mb-2">{{ q.prompt }}</p>
              <div class="space-y-1.5">
                @for (opt of q.options; track $index) {
                  <div class="text-sm px-3 py-2 rounded-[10px] border" style="border-color:var(--paper-3)"
                    [style.background]="reveal() && $index === q.answerIndex ? 'oklch(0.80 0.16 150 / .14)' : 'var(--paper)'">{{ opt }}</div>
                }
              </div>
              @if (reveal() && q.explanation) { <p class="text-[13px] text-txt-mute mt-2">{{ q.explanation }}</p> }
            </div>
          }
          <button class="text-sm font-semibold" style="color:var(--green-deep)" (click)="reveal.set(!reveal())">
            {{ reveal() ? 'Hide answers' : 'Reveal answers' }}
          </button>
        </asta-card>
      }
      @case ('weakness_analysis') {
        <asta-card accentVar="var(--coral)">
          <p class="kicker mb-3" style="color:var(--coral-deep)">{{ $any(block()).title }}</p>
          @for (w of $any(block()).weaknesses; track w.topic) {
            <div class="mb-2.5">
              <div class="flex justify-between text-sm mb-1"><span>{{ w.topic }}</span><span class="font-mono text-xs text-txt-mute">{{ w.severity }}</span></div>
              <div class="w-full rounded-full overflow-hidden" style="height:6px;background:var(--paper-3)">
                <div class="h-full rounded-full" [style.width.%]="w.severity" style="background:var(--coral)"></div>
              </div>
              @if (w.note) { <p class="text-[12px] text-txt-mute mt-1">{{ w.note }}</p> }
            </div>
          }
        </asta-card>
      }
      @case ('mentor_feedback') {
        <asta-card accentVar="var(--green)">
          <div class="flex items-start gap-4">
            <asta-ring [value]="$any(block()).learningHealthScore" [size]="84" />
            <div class="flex-1">
              <p class="kicker mb-2">{{ $any(block()).title }}</p>
              <p class="text-[13px] font-semibold text-txt-soft mb-1">Highlights</p>
              <ul class="text-sm text-txt-soft mb-2 space-y-0.5">@for (h of $any(block()).highlights; track $index) { <li>• {{ h }}</li> }</ul>
              <p class="text-[13px] font-semibold text-txt-soft mb-1">Action plan</p>
              <ul class="text-sm text-txt-soft space-y-0.5">@for (a of $any(block()).actionPlan; track $index) { <li style="color:var(--green-deep)">→ {{ a }}</li> }</ul>
            </div>
          </div>
        </asta-card>
      }
      @case ('roadmap_timeline') {
        <asta-card>
          <p class="kicker mb-3">{{ $any(block()).title }}</p>
          <div class="flex flex-wrap gap-2">
            @for (w of $any(block()).weeks; track w.weekNumber) {
              <span class="pill" [style.borderColor]="w.status === 'done' ? 'var(--green)' : w.status === 'current' ? 'var(--peri)' : null">W{{ w.weekNumber }} · {{ w.focus }}</span>
            }
          </div>
        </asta-card>
      }
      @case ('project_plan') {
        <asta-card accentVar="var(--coral)">
          <p class="kicker mb-3" style="color:var(--coral-deep)">{{ $any(block()).title }}</p>
          <div class="flex flex-wrap gap-1.5 mb-3">@for (t of $any(block()).techStack; track t) { <span class="pill">{{ t }}</span> }</div>
          <ul class="text-sm text-txt-soft space-y-1">@for (t of $any(block()).tasks; track $index) { <li>• {{ t.title }}</li> }</ul>
        </asta-card>
      }
      @case ('admin_insight') {
        <asta-card>
          <p class="kicker mb-3" style="color:var(--peri-deep)">{{ $any(block()).title }}</p>
          <div class="grid grid-cols-2 gap-3">
            @for (m of $any(block()).metrics; track m.label) {
              <div><p class="font-display text-2xl">{{ m.value }}</p><p class="text-xs text-txt-mute">{{ m.label }}</p></div>
            }
          </div>
        </asta-card>
      }
    }
  `,
})
export class VisualBlockRendererComponent {
  @Input({ required: true }) set block_(v: VisualBlock) {
    this.block.set(v);
  }
  readonly block = signal<VisualBlock>({ type: 'practice', title: '', prompt: '' });
  readonly reveal = signal(false);

  readonly radarAxes = computed<RadarAxis[]>(() => {
    const b = this.block();
    if (b.type === 'skill_gap') {
      return b.skills.map((s) => ({ label: s.skill, value: s.current, target: s.target }));
    }
    return [];
  });
}
