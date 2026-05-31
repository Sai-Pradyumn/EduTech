import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ProjectsModule } from '../projects/projects.module';
import { LearningIntelligenceModule } from '../learning-intelligence/learning-intelligence.module';
import {
  MentorProfile,
  MentorProfileSchema,
} from './schemas/mentor-profile.schema';
import { MentorNote, MentorNoteSchema } from './schemas/mentor-note.schema';
import { MentorController } from './mentor.controller';
import { MentorService } from './services/mentor.service';

/**
 * Mentor ecosystem (Phase 4 · B2): mentor profiles + notes, an org-scoped assigned-student
 * roster, per-student risk + AI summaries (via the Learning-Intelligence engine), and the
 * project-review queue. Leaf consumer — reuses tenancy, projects and LI services.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MentorProfile.name, schema: MentorProfileSchema },
      { name: MentorNote.name, schema: MentorNoteSchema },
    ]),
    UsersModule,
    TenancyModule,
    ProjectsModule,
    LearningIntelligenceModule,
  ],
  controllers: [MentorController],
  providers: [MentorService],
  exports: [MentorService],
})
export class MentorModule {}
