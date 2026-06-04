import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { MockExecutionProvider } from './providers/mock-execution.provider';
import { PistonExecutionProvider } from './providers/piston-execution.provider';
import {
  CodeRunRequest,
  CodeRunResult,
  CodeValidationRequest,
  CodeValidationResult,
  LanguageInfo,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  TestOutcome,
} from './practice.types';

const MAX_OUTPUT_CHARS = 10_000;
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60_000;

/**
 * Orchestrates code execution safely: language allowlist, per-user rate limit,
 * output truncation, then delegates to the best provider (Piston when it can run
 * the language and is reachable; Mock otherwise). Test grading runs the program
 * once per stdio case and compares trimmed stdout. The process never runs user code.
 */
@Injectable()
export class PracticeExecutionService {
  private readonly logger = new Logger(PracticeExecutionService.name);
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly piston: PistonExecutionProvider,
    private readonly mock: MockExecutionProvider,
    private readonly ledger: LedgerService,
    private readonly mistakes: MistakesService,
  ) {}

  listLanguages(): Promise<readonly LanguageInfo[]> {
    return this.piston.listSupportedLanguages();
  }

  async run(userId: string, req: CodeRunRequest): Promise<CodeRunResult> {
    this.assertLanguage(req.language);
    this.enforceRate(userId);
    const result = await this.execute(req);
    return {
      ...result,
      stdout: this.cap(result.stdout),
      stderr: this.capOpt(result.stderr),
    };
  }

  async submit(
    userId: string,
    req: CodeValidationRequest,
  ): Promise<CodeValidationResult> {
    this.assertLanguage(req.language);
    this.enforceRate(userId);

    const results: TestOutcome[] = [];
    let lastStdout = '';
    let lastStderr: string | undefined;
    let simulated = false;

    for (const test of req.tests) {
      const out = await this.execute({
        language: req.language,
        code: req.code,
        stdin: test.stdin,
      });
      lastStdout = out.stdout;
      lastStderr = out.stderr;
      simulated = simulated || out.simulated;
      if (out.simulated) {
        results.push({
          name: test.name,
          passed: false,
          detail: 'Not auto-graded here — review with Asta.',
        });
        continue;
      }
      const got = out.stdout.trim();
      const want = test.expectedStdout.trim();
      results.push({
        name: test.name,
        passed: out.ok && got === want,
        detail: out.ok
          ? got === want
            ? undefined
            : `expected "${want}", got "${got}"`
          : (out.stderr ?? 'runtime error'),
      });
    }

    const passedCount = results.filter((r) => r.passed).length;
    return {
      ok: results.every((r) => r.passed),
      passed: passedCount,
      total: req.tests.length,
      results,
      stdout: this.cap(lastStdout),
      stderr: this.capOpt(lastStderr),
      simulated,
      note: simulated
        ? 'Some cases were simulated — a live runner wasn’t available.'
        : undefined,
    };
  }

  /**
   * Feed a practice outcome into the learner's record: a pass logs a Proof Ledger
   * event (→ Skill Passport); a fail captures a Mistake to repair. Called once by
   * the client after grading, so browser-JS and server-graded results both count.
   * Never throws into the caller.
   */
  async logOutcome(
    userId: string,
    input: {
      problemTitle?: string;
      skill?: string;
      language: string;
      passed: boolean;
    },
  ): Promise<{ ok: true }> {
    const label = input.problemTitle ?? 'coding practice';
    try {
      if (input.passed) {
        await this.ledger.record(userId, {
          kind: 'practice_solved',
          title: `Solved: ${label}`,
          detail: `Passed all tests in ${input.language}.`,
          skills: input.skill ? [input.skill] : [],
          verificationLevel: 'system',
        });
      } else {
        await this.mistakes.captureManual(userId, {
          concept: input.skill ?? label,
          severity: 55,
          source: 'manual',
        });
      }
    } catch (err) {
      this.logger.warn(
        `Practice outcome record failed: ${(err as Error).message}`,
      );
    }
    return { ok: true };
  }

  /** Try the real runner; fall back to the mock on any failure so the studio never hard-fails. */
  private async execute(req: CodeRunRequest): Promise<CodeRunResult> {
    if (this.piston.supports(req.language)) {
      try {
        return await this.piston.runCode(req);
      } catch (err) {
        this.logger.warn(
          `Piston failed for ${req.language}, falling back to mock: ${(err as Error).message}`,
        );
      }
    }
    return this.mock.runCode(req);
  }

  private assertLanguage(
    language: string,
  ): asserts language is SupportedLanguage {
    if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
      throw new BadRequestException(`Unsupported language: ${language}`);
    }
  }

  private enforceRate(userId: string): void {
    const now = Date.now();
    const recent = (this.hits.get(userId) ?? []).filter(
      (t) => now - t < RATE_WINDOW_MS,
    );
    if (recent.length >= RATE_LIMIT) {
      throw new HttpException(
        'Too many runs — give it a moment.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(userId, recent);
  }

  private cap(s: string): string {
    return s.length > MAX_OUTPUT_CHARS
      ? `${s.slice(0, MAX_OUTPUT_CHARS)}\n…(output truncated)`
      : s;
  }
  private capOpt(s: string | undefined): string | undefined {
    return s === undefined ? undefined : this.cap(s);
  }
}
