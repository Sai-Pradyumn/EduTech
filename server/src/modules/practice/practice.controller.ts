import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { PracticeExecutionService } from './practice.service';
import { PracticeLibraryService } from './practice-library.service';
import {
  RecordOutcomeDto,
  RunCodeDto,
  SaveSnippetDto,
  SubmitCodeDto,
} from './dto/practice.dto';

/**
 * Practice Studio API. JavaScript runs client-side (real, in a Web Worker);
 * other languages run on the server via Piston (Mock fallback). `record` logs a
 * graded outcome to the Proof Ledger / Mistake OS regardless of where it ran.
 * Snippets and run history are persisted via {@link PracticeLibraryService}.
 */
@Controller('practice')
export class PracticeController {
  constructor(
    private readonly practice: PracticeExecutionService,
    private readonly library: PracticeLibraryService,
  ) {}

  @Get('languages')
  languages() {
    return this.practice.listLanguages();
  }

  @Post('run')
  async run(@CurrentUser() user: AuthUser, @Body() dto: RunCodeDto) {
    const result = await this.practice.run(user.id, dto);
    void this.library.logRun(user.id, {
      language: dto.language,
      kind: 'free',
      ok: result.ok,
      simulated: result.simulated,
      durationMs: result.durationMs,
      code: dto.code,
    });
    return result;
  }

  @Post('submit')
  async submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitCodeDto) {
    const result = await this.practice.submit(user.id, {
      ...dto,
      tests: dto.tests,
    });
    void this.library.logRun(user.id, {
      language: dto.language,
      kind: 'submit',
      ok: result.ok,
      simulated: result.simulated,
      durationMs: 0,
      passed: result.passed,
      total: result.total,
      code: dto.code,
    });
    return result;
  }

  @Post('record')
  record(@CurrentUser() user: AuthUser, @Body() dto: RecordOutcomeDto) {
    return this.practice.logOutcome(user.id, dto);
  }

  // ── Snippet library + run history ──

  @Get('snippets')
  listSnippets(@CurrentUser() user: AuthUser) {
    return this.library.listSnippets(user.id);
  }

  @Post('snippets')
  saveSnippet(@CurrentUser() user: AuthUser, @Body() dto: SaveSnippetDto) {
    return this.library.saveSnippet(user.id, dto);
  }

  @Delete('snippets/:id')
  deleteSnippet(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.deleteSnippet(user.id, id);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.library.history(user.id);
  }
}
