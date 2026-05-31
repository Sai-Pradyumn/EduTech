import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlowsModule } from '../flows/flows.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { VisualsModule } from '../visuals/visuals.module';
import { StudySpace, StudySpaceSchema } from './schemas/study-space.schema';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

/**
 * Phase 8 · Study Spaces — NotebookLM-style multimodal workspaces. Sources (text/url/transcript/…)
 * become grounded Q&A, summaries, flashcards, an audio-overview script, and can spawn a flow / quiz /
 * concept-graph visual. Reuses the AI gateway + Flows + Assessment + Visuals. Works offline (mock).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: StudySpace.name, schema: StudySpaceSchema }]),
    FlowsModule,
    AssessmentModule,
    VisualsModule,
  ],
  controllers: [SpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
