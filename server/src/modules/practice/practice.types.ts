/**
 * Code-execution contract for the Practice Studio. Providers run a program and
 * return its output; the service layers test-grading (stdin → expected stdout)
 * on top. The NestJS process never executes user code itself — real JS runs in
 * the browser sandbox, everything else goes to an isolated runner (Piston), with
 * a Mock fallback so the app still works with no network.
 */

export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'cpp',
  'c',
  'go',
  'rust',
  'bash',
  'sql',
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Languages whose execution is handled in the browser (real), not on the server. */
export const CLIENT_EXECUTED_LANGUAGES: readonly SupportedLanguage[] = [
  'javascript',
];

export interface LanguageInfo {
  readonly id: SupportedLanguage;
  readonly label: string;
  /** browser = in-browser sandbox · runner = isolated server runner · simulated = dry-run only. */
  readonly execution: 'browser' | 'runner' | 'simulated';
}

export interface CodeFile {
  readonly name: string;
  readonly content: string;
}

export interface CodeRunRequest {
  readonly language: SupportedLanguage;
  readonly code: string;
  readonly stdin?: string;
  /** Optional extra files for multi-file programs (the first runs as the entry). */
  readonly files?: readonly CodeFile[];
}

export interface CodeRunResult {
  /** Program exited cleanly (exit code 0, no runtime error). */
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr?: string;
  readonly durationMs: number;
  /** True when the result was simulated (no real execution happened). */
  readonly simulated: boolean;
  readonly note?: string;
}

/** A stdin → expected-stdout grading case. */
export interface StdioTest {
  readonly name: string;
  readonly stdin: string;
  readonly expectedStdout: string;
}

export interface CodeValidationRequest {
  readonly language: SupportedLanguage;
  readonly code: string;
  readonly tests: readonly StdioTest[];
}

export interface TestOutcome {
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface CodeValidationResult {
  readonly ok: boolean;
  readonly passed: number;
  readonly total: number;
  readonly results: readonly TestOutcome[];
  readonly stdout: string;
  readonly stderr?: string;
  readonly simulated: boolean;
  readonly note?: string;
}

/** A pluggable code-execution backend: runs a program, lists what it supports. */
export interface CodeExecutionProvider {
  readonly id: string;
  /** Whether this provider can currently run the given language. */
  supports(language: SupportedLanguage): boolean;
  runCode(req: CodeRunRequest): Promise<CodeRunResult>;
  listSupportedLanguages(): Promise<readonly LanguageInfo[]>;
}

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  go: 'Go',
  rust: 'Rust',
  bash: 'Bash',
  sql: 'SQL',
};
