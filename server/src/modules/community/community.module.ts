import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ProjectsModule } from '../projects/projects.module';
import {
  CommunityChannel,
  CommunityChannelSchema,
  CommunityReply,
  CommunityReplySchema,
  CommunityReport,
  CommunityReportSchema,
  CommunityThread,
  CommunityThreadSchema,
} from './schemas/community.schema';
import { CommunityController } from './community.controller';
import { CommunityService } from './services/community.service';

/**
 * Community + discussion (Phase 4 · B9): org-scoped channels, threads (discussion / question
 * / project showcase), threaded replies, upvotes and accepted answers. Leaf consumer —
 * reuses Projects (showcase links a real project). AI moderation / dedup is 🧱 / future.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CommunityChannel.name, schema: CommunityChannelSchema },
      { name: CommunityThread.name, schema: CommunityThreadSchema },
      { name: CommunityReply.name, schema: CommunityReplySchema },
      { name: CommunityReport.name, schema: CommunityReportSchema },
    ]),
    UsersModule,
    TenancyModule,
    ProjectsModule,
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
