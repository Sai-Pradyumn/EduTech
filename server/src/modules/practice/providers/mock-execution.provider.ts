import { Injectable } from '@nestjs/common';
import {
  CodeExecutionProvider,
  CodeRunRequest,
  CodeRunResult,
  LANGUAGE_LABELS,
  LanguageInfo,
  SUPPORTED_LANGUAGES,
  CLIENT_EXECUTED_LANGUAGES,
} from '../practice.types';

/**
 * No-infra fallback. Does NOT execute code — returns honestly-labelled
 * `simulated` results so the studio works with zero runner infrastructure (and
 * is the only path for SQL here). The real runner is Piston; this catches it
 * being disabled or unreachable.
 */
@Injectable()
export class MockExecutionProvider implements CodeExecutionProvider {
  readonly id = 'mock';

  supports(): boolean {
    return true;
  }

  runCode(req: CodeRunRequest): Promise<CodeRunResult> {
    const lines = req.code.split('\n').length;
    return Promise.resolve({
      ok: true,
      stdout: '',
      durationMs: 0,
      simulated: true,
      note: `Dry-run: ${req.language} isn't executed in this environment (${lines} line${lines === 1 ? '' : 's'} received). Ask Asta to trace it with you.`,
    });
  }

  listSupportedLanguages(): Promise<readonly LanguageInfo[]> {
    return Promise.resolve(
      SUPPORTED_LANGUAGES.map((id) => ({
        id,
        label: LANGUAGE_LABELS[id],
        execution: CLIENT_EXECUTED_LANGUAGES.includes(id)
          ? 'browser'
          : 'simulated',
      })),
    );
  }
}
