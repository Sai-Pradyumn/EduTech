import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AgentService } from '../../../core/services/agent.service';
import { PracticeService } from '../../../core/services/practice.service';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { AstaOsOrbComponent } from '../asta-os-orb.component';
import { AstaCodeEditorComponent } from '../practice/asta-code-editor.component';
import { NOTEBOOK_CELLS, NOTEBOOK_DATASET, NOTEBOOK_TITLE, NotebookCell } from './notebook-content';

interface CellState {
  code: string;
  output: string;
  error: string | null;
  running: boolean;
}

/**
 * ML / Notebook practice. A guided notebook over a sample dataset: markdown
 * guidance + editable Python cells that run for real on the server runner
 * (Piston), with a dataset preview and per-cell + whole-notebook Asta feedback.
 * Real model training needs libraries the sandbox may lack — Asta explains those
 * concepts. Page under /app/os/notebook.
 */
@Component({
  selector: 'asta-os-notebook',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'asta-os-root' },
  imports: [RouterLink, MarkdownPipe, AstaOsOrbComponent, AstaCodeEditorComponent],
  template: `
    <div class="nb">
      <header class="bar">
        <a routerLink="/app/os" class="back" aria-label="Back to Asta">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          Asta
        </a>
        <div class="titles"><h1>{{ title }}</h1><p class="sub">ML Notebook · Python runs on the server runner</p></div>
        <button type="button" class="btn ghost" [disabled]="thinking()" (click)="reviewNotebook()">Ask Asta to review</button>
      </header>

      <div class="grid">
        <section class="cells">
          <div class="dataset">
            <p class="kick">Dataset · {{ dataset.name }}</p>
            <div class="ds-grid">
              <table>
                <thead><tr>@for (c of dataset.columns; track c) {<th>{{ c }}</th>}</tr></thead>
                <tbody>
                  @for (row of dataset.rows; track $index) {
                    <tr>@for (cell of row; track $index) {<td>{{ cell }}</td>}</tr>
                  }
                </tbody>
              </table>

              <figure class="chart" aria-label="Scatter of study hours vs attendance, coloured by pass/fail">
                <svg viewBox="0 0 120 100" preserveAspectRatio="none">
                  <line x1="12" y1="88" x2="116" y2="88" class="axis" />
                  <line x1="12" y1="6" x2="12" y2="88" class="axis" />
                  @for (p of points; track $index) {
                    <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.4" [class.pass]="p.pass" [class.fail]="!p.pass" />
                  }
                </svg>
                <figcaption><span class="lg pass">passed</span><span class="lg fail">failed</span><span class="ax">x: hours · y: attendance</span></figcaption>
              </figure>
            </div>
          </div>

          @for (cell of cells; track cell.id) {
            @if (cell.kind === 'markdown') {
              <div class="md prose" [innerHTML]="cell.content | markdown"></div>
            } @else {
              <div class="cell">
                <asta-code-editor [value]="state(cell.id).code" language="python" (valueChange)="setCode(cell.id, $event)" ariaLabel="Notebook cell" />
                <div class="cell-actions">
                  <button type="button" class="btn run" [disabled]="state(cell.id).running" (click)="runCell(cell.id)">▶ Run</button>
                  <button type="button" class="btn ghost sm" [disabled]="thinking()" (click)="explainCell(cell.id)">Ask Asta</button>
                </div>
                @if (state(cell.id).running) { <pre class="out muted">Running…</pre> }
                @else if (state(cell.id).error) { <pre class="out err">{{ state(cell.id).error }}</pre> }
                @else if (state(cell.id).output) { <pre class="out">{{ state(cell.id).output }}</pre> }
              </div>
            }
          }
        </section>

        <aside class="asta">
          <div class="head-row"><p class="kick">Asta</p><asta-os-orb size="sm" [state]="thinking() ? 'thinking' : 'idle'" /></div>
          @if (thinking()) {
            <p class="empty">Asta is reviewing…</p>
          } @else if (astaAnswer()) {
            <div class="prose" [innerHTML]="astaAnswer() | markdown"></div>
          } @else {
            <p class="empty">Run the cells, then ask Asta to explain a result or review your whole notebook.</p>
          }
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; min-height: 100%; background: var(--asta-bg); color: var(--asta-text); }
      .nb { max-width: 1320px; margin: 0 auto; padding: 16px; }
      .bar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
      .back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--asta-muted); padding: 6px 10px; border-radius: 999px; border: 1px solid var(--asta-border); }
      .back:hover { color: var(--asta-text); }
      .titles { flex: 1; min-width: 0; }
      .titles h1 { font-family: var(--display); font-size: 20px; font-weight: 600; }
      .sub { font-size: 11.5px; color: var(--asta-muted); }

      .grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr); gap: 16px; }
      @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }

      .dataset { padding: 14px 16px; border-radius: 14px; background: var(--asta-panel); border: 1px solid var(--asta-border); margin-bottom: 14px; }
      .kick { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-muted); margin-bottom: 8px; }
      .ds-grid { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; }
      @media (max-width: 640px) { .ds-grid { grid-template-columns: 1fr; } }
      table { border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; }
      th, td { border: 1px solid var(--asta-border); padding: 5px 12px; text-align: right; }
      th { color: var(--asta-cyan); }
      .chart svg { width: 100%; height: 150px; }
      .chart .axis { stroke: var(--asta-border); stroke-width: 0.6; }
      .chart circle.pass { fill: var(--asta-green); }
      .chart circle.fail { fill: var(--asta-coral); }
      .chart figcaption { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; font-size: 11px; color: var(--asta-muted); }
      .chart .lg { display: inline-flex; align-items: center; gap: 5px; }
      .chart .lg::before { content: ''; width: 8px; height: 8px; border-radius: 999px; }
      .chart .lg.pass::before { background: var(--asta-green); }
      .chart .lg.fail::before { background: var(--asta-coral); }
      .chart .ax { margin-left: auto; font-family: var(--mono); }

      .md { margin: 6px 2px 12px; }
      .cell { margin-bottom: 16px; }
      .cell-actions { display: flex; gap: 8px; margin-top: 8px; }
      .btn { font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--asta-border); color: var(--asta-text); }
      .btn.sm { padding: 6px 12px; }
      .btn:disabled { opacity: .5; cursor: default; }
      .btn.run { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); border-color: transparent; }
      .btn.ghost { color: var(--asta-muted); background: transparent; }
      .out { font-family: var(--mono); font-size: 12.5px; line-height: 1.5; background: var(--asta-bg); border: 1px solid var(--asta-border); border-radius: 10px; padding: 10px 12px; margin-top: 8px; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow: auto; }
      .out.err { color: var(--asta-coral); }
      .out.muted { color: var(--asta-muted); }

      .asta { padding: 16px; border-radius: 16px; background: var(--asta-panel); border: 1px solid var(--asta-border); align-self: start; position: sticky; top: 16px; }
      .head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .head-row .kick { margin-bottom: 0; }
      .empty { font-size: 13px; color: var(--asta-muted); line-height: 1.55; }
      .prose { font-size: 14px; line-height: 1.6; }
      .prose :is(h1, h2, h3) { font-family: var(--display); margin: 6px 0 8px; }
      .prose :is(code) { font-family: var(--mono); background: var(--asta-panel-strong); padding: 1px 5px; border-radius: 5px; font-size: 12.5px; }
      .prose :is(pre) { background: var(--asta-bg); padding: 10px 12px; border-radius: 10px; overflow: auto; border: 1px solid var(--asta-border); }
    `,
  ],
})
export class AstaOsNotebookComponent {
  private readonly practice = inject(PracticeService);
  private readonly agent = inject(AgentService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly title = NOTEBOOK_TITLE;
  protected readonly dataset = NOTEBOOK_DATASET;
  protected readonly cells = NOTEBOOK_CELLS;

  /** Scale dataset rows [hours, attendance, passed] into the 120×100 chart viewBox. */
  protected readonly points = ((): { x: number; y: number; pass: boolean }[] => {
    const rows = NOTEBOOK_DATASET.rows.map((r) => r.map(Number));
    const xs = rows.map((r) => r[0]);
    const ys = rows.map((r) => r[1]);
    const span = (v: number, min: number, max: number) => (max === min ? 0.5 : (v - min) / (max - min));
    const [xMin, xMax] = [Math.min(...xs), Math.max(...xs)];
    const [yMin, yMax] = [Math.min(...ys), Math.max(...ys)];
    return rows.map((r) => ({
      x: 16 + span(r[0], xMin, xMax) * 96,
      y: 84 - span(r[1], yMin, yMax) * 76,
      pass: r[2] === 1,
    }));
  })();

  protected readonly thinking = signal(false);
  protected readonly astaAnswer = signal<string | null>(null);
  private readonly states = signal<Record<string, CellState>>(this.seedStates());

  protected state(id: string): CellState {
    return this.states()[id];
  }

  protected setCode(id: string, code: string): void {
    this.states.update((s) => ({ ...s, [id]: { ...s[id], code } }));
  }

  protected async runCell(id: string): Promise<void> {
    this.patch(id, { running: true, error: null, output: '' });
    try {
      const result = await this.practice.run({ language: 'python', code: this.state(id).code });
      this.patch(id, {
        running: false,
        output: result.simulated ? (result.note ?? 'Simulated — no runner available.') : result.stdout || '(no output)',
        error: result.stderr ?? null,
      });
    } catch {
      this.patch(id, { running: false, error: 'Could not run this cell.' });
    }
  }

  protected explainCell(id: string): void {
    const cell = this.cells.find((c) => c.id === id);
    if (!cell) return;
    const st = this.state(id);
    this.ask(
      `Explain what this notebook cell does and how to improve it. Keep it concise.\n\n\`\`\`python\n${st.code}\n\`\`\`${st.output ? `\n\nIts output was:\n${st.output}` : ''}${st.error ? `\n\nIt errored:\n${st.error}` : ''}`,
    );
  }

  protected reviewNotebook(): void {
    const code = this.cells
      .filter((c): c is NotebookCell & { kind: 'code' } => c.kind === 'code')
      .map((c) => this.state(c.id).code)
      .join('\n\n# ── next cell ──\n');
    this.ask(
      `Review my ML notebook on predicting pass/fail from study hours + attendance. Give brief, encouraging feedback and one concrete next step (e.g. precision/recall, a learned threshold, or a train/test split).\n\n\`\`\`python\n${code}\n\`\`\``,
    );
  }

  private ask(message: string): void {
    if (this.thinking()) return;
    this.thinking.set(true);
    this.astaAnswer.set(null);
    this.agent
      .send(message, { mode: 'explain', agentType: 'tutor' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.astaAnswer.set(r.response.answer);
          this.thinking.set(false);
        },
        error: () => {
          this.astaAnswer.set('Asta couldn’t respond just now. Try again in a moment.');
          this.thinking.set(false);
        },
      });
  }

  private patch(id: string, partial: Partial<CellState>): void {
    this.states.update((s) => ({ ...s, [id]: { ...s[id], ...partial } }));
  }

  private seedStates(): Record<string, CellState> {
    const out: Record<string, CellState> = {};
    for (const cell of NOTEBOOK_CELLS) {
      if (cell.kind === 'code') out[cell.id] = { code: cell.content, output: '', error: null, running: false };
    }
    return out;
  }
}
