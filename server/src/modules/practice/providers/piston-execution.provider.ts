import { Injectable, Logger } from '@nestjs/common';
import {
  CodeExecutionProvider,
  CodeRunRequest,
  CodeRunResult,
  LANGUAGE_LABELS,
  LanguageInfo,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from '../practice.types';

/** Our language id → Piston language name. SQL has no Piston runtime (handled by Mock). */
const PISTON_LANG: Partial<Record<SupportedLanguage, string>> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  cpp: 'c++',
  c: 'c',
  go: 'go',
  rust: 'rust',
  bash: 'bash',
};

const FILE_NAME: Partial<Record<SupportedLanguage, string>> = {
  javascript: 'main.js',
  typescript: 'main.ts',
  python: 'main.py',
  java: 'Main.java',
  cpp: 'main.cpp',
  c: 'main.c',
  go: 'main.go',
  rust: 'main.rs',
  bash: 'main.sh',
};

interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}
interface PistonExecResponse {
  run: { stdout: string; stderr: string; code: number | null; output: string };
  compile?: { stdout: string; stderr: string; code: number | null };
}

const RUN_TIMEOUT_MS = 12_000;

/**
 * Real multi-language execution via a Piston server (default: the free public
 * emkc.org instance — no API key). Disabled with PRACTICE_DISABLE_PISTON=1; the
 * base URL is overridable with PISTON_URL (e.g. a self-hosted Piston). Note:
 * submitted code is sent to that runner — by design, opt-out via env.
 */
@Injectable()
export class PistonExecutionProvider implements CodeExecutionProvider {
  readonly id = 'piston';
  private readonly logger = new Logger(PistonExecutionProvider.name);
  private readonly base =
    process.env.PISTON_URL ?? 'https://emkc.org/api/v2/piston';
  private readonly disabled = process.env.PRACTICE_DISABLE_PISTON === '1';
  private versions: Map<string, string> | null = null;

  supports(language: SupportedLanguage): boolean {
    return !this.disabled && !!PISTON_LANG[language];
  }

  listSupportedLanguages(): Promise<readonly LanguageInfo[]> {
    return Promise.resolve(
      SUPPORTED_LANGUAGES.map((id) => ({
        id,
        label: LANGUAGE_LABELS[id],
        execution:
          id === 'javascript'
            ? 'browser'
            : this.supports(id)
              ? 'runner'
              : 'simulated',
      })),
    );
  }

  async runCode(req: CodeRunRequest): Promise<CodeRunResult> {
    const language = PISTON_LANG[req.language];
    if (!language) throw new Error(`Piston has no runtime for ${req.language}`);
    const version = await this.versionFor(language);
    const start = Date.now();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), RUN_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.base}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language,
          version,
          files:
            req.files && req.files.length
              ? req.files.map((f) => ({ name: f.name, content: f.content }))
              : [
                  {
                    name: FILE_NAME[req.language] ?? 'main.txt',
                    content: req.code,
                  },
                ],
          stdin: req.stdin ?? '',
          run_timeout: RUN_TIMEOUT_MS,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Piston HTTP ${res.status}`);
      const data = (await res.json()) as PistonExecResponse;
      const compileErr =
        data.compile && data.compile.code !== 0 ? data.compile.stderr : '';
      const stderr = [compileErr, data.run.stderr].filter(Boolean).join('\n');
      return {
        ok: !compileErr && data.run.code === 0,
        stdout: data.run.stdout ?? '',
        stderr: stderr || undefined,
        durationMs: Date.now() - start,
        simulated: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Pick (and cache) the newest available version for a Piston language. */
  private async versionFor(language: string): Promise<string> {
    if (!this.versions) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), RUN_TIMEOUT_MS);
      try {
        const res = await fetch(`${this.base}/runtimes`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Piston runtimes HTTP ${res.status}`);
        const runtimes = (await res.json()) as PistonRuntime[];
        const map = new Map<string, string>();
        for (const r of runtimes) {
          const names = [r.language, ...(r.aliases ?? [])];
          for (const n of names) if (!map.has(n)) map.set(n, r.version);
        }
        this.versions = map;
      } finally {
        clearTimeout(timer);
      }
    }
    const v = this.versions.get(language);
    if (!v) throw new Error(`No Piston version for ${language}`);
    return v;
  }
}
