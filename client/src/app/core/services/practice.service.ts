import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  CodeFile,
  CodeRunRequest,
  CodeRunResult,
  CodeValidationResult,
  FunctionTest,
  LanguageInfo,
  PracticeProblem,
  PracticeRunRecord,
  SavedSnippet,
  SupportedLanguage,
} from '../models';

interface WorkerReply {
  ok: boolean;
  logs: string[];
  results: { name: string; passed: boolean; detail?: string }[];
  error?: string;
}

const WORKER_SRC = `
self.onmessage = function (e) {
  var data = e.data || {};
  var logs = [];
  function stringify(v){ try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (_) { return String(v); } }
  function log(){ logs.push(Array.prototype.slice.call(arguments).map(stringify).join(' ')); }
  var sandboxConsole = { log: log, info: log, warn: log, error: log, debug: log };
  try {
    var factory = new Function('console', data.code + '\\n;return (typeof solution !== "undefined") ? solution : undefined;');
    var solution = factory(sandboxConsole);
    if (!data.tests || !data.tests.length) {
      self.postMessage({ ok: true, logs: logs, results: [] });
      return;
    }
    if (typeof solution !== 'function') {
      self.postMessage({ ok: false, logs: logs, results: [], error: 'Define a function named "solution" so your tests can run.' });
      return;
    }
    var results = data.tests.map(function (t) {
      try {
        var got = solution.apply(null, t.input || []);
        var pass = stringify(got) === stringify(t.expected);
        return { name: t.name, passed: pass, detail: pass ? undefined : ('expected ' + stringify(t.expected) + ', got ' + stringify(got)) };
      } catch (err) {
        return { name: t.name, passed: false, detail: String(err && err.message ? err.message : err) };
      }
    });
    self.postMessage({ ok: true, logs: logs, results: results });
  } catch (err) {
    self.postMessage({ ok: false, logs: logs, results: [], error: String(err && err.message ? err.message : err) });
  }
};
`;

const EXEC_TIMEOUT_MS = 4_000;

/**
 * Practice Studio facade. JavaScript runs locally in a sandboxed Web Worker
 * (never leaves the browser); every other language goes to the server runner
 * (Piston, or simulated fallback). `run` executes; `submit` grades a problem
 * using its harness (in-browser function tests, or server stdin→stdout tests).
 */
@Injectable({ providedIn: 'root' })
export class PracticeService {
  private readonly api = inject(ApiService);

  languages(): Observable<LanguageInfo[]> {
    return this.api.get<LanguageInfo[]>('/practice/languages');
  }

  run(req: CodeRunRequest): Promise<CodeRunResult> {
    if (req.language === 'javascript') return this.runJs(req.code);
    return this.firstValue(this.api.post<CodeRunResult>('/practice/run', req)).catch(
      (e): CodeRunResult => ({ ok: false, stdout: '', stderr: this.errorText(e), durationMs: 0, simulated: false }),
    );
  }

  async submit(problem: PracticeProblem, code: string): Promise<CodeValidationResult> {
    if (problem.harness === 'function') {
      const tests = problem.functionTests ?? [];
      return this.maskHidden(await this.validateJs(code, tests), tests);
    }
    const tests = problem.stdioTests ?? [];
    const result = await this.firstValue(
      this.api.post<CodeValidationResult>('/practice/submit', { language: problem.language, code, tests }),
    ).catch(
      (e): CodeValidationResult => ({
        ok: false,
        passed: 0,
        total: tests.length,
        results: [],
        stdout: '',
        stderr: this.errorText(e),
        simulated: false,
      }),
    );
    return this.maskHidden(result, tests);
  }

  /** Hidden cases grade like any other, but never reveal their name, inputs or expectation. */
  private maskHidden(
    result: CodeValidationResult,
    tests: ReadonlyArray<{ hidden?: boolean }>,
  ): CodeValidationResult {
    if (!tests.some((t) => t.hidden)) return result;
    let n = 0;
    return {
      ...result,
      results: result.results.map((r, i) => {
        if (!tests[i]?.hidden) return r;
        n++;
        return {
          name: `Hidden case ${n}`,
          passed: r.passed,
          detail: r.passed
            ? undefined
            : 'Fails a hidden edge case — think about an input you haven’t covered yet.',
        };
      }),
    };
  }

  private errorText(e: unknown): string {
    const err = e as { status?: number; error?: { message?: string }; message?: string };
    if (err?.status === 429) return 'Too many runs — wait a moment and try again.';
    if (err?.status === 0 || err?.status === undefined) return 'Couldn’t reach the runner. Is the backend running?';
    return err?.error?.message ?? err?.message ?? 'Run failed on the server.';
  }

  /** Log a graded outcome → Proof Ledger (pass) or Mistake OS (fail). Best-effort. */
  record(problem: PracticeProblem, passed: boolean): Observable<{ ok: true }> {
    return this.api.post<{ ok: true }>('/practice/record', {
      language: problem.language,
      passed,
      problemTitle: problem.title,
      skill: problem.skill,
    });
  }

  // ── Snippet library + run history ──

  listSnippets(): Observable<SavedSnippet[]> {
    return this.api.get<SavedSnippet[]>('/practice/snippets');
  }

  saveSnippet(input: {
    title: string;
    language: SupportedLanguage;
    files: CodeFile[];
    stdin?: string;
  }): Observable<SavedSnippet> {
    return this.api.post<SavedSnippet>('/practice/snippets', input);
  }

  deleteSnippet(id: string): Observable<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`/practice/snippets/${id}`);
  }

  history(): Observable<PracticeRunRecord[]> {
    return this.api.get<PracticeRunRecord[]>('/practice/history');
  }

  private async runJs(code: string): Promise<CodeRunResult> {
    const start = performance.now();
    const reply = await this.execInWorker(code, []);
    return {
      ok: reply.ok,
      stdout: reply.logs.join('\n'),
      stderr: reply.error,
      durationMs: Math.round(performance.now() - start),
      simulated: false,
    };
  }

  private async validateJs(code: string, tests: FunctionTest[]): Promise<CodeValidationResult> {
    const reply = await this.execInWorker(code, tests);
    const passed = reply.results.filter((r) => r.passed).length;
    return {
      ok: reply.ok && passed === tests.length && tests.length > 0,
      passed,
      total: tests.length,
      results: reply.results,
      stdout: reply.logs.join('\n'),
      stderr: reply.error,
      simulated: false,
    };
  }

  private execInWorker(code: string, tests: FunctionTest[]): Promise<WorkerReply> {
    return new Promise((resolve) => {
      if (typeof Worker === 'undefined') {
        resolve({ ok: false, logs: [], results: [], error: 'In-browser execution is not available here.' });
        return;
      }
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'application/javascript' }));
      let worker: Worker | undefined;
      const cleanup = (): void => {
        clearTimeout(timer);
        worker?.terminate();
        URL.revokeObjectURL(url);
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve({ ok: false, logs: [], results: [], error: 'Timed out after 4s — check for an infinite loop.' });
      }, EXEC_TIMEOUT_MS);

      try {
        worker = new Worker(url);
        worker.onmessage = (e: MessageEvent<WorkerReply>) => {
          cleanup();
          resolve(e.data);
        };
        worker.onerror = (e: ErrorEvent) => {
          cleanup();
          resolve({ ok: false, logs: [], results: [], error: e.message || 'Execution error.' });
        };
        worker.postMessage({ code, tests });
      } catch {
        cleanup();
        resolve({ ok: false, logs: [], results: [], error: 'In-browser execution is not available here.' });
      }
    });
  }

  private firstValue<T>(obs: Observable<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const sub = obs.subscribe({
        next: (v) => {
          resolve(v);
          sub.unsubscribe();
        },
        error: (err) => reject(err),
      });
    });
  }
}
