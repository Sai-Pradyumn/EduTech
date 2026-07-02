import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RagModule } from '../rag/rag.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { QuizAttempt, QuizAttemptSchema } from './schemas/quiz-attempt.schema';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './services/assessment.service';
import { QuizGeneratorService } from './services/quiz-generator.service';
import { EvaluationService } from './services/evaluation.service';

/**
 * Assessment engine: adaptive quiz generation (topic bank / doc-grounded via RAG /
 * weak-area / roadmap), grading, weak-topic detection, and stats. Exports
 * AssessmentService so the Assessment agent can run it through the Agent OS.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Quiz.name, schema: QuizSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
    ]),
    RagModule,
    StudentProfileModule,
  ],
  controllers: [AssessmentController],
  providers: [AssessmentService, QuizGeneratorService, EvaluationService],
  exports: [AssessmentService, QuizGeneratorService],
})
export class AssessmentModule {}
