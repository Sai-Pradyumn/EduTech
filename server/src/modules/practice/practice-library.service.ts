import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CodeSnippet,
  CodeSnippetDocument,
} from './schemas/code-snippet.schema';
import {
  PracticeRun,
  PracticeRunDocument,
  RunKind,
} from './schemas/practice-run.schema';
import { SupportedLanguage } from './practice.types';

const MAX_SNIPPETS = 50;
const HISTORY_LIMIT = 25;
const PREVIEW_CHARS = 280;

export interface SnippetView {
  id: string;
  title: string;
  language: SupportedLanguage;
  files: { name: string; content: string }[];
  stdin: string;
  updatedAt: string;
}

export interface RunView {
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

/**
 * Persistence for the Practice Studio: saved Free Play snippets (list / save /
 * delete, capped per user) and a rolling "recent runs" history. Kept separate
 * from {@link PracticeExecutionService} so execution stays DB-free; logging is
 * best-effort and never blocks a run.
 */
@Injectable()
export class PracticeLibraryService {
  private readonly logger = new Logger(PracticeLibraryService.name);

  constructor(
    @InjectModel(CodeSnippet.name)
    private readonly snippets: Model<CodeSnippetDocument>,
    @InjectModel(PracticeRun.name)
    private readonly runs: Model<PracticeRunDocument>,
  ) {}

  async listSnippets(userId: string): Promise<SnippetView[]> {
    const docs = await this.snippets
      .find({ user: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .limit(MAX_SNIPPETS)
      .lean()
      .exec();
    return docs.map((d) => this.toSnippetView(d));
  }

  async saveSnippet(
    userId: string,
    input: {
      title: string;
      language: SupportedLanguage;
      files: { name: string; content: string }[];
      stdin?: string;
    },
  ): Promise<SnippetView> {
    const user = new Types.ObjectId(userId);
    const doc = await this.snippets.create({
      user,
      title: input.title.trim() || 'Untitled snippet',
      language: input.language,
      files: input.files,
      stdin: input.stdin ?? '',
    });
    // Trim the oldest beyond the cap so a learner can't grow this unbounded.
    await this.pruneSnippets(user);
    return this.toSnippetView(doc.toObject());
  }

  async deleteSnippet(userId: string, id: string): Promise<{ ok: true }> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Snippet not found');
    const res = await this.snippets
      .deleteOne({
        _id: new Types.ObjectId(id),
        user: new Types.ObjectId(userId),
      })
      .exec();
    if (res.deletedCount === 0)
      throw new NotFoundException('Snippet not found');
    return { ok: true };
  }

  async history(userId: string): Promise<RunView[]> {
    const docs = await this.runs
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean()
      .exec();
    return docs.map((d) => this.toRunView(d));
  }

  /** Best-effort: record one execution, then keep only the most recent few. */
  async logRun(
    userId: string,
    entry: {
      language: SupportedLanguage;
      kind: RunKind;
      ok: boolean;
      simulated: boolean;
      durationMs: number;
      title?: string;
      passed?: number;
      total?: number;
      code?: string;
    },
  ): Promise<void> {
    try {
      const user = new Types.ObjectId(userId);
      await this.runs.create({
        user,
        language: entry.language,
        kind: entry.kind,
        ok: entry.ok,
        simulated: entry.simulated,
        durationMs: entry.durationMs,
        title: entry.title,
        passed: entry.passed,
        total: entry.total,
        codePreview: (entry.code ?? '').slice(0, PREVIEW_CHARS),
      });
      await this.pruneRuns(user);
    } catch (err) {
      this.logger.warn(`Run history log failed: ${(err as Error).message}`);
    }
  }

  private async pruneSnippets(user: Types.ObjectId): Promise<void> {
    const stale = await this.snippets
      .find({ user })
      .sort({ updatedAt: -1 })
      .skip(MAX_SNIPPETS)
      .select({ _id: 1 })
      .lean()
      .exec();
    if (stale.length) {
      await this.snippets
        .deleteMany({ _id: { $in: stale.map((s) => s._id) } })
        .exec();
    }
  }

  private async pruneRuns(user: Types.ObjectId): Promise<void> {
    const stale = await this.runs
      .find({ user })
      .sort({ createdAt: -1 })
      .skip(HISTORY_LIMIT)
      .select({ _id: 1 })
      .lean()
      .exec();
    if (stale.length) {
      await this.runs
        .deleteMany({ _id: { $in: stale.map((s) => s._id) } })
        .exec();
    }
  }

  private toSnippetView(
    d: CodeSnippet & { _id: Types.ObjectId; updatedAt?: Date },
  ): SnippetView {
    return {
      id: String(d._id),
      title: d.title,
      language: d.language,
      files: (d.files ?? []).map((f) => ({ name: f.name, content: f.content })),
      stdin: d.stdin ?? '',
      updatedAt: (d.updatedAt ?? new Date(0)).toISOString(),
    };
  }

  private toRunView(
    d: PracticeRun & { _id: Types.ObjectId; createdAt?: Date },
  ): RunView {
    return {
      id: String(d._id),
      language: d.language,
      kind: d.kind,
      title: d.title,
      ok: d.ok,
      simulated: d.simulated,
      durationMs: d.durationMs,
      passed: d.passed,
      total: d.total,
      codePreview: d.codePreview ?? '',
      at: (d.createdAt ?? new Date(0)).toISOString(),
    };
  }
}
