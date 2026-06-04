/** Frontend mirror of the Practice Studio contract (server practice.types.ts). */

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'c'
  | 'go'
  | 'rust'
  | 'bash'
  | 'sql';

export interface LanguageInfo {
  id: SupportedLanguage;
  label: string;
  /** browser = in-browser sandbox · runner = isolated server runner · simulated = dry-run only. */
  execution: 'browser' | 'runner' | 'simulated';
}

export interface CodeFile {
  name: string;
  content: string;
}

export interface CodeRunRequest {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
  /** Extra files for multi-file programs (first runs as the entry). */
  files?: CodeFile[];
}

export interface CodeRunResult {
  ok: boolean;
  stdout: string;
  stderr?: string;
  durationMs: number;
  simulated: boolean;
  note?: string;
}

export interface TestOutcome {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface CodeValidationResult {
  ok: boolean;
  passed: number;
  total: number;
  results: TestOutcome[];
  stdout: string;
  stderr?: string;
  simulated: boolean;
  note?: string;
}

/** How a problem is graded: a `solution` function (JS, in-browser) or stdin→stdout. */
export type PracticeHarness = 'function' | 'stdio';

export interface FunctionTest {
  name: string;
  /** Positional args passed to the learner's `solution` function. */
  input: unknown[];
  expected: unknown;
}

export interface StdioTest {
  name: string;
  stdin: string;
  expectedStdout: string;
}

/** A learner-saved Free Play snippet (persisted server-side). */
export interface SavedSnippet {
  id: string;
  title: string;
  language: SupportedLanguage;
  files: CodeFile[];
  stdin: string;
  updatedAt: string;
}

export type RunKind = 'run' | 'submit' | 'free' | 'terminal';

/** One entry in the studio's recent-runs history. */
export interface PracticeRunRecord {
  id: string;
  language: SupportedLanguage;
  kind: RunKind;
  title?: string;
  ok: boolean;
  simulated: boolean;
  durationMs: number;
  passed?: number;
  total?: number;
  codePreview: string;
  at: string;
}

/** A ready-to-attempt practice problem. */
export interface PracticeProblem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: SupportedLanguage;
  skill: string;
  statement: string;
  starterCode: string;
  harness: PracticeHarness;
  functionTests?: FunctionTest[];
  stdioTests?: StdioTest[];
}
