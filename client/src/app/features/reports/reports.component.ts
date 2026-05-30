import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { AiUsageReport, StudentOutcomesReport, WeakTopicRow } from '../../core/models';
import { BarChartComponent, DonutChartComponent, ChartDatum } from '../../shared/charts';
import { CountDirective } from '../../shared/directives/count.directive';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { TiltDirective } from '../../shared/directives/tilt.directive';

type Tab = 'students' | 'weak-topics' | 'ai-usage';

/**
 * Enterprise reports (B16). Org admins (admin.reports.view) get outcome / weak-topic /
 * AI-usage reports built on the Learning-Intelligence engine, each exportable to CSV.
 */
@Component({
  selector: 'asta-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, BarChartComponent, DonutChartComponent, CountDirective, RevealDirective, TiltDirective],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Reports</h1>
        <span class="goal-pill"><span class="dot"></span>Outcomes, weak topics &amp; AI usage · exportable to CSV</span>
      </div>
      <div class="flex gap-2.5 shrink-0">
        <button class="btn-go" [disabled]="downloading()" (click)="download()">{{ downloading() ? 'Exporting…' : '⬇ Export CSV' }}</button>
      </div>
    </header>

    <div class="flex gap-1.5 mb-4 flex-wrap">
      @for (t of tabs; track t.key) {
        <button class="chip" [class.chip-on]="tab() === t.key" (click)="switch(t.key)">{{ t.label }}</button>
      }
    </div>

    @if (denied()) {
      <div class="card" style="padding:28px;text-align:center">
        <p class="font-display text-lg mb-1">Reports aren't available for your role</p>
        <p class="text-sm text-txt-soft">Enterprise reports need the <b>reports</b> permission. Ask an org admin for access.</p>
      </div>
    } @else {
    @switch (tab()) {
      @case ('students') {
        @if (students(); as r) {
          <div class="grid sm:grid-cols-3 gap-3 mb-4">
            <div class="card stat" astaTilt [tiltMax]="4" [astaReveal]="0"><span class="num" [astaCount]="r.studentCount">0</span><span class="lbl">Students</span></div>
            <div class="card stat" astaTilt [tiltMax]="4" [astaReveal]="1"><span class="num" [astaCount]="r.avgHealth">0</span><span class="lbl">Avg health</span></div>
            <div class="card stat" astaTilt [tiltMax]="4" [astaReveal]="2"><span class="num" [astaCount]="r.avgReadiness">0</span><span class="lbl">Avg readiness</span></div>
          </div>
          <div class="card" style="padding:0;overflow:auto" [astaReveal]="3">
            <table>
              <thead><tr><th>Name</th><th>Health</th><th>Readiness</th><th>Quizzes</th><th>Projects</th><th>Active days</th><th>Top weakness</th></tr></thead>
              <tbody>
                @for (row of r.rows; track row.userId) {
                  <tr>
                    <td><b>{{ row.name }}</b><br /><span class="sub">{{ row.email }}</span></td>
                    <td>{{ row.health }}</td><td>{{ row.readiness }}</td><td>{{ row.quizzes }}</td>
                    <td>{{ row.projects }}</td><td>{{ row.activeDays }}</td><td>{{ row.topWeakness }}</td>
                  </tr>
                } @empty { <tr><td colspan="7" class="empty">No students in this organization yet.</td></tr> }
              </tbody>
            </table>
          </div>
          <p class="gen">Generated {{ r.generatedAt | date: 'medium' }}</p>
        }
      }
      @case ('weak-topics') {
        @if (weakTopics().length) {
          <div class="card mb-4" style="padding:18px" [astaReveal]="0">
            <p class="kicker mb-3" style="color:var(--coral-deep)">Avg severity by topic</p>
            <asta-bar-chart [horizontal]="true" tone="coral" [data]="weakTopicData()" label="Average weakness severity by topic" />
          </div>
        }
        <div class="card" style="padding:0;overflow:auto" [astaReveal]="1">
          <table>
            <thead><tr><th>Topic</th><th>Affected students</th><th>Avg severity</th></tr></thead>
            <tbody>
              @for (row of weakTopics(); track row.topic) {
                <tr>
                  <td><b>{{ row.topic }}</b></td>
                  <td>{{ row.affectedStudents }}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="bar"><div class="bar-fill" [style.width.%]="row.avgSeverity"></div></div>
                      <span class="sub">{{ row.avgSeverity }}</span>
                    </div>
                  </td>
                </tr>
              } @empty { <tr><td colspan="3" class="empty">No weak topics flagged yet.</td></tr> }
            </tbody>
          </table>
        </div>
      }
      @case ('ai-usage') {
        @if (aiUsage(); as r) {
          <div class="grid sm:grid-cols-3 gap-3 mb-4">
            <div class="card stat" astaTilt [tiltMax]="4" [astaReveal]="0"><span class="num" [astaCount]="r.totalCalls">0</span><span class="lbl">Total AI calls</span></div>
            <div class="card stat" astaTilt [tiltMax]="4" [astaReveal]="1"><span class="num" [astaCount]="r.totalTokens">0</span><span class="lbl">Tokens</span></div>
            <div class="card stat" astaTilt [tiltMax]="4" [astaReveal]="2"><span class="num" [astaCount]="r.avgLatencyMs" suffix="ms">0</span><span class="lbl">Avg latency</span></div>
          </div>
          @if (aiAgentData().length) {
            <div class="card mb-4" style="padding:18px" [astaReveal]="3">
              <p class="kicker mb-3" style="color:var(--peri-deep)">Calls by agent</p>
              <asta-donut-chart [data]="aiAgentData()" centerLabel="calls" label="AI calls by agent" />
            </div>
          }
          <div class="card" style="padding:0;overflow:auto" [astaReveal]="4">
            <table>
              <thead><tr><th>Agent</th><th>Calls</th></tr></thead>
              <tbody>
                @for (row of r.rows; track row.agentType) { <tr><td><b>{{ row.agentType }}</b></td><td>{{ row.count }}</td></tr> }
                @empty { <tr><td colspan="2" class="empty">No AI usage recorded yet.</td></tr> }
              </tbody>
            </table>
          </div>
          <p class="gen">Generated {{ r.generatedAt | date: 'medium' }}</p>
        }
      }
    }
    }
  `,
  styles: [
    `
      .chip { font-family: var(--mono); font-size: 11px; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); }
      .chip-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      .btn-go { border-radius: 100px; padding: 7px 15px; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--green); }
      .btn-go:disabled { opacity: .6; }
      .stat { padding: 16px; display: flex; flex-direction: column; gap: 2px; }
      .num { font-family: var(--display); font-size: 28px; line-height: 1; }
      .lbl { font-size: 11px; font-family: var(--mono); text-transform: uppercase; color: var(--text-mute); }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); padding: 12px 14px; border-bottom: 1px solid var(--paper-3); }
      td { padding: 11px 14px; border-bottom: 1px solid var(--paper-2); vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      .sub { font-size: 11px; color: var(--text-mute); }
      .empty { text-align: center; color: var(--text-mute); padding: 28px; }
      .bar { width: 90px; height: 6px; border-radius: 100px; background: var(--paper-3); overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 100px; background: var(--coral, oklch(0.72 0.17 28)); }
      .gen { font-size: 11px; font-family: var(--mono); color: var(--text-mute); margin-top: 10px; }
    `,
  ],
})
export class ReportsComponent implements OnInit {
  private readonly api = inject(ReportService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<Tab>('students');
  readonly students = signal<StudentOutcomesReport | null>(null);
  readonly weakTopics = signal<WeakTopicRow[]>([]);
  readonly aiUsage = signal<AiUsageReport | null>(null);
  readonly downloading = signal(false);
  readonly denied = signal(false);

  /** Weak topics → horizontal bar (severity). */
  readonly weakTopicData = computed<ChartDatum[]>(() =>
    this.weakTopics().map((r) => ({ label: r.topic, value: r.avgSeverity })),
  );
  /** AI usage by agent → donut. */
  readonly aiAgentData = computed<ChartDatum[]>(() =>
    (this.aiUsage()?.rows ?? []).map((r) => ({ label: r.agentType, value: r.count })),
  );

  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'students', label: 'Student outcomes' },
    { key: 'weak-topics', label: 'Weak topics' },
    { key: 'ai-usage', label: 'AI usage' },
  ];

  ngOnInit(): void {
    this.switch('students');
  }

  switch(tab: Tab): void {
    this.tab.set(tab);
    const onErr = (e: { status?: number }) => { if (e?.status === 403) this.denied.set(true); };
    if (tab === 'students' && !this.students()) this.api.students().subscribe({ next: (r) => this.students.set(r), error: onErr });
    if (tab === 'weak-topics' && this.weakTopics().length === 0) this.api.weakTopics().subscribe({ next: (r) => this.weakTopics.set(r), error: onErr });
    if (tab === 'ai-usage' && !this.aiUsage()) this.api.aiUsage().subscribe({ next: (r) => this.aiUsage.set(r), error: onErr });
  }

  download(): void {
    const report = this.tab();
    this.downloading.set(true);
    this.api.downloadCsv(report).subscribe({
      next: (csv) => {
        this.downloading.set(false);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success('CSV exported');
      },
      error: (e) => {
        this.downloading.set(false);
        this.toast.error(e?.message ?? 'Export failed');
      },
    });
  }
}
