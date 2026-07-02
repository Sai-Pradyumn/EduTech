import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { Roadmap, RoadmapSchema } from './schemas/roadmap.schema';
import {
  RoadmapVersion,
  RoadmapVersionSchema,
} from './schemas/roadmap-version.schema';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { RoadmapChatCommands } from './roadmap-chat-commands';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Roadmap.name, schema: RoadmapSchema },
      { name: RoadmapVersion.name, schema: RoadmapVersionSchema },
    ]),
    StudentProfileModule,
    AgentsModule,
  ],
  controllers: [RoadmapController],
  providers: [RoadmapService, RoadmapChatCommands],
  exports: [RoadmapService],
})
export class RoadmapModule {}
