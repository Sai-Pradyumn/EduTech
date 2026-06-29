import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FineTuningApiService } from '../../core/services/lab.service';
import { ToastService } from '../../core/services/toast.service';
import { FineTuningJob } from '../../core/models';

/**
 * Fine-Tuning Lab (A8). LoRA job records orchestrating the ml-service (simulated progress).
 * Role.Admin; gated by ENABLE_FINE_TUNING (notice shown when disabled). Polls running jobs.
 */
@Component({
    selector: 'asta-fine-tuning',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, FormsModule],
    template: `
   <div class="asta-observatory">
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Fine-Tuning Lab</h1>
        <span class="goal-pill"><span class="dot"></span>Launch &amp; monitor LoRA jobs · live progress &amp; metrics</span>
      </div>
    </header>

    @if (enabled() === false) {
      <div class="card grid place-items-center text-center" style="padding:48px 24px;min-height:240px">
        <div>
          <p class="font-display text-xl mb-1">Fine-Tuning Lab is off</p>
          <p class="text-sm text-txt-soft max-w-md">This feature is behind a flag. Set <code>ENABLE_FINE_TUNING=true</code> on the server to launch LoRA jobs.</p>
        </div>
      </div>
    } @else if (enabled()) {
      <div class="grid gap-5 lg:grid-cols-[minmax(280px,340px)_1fr] motion-row-primary">
        <div class="card motion-card-reveal" style="padding:18px;height:max-content;--motion-card-index:0">
          <p class="kicker mb-3" style="color:var(--green-deep)">New fine-tune</p>
          <input class="input mb-2" placeholder="Job name" [(ngModel)]="name" />
          <select class="input mb-2" [(ngModel)]="baseModel">
            <option value="mistral-7b">mistral-7b</option>
            <option value="llama-3-8b">llama-3-8b</option>
            <option value="phi-3-mini">phi-3-mini</option>
          </select>
          <label for="ft-dataset" class="text-[11px] font-mono uppercase text-txt-mute">Dataset size: {{ datasetSize }}</label>
          <input id="ft-dataset" type="range" min="100" max="5000" step="100" [(ngModel)]="datasetSize" class="w-full mb-2" />
          <label for="ft-epochs" class="text-[11px] font-mono uppercase text-txt-mute">Epochs: {{ epochs }}</label>
          <input id="ft-epochs" type="range" min="1" max="10" [(ngModel)]="epochs" class="w-full mb-3" />
          <button class="btn-go w-full" [disabled]="name.trim().length < 2 || creating()" (click)="create()">{{ creating() ? 'Launching…' : 'Launch LoRA job' }}</button>
        </div>

        <div>
          <p class="kicker mb-3">Jobs</p>
          @if (jobs().length === 0) { <p class="text-sm text-txt-mute">No jobs yet.</p> }
          <div class="space-y-3 motion-row-2">
            @for (j of jobs(); track j.id; let i = $index) {
              <div class="card motion-card-reveal" style="padding:16px" [style.--motion-card-index]="i">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <b class="font-display">{{ j.name }}</b>
                  <span class="pill" [style.color]="statusColor(j.status)">{{ j.status }}</span>
                </div>
                <p class="text-[11px] font-mono text-txt-mute mb-2">{{ j.baseModel }} · {{ j.datasetName }} ({{ j.datasetSize }}) · {{ j.epochs }} epochs · {{ j.createdAt | date: 'short' }}</p>
                <div class="bar mb-1"><div class="bar-fill" [style.width.%]="j.progress" [style.background]="statusColor(j.status)"></div></div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-txt-mute">{{ j.progress }}%</span>
                  @if (j.status === 'succeeded') {
                    <span class="text-xs text-txt-soft">loss {{ j.metrics.finalLoss }} · acc {{ pct(j.metrics.evalAccuracy) }}</span>
                  }
                  @if (j.status === 'running') { <button class="text-[11px] text-txt-mute hover:text-[color:var(--danger)]" (click)="cancel(j.id)">Cancel</button> }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
   </div>
  `,
    styles: [
        `
      .btn-go { border-radius: 100px; padding: 9px 16px; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--green); }
      .btn-go:disabled { opacity: .6; }
      .bar { height: 8px; border-radius: 100px; background: var(--paper-3); overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 100px; transition: width .6s var(--ease); }
    `,
    ]
})
export class FineTuningComponent implements OnInit, OnDestroy {
  private readonly api = inject(FineTuningApiService);
  private readonly toast = inject(ToastService);

  readonly enabled = signal<boolean | null>(null);
  readonly jobs = signal<FineTuningJob[]>([]);
  readonly creating = signal(false);

  name = '';
  baseModel = 'mistral-7b';
  datasetSize = 500;
  epochs = 3;
  private poll?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.api.status().subscribe({
      next: (s) => {
        this.enabled.set(s.enabled);
        if (s.enabled) {
          this.refresh();
          // Poll while any job is still running (simulated progress advances server-side).
          this.poll = setInterval(() => {
            if (this.jobs().some((j) => j.status === 'running' || j.status === 'queued')) this.refresh();
          }, 3000);
        }
      },
      error: () => this.enabled.set(false),
    });
  }

  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
  }

  private refresh(): void {
    this.api.list().subscribe({ next: (j) => this.jobs.set(j) });
  }

  create(): void {
    if (this.name.trim().length < 2) return;
    this.creating.set(true);
    this.api.create({ name: this.name.trim(), baseModel: this.baseModel, datasetSize: this.datasetSize, epochs: this.epochs }).subscribe({
      next: (job) => {
        this.creating.set(false);
        this.name = '';
        this.jobs.update((list) => [job, ...list]);
        this.toast.success('Job launched');
      },
      error: (e) => {
        this.creating.set(false);
        this.toast.error(e?.message ?? 'Could not launch');
      },
    });
  }

  cancel(id: string): void {
    this.api.cancel(id).subscribe({ next: (job) => this.jobs.update((list) => list.map((j) => (j.id === id ? job : j))) });
  }

  pct(v?: number): string {
    return v != null ? `${Math.round(v * 100)}%` : '—';
  }

  statusColor(status: string): string {
    switch (status) {
      case 'succeeded': return 'var(--green-deep)';
      case 'running': return 'var(--peri-deep)';
      case 'failed': return 'var(--coral-deep)';
      case 'cancelled': return 'var(--text-mute)';
      default: return 'var(--text-soft)';
    }
  }
}
