import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PracticeService } from './practice.service';
import { PracticeProblem } from '../models';

describe('PracticeService hidden-case masking', () => {
  let svc: PracticeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(PracticeService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const problem: PracticeProblem = {
    id: 'py-sum',
    title: 'Sum two integers',
    difficulty: 'easy',
    language: 'python',
    skill: 'I/O',
    statement: '',
    starterCode: '',
    harness: 'stdio',
    stdioTests: [
      { name: 'adds positives', stdin: '1 2', expectedStdout: '3' },
      { name: 'both negative', stdin: '-1 -2', expectedStdout: '-3', hidden: true },
    ],
  };

  it('masks a failing hidden case: neutral name, no expected/got leak, honest fail', async () => {
    const promise = svc.submit(problem, 'print(1)');
    const req = http.expectOne((r) => r.url.endsWith('/practice/submit'));
    req.flush({
      success: true,
      data: {
        ok: false,
        passed: 1,
        total: 2,
        results: [
          { name: 'adds positives', passed: true },
          { name: 'both negative', passed: false, detail: 'expected "-3", got "3"' },
        ],
        stdout: '',
        simulated: false,
      },
    });
    const out = await promise;
    expect(out.results[0]).toEqual({ name: 'adds positives', passed: true });
    expect(out.results[1].name).toBe('Hidden case 1');
    expect(out.results[1].passed).toBe(false);
    expect(out.results[1].detail).not.toContain('-3');
    expect(out.results[1].detail).toContain('hidden edge case');
  });

  it('passing hidden cases show masked names and no detail', async () => {
    const promise = svc.submit(problem, 'a, b = map(int, input().split())\nprint(a + b)');
    const req = http.expectOne((r) => r.url.endsWith('/practice/submit'));
    req.flush({
      success: true,
      data: {
        ok: true,
        passed: 2,
        total: 2,
        results: [
          { name: 'adds positives', passed: true },
          { name: 'both negative', passed: true, detail: undefined },
        ],
        stdout: '',
        simulated: false,
      },
    });
    const out = await promise;
    expect(out.results[1]).toEqual({ name: 'Hidden case 1', passed: true, detail: undefined });
  });

  it('leaves problems without hidden cases untouched', async () => {
    const open: PracticeProblem = {
      ...problem,
      stdioTests: [{ name: 'adds positives', stdin: '1 2', expectedStdout: '3' }],
    };
    const promise = svc.submit(open, 'code');
    const req = http.expectOne((r) => r.url.endsWith('/practice/submit'));
    const payload = {
      ok: true,
      passed: 1,
      total: 1,
      results: [{ name: 'adds positives', passed: true }],
      stdout: '',
      simulated: false,
    };
    req.flush({ success: true, data: payload });
    expect((await promise).results).toEqual(payload.results);
  });
});
