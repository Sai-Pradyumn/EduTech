import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { OrgContextService } from '../../core/services/org-context.service';
import { AiUsageReport, StudentOutcomesReport, WeakTopicRow } from '../../core/models';
import { BarChartComponent, DonutChartComponent, ChartDatum } from '../../shared/charts';
import { CountDirective } from '../../shared/directives/count.directive';

type Tab = 'students' | 'weak-topics' | 'ai-usage';

/**
 * Enterprise reports (B16). Org admins (admin.reports.view) get outcome / weak-topic /
 * AI-usage reports built on the Learning-Intelligence engine, each exportable to CSV.
 */
@Component({
    selector: 'asta-reports',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, FormsModule, BarChartComponent, DonutChartComponent, CountDirective],
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
    } @else if (loading()) {
      <div class="grid sm:grid-cols-3 gap-3 mb-4 motion-row-primary">
        @for (n of [0, 1, 2]; track n) {
          <div class="card stat motion-card-reveal" [style.--motion-card-index]="n">
            <span class="skel skel-num"></span><span class="skel skel-lbl"></span>
          </div>
        }
      </div>
      <div class="card motion-card-reveal motion-row-panel" style="padding:18px;--motion-card-index:0">
        <span class="skel skel-row"></span><span class="skel skel-row"></span><span class="skel skel-row"></span>
      </div>
    } @else if (error()) {
      <div class="card" style="padding:28px;text-align:center">
        <p class="font-display text-lg mb-1">Couldn't load this report</p>
        <p class="text-sm text-txt-soft mb-4">Something went wrong fetching the data. Please try again.</p>
        <button class="btn-go" (click)="retry()">↻ Retry</button>
      </div>
    } @else {
    @switch (tab()) {
      @case ('students') {
        @if (students(); as r) {
          <div class="grid sm:grid-cols-3 gap-3 mb-4 motion-row-primary">
            <div class="card stat motion-card-reveal" style="--motion-card-index:0"><span class="num" [astaCount]="r.studentCount">0</span><span class="lbl">Students</span></div>
            <div class="card stat motion-card-reveal" style="--motion-card-index:1"><span class="num" [astaCount]="r.avgHealth">0</span><span class="lbl">Avg health</span></div>
            <div class="card stat motion-card-reveal" style="--motion-card-index:2"><span class="num" [astaCount]="r.avgReadiness">0</span><span class="lbl">Avg readiness</span></div>
          </div>
          @if (r.rows.length > 1) {
            <div class="rep-sort">
              <span class="rep-sort-lbl">Sort by</span>
              <select [ngModel]="studentSort()" (ngModelChange)="studentSort.set($event)" aria-label="Sort student outcomes">
                <option value="health">Lowest health (at-risk first)</option>
                <option value="readiness">Highest readiness</option>
                <option value="quizzes">Most quizzes</option>
                <option value="projects">Most projects</option>
                <option value="active">Most active days</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>
          }
          <div class="card motion-card-reveal motion-row-panel" style="padding:0;overflow:auto;--motion-card-index:0">
            <table>
              <thead><tr><th>Name</th><th>Health</th><th>Readiness</th><th>Quizzes</th><th>Projects</th><th>Active days</th><th>Top weakness</th></tr></thead>
              <tbody>
                @for (row of sortedStudentRows(); track row.userId) {
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
          <div class="card mb-4 motion-card-reveal motion-row-primary" style="padding:18px;--motion-card-index:0">
            <p class="kicker mb-3" style="color:var(--coral-deep)">Avg severity by topic</p>
            <asta-bar-chart [horizontal]="true" tone="coral" [data]="weakTopicData()" label="Average weakness severity by topic" />
          </div>
        }
        <div class="card motion-card-reveal motion-row-panel" style="padding:0;overflow:auto;--motion-card-index:0">
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
          <div class="grid sm:grid-cols-3 gap-3 mb-4 motion-row-primary">
            <div class="card stat motion-card-reveal" style="--motion-card-index:0"><span class="num" [astaCount]="r.totalCalls">0</span><span class="lbl">Total AI calls</span></div>
            <div class="card stat motion-card-reveal" style="--motion-card-index:1"><span class="num" [astaCount]="r.totalTokens">0</span><span class="lbl">Tokens</span></div>
            <div class="card stat motion-card-reveal" style="--motion-card-index:2"><span class="num" [astaCount]="r.avgLatencyMs" suffix="ms">0</span><span class="lbl">Avg latency</span></div>
          </div>
          @if (aiAgentData().length) {
            <div class="card mb-4 motion-card-reveal motion-row-panel" style="padding:18px;--motion-card-index:0">
              <p class="kicker mb-3" style="color:var(--peri-deep)">Calls by agent</p>
              <asta-donut-chart [data]="aiAgentData()" centerLabel="calls" label="AI calls by agent" />
            </div>
          }
          <div class="card motion-card-reveal motion-row-3" style="padding:0;overflow:auto;--motion-card-index:0">
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
      /* Data rows respond: green-tinted highlight + slight indent on hover. */
      tbody tr { transition: background .15s var(--ease), transform .15s var(--ease); }
      tbody tr:hover { background: color-mix(in oklch, var(--green) 5%, transparent); transform: translateX(2px); }
      @media (prefers-reduced-motion: reduce) { tbody tr:hover { transform: none; } }
      .sub { font-size: 11px; color: var(--text-mute); }
      .empty { text-align: center; color: var(--text-mute); padding: 28px; }
      .bar { width: 90px; height: 6px; border-radius: 100px; background: var(--paper-3); overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 100px; background: var(--coral, oklch(0.72 0.17 28)); }
      .gen { font-size: 11px; font-family: var(--mono); color: var(--text-mute); margin-top: 10px; }
      .rep-sort { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
      .rep-sort-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); font-weight: 700; }
      .rep-sort select { padding: 6px 10px; border-radius: 9px; border: 1px solid var(--paper-3); background: var(--paper-2); color: var(--text); font-size: 12.5px; cursor: pointer; }
      .rep-sort select:focus { outline: none; border-color: var(--green); }
      .skel { display: block; border-radius: 8px; background: linear-gradient(90deg, var(--paper-2) 25%, var(--paper-3) 50%, var(--paper-2) 75%); background-size: 200% 100%; animation: skel-shimmer 1.4s ease infinite; }
      .skel-num { width: 60%; height: 28px; margin-bottom: 8px; }
      .skel-lbl { width: 40%; height: 11px; }
      .skel-row { width: 100%; height: 14px; margin: 8px 0; }
      .skel-row:nth-child(2) { width: 80%; }
      .skel-row:nth-child(3) { width: 65%; }
      @keyframes skel-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      @media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
    `,
    ]
})
export class ReportsComponent implements OnInit {
  private readonly api = inject(ReportService);
  private readonly toast = inject(ToastService);
  private readonly orgCtx = inject(OrgContextService);

  readonly tab = signal<Tab>('students');
  readonly students = signal<StudentOutcomesReport | null>(null);
  readonly weakTopics = signal<WeakTopicRow[]>([]);
  readonly aiUsage = signal<AiUsageReport | null>(null);
  readonly downloading = signal(false);
  readonly denied = signal(false);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly studentSort = signal<'health' | 'readiness' | 'quizzes' | 'projects' | 'active' | 'name'>('health');

  /** Student-outcomes rows sorted by the selected key (health ascending = at-risk first). */
  readonly sortedStudentRows = computed(() => {
    const rows = this.students()?.rows ?? [];
    const s = this.studentSort();
    const out = [...rows];
    switch (s) {
      case 'health': out.sort((a, b) => a.health - b.health); break;
      case 'readiness': out.sort((a, b) => b.readiness - a.readiness); break;
      case 'quizzes': out.sort((a, b) => b.quizzes - a.quizzes); break;
      case 'projects': out.sort((a, b) => b.projects - a.projects); break;
      case 'active': out.sort((a, b) => b.activeDays - a.activeDays); break;
      case 'name': out.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return out;
  });

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
    // Preflight the permission so we show the request-access state immediately
    // instead of firing report APIs that would 403 (PROOF-GAP-001).
    if (!this.orgCtx.has('admin.reports.view')) {
      this.denied.set(true);
      return;
    }
    this.switch('students');
  }

  switch(tab: Tab): void {
    this.tab.set(tab);
    this.error.set(false);
    const onErr = (e: { status?: number }) => {
      this.loading.set(false);
      if (e?.status === 403) this.denied.set(true);
      else this.error.set(true);
    };
    const done = () => this.loading.set(false);
    if (tab === 'students' && !this.students()) {
      this.loading.set(true);
      this.api.students().subscribe({ next: (r) => { this.students.set(r); done(); }, error: onErr });
    }
    if (tab === 'weak-topics' && this.weakTopics().length === 0) {
      this.loading.set(true);
      this.api.weakTopics().subscribe({ next: (r) => { this.weakTopics.set(r); done(); }, error: onErr });
    }
    if (tab === 'ai-usage' && !this.aiUsage()) {
      this.loading.set(true);
      this.api.aiUsage().subscribe({ next: (r) => { this.aiUsage.set(r); done(); }, error: onErr });
    }
  }

  /** Re-fetch the active tab after a transient error. */
  retry(): void {
    const tab = this.tab();
    if (tab === 'students') this.students.set(null);
    else if (tab === 'weak-topics') this.weakTopics.set([]);
    else if (tab === 'ai-usage') this.aiUsage.set(null);
    this.switch(tab);
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
