import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerModule } from '../ledger/ledger.module';
import { MistakesModule } from '../mistakes/mistakes.module';
import { PracticeController } from './practice.controller';
import { PracticeExecutionService } from './practice.service';
import { PracticeLibraryService } from './practice-library.service';
import { MockExecutionProvider } from './providers/mock-execution.provider';
import { PistonExecutionProvider } from './providers/piston-execution.provider';
import { CodeSnippet, CodeSnippetSchema } from './schemas/code-snippet.schema';
import { PracticeRun, PracticeRunSchema } from './schemas/practice-run.schema';

/**
 * Practice Studio. Real multi-language execution via Piston (free public runner
 * by default; self-host with PISTON_URL, disable with PRACTICE_DISABLE_PISTON=1),
 * with a no-infra Mock fallback. JavaScript runs client-side in a Web Worker; the
 * process never runs arbitrary user code itself.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CodeSnippet.name, schema: CodeSnippetSchema },
      { name: PracticeRun.name, schema: PracticeRunSchema },
    ]),
    LedgerModule,
    MistakesModule,
  ],
  controllers: [PracticeController],
  providers: [
    PistonExecutionProvider,
    MockExecutionProvider,
    PracticeExecutionService,
    PracticeLibraryService,
  ],
  exports: [PracticeExecutionService],
})
export class PracticeModule {}
