import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { LearningIntelligenceModule } from '../learning-intelligence/learning-intelligence.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { KnowledgeDocument, KnowledgeDocumentSchema } from '../rag/schemas/knowledge-document.schema';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { Quiz, QuizSchema } from '../assessment/schemas/quiz.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Admin Command Center (Phase 3 · A7): AI usage analytics + platform student roster for the
 * Role.Admin shell. Leaf consumer — reuses AI, Learning-Intelligence and profiles.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: KnowledgeDocument.name, schema: KnowledgeDocumentSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
    AiModule,
    LearningIntelligenceModule,
    StudentProfileModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
