import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { Roadmap, RoadmapSchema } from './schemas/roadmap.schema';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Roadmap.name, schema: RoadmapSchema }]),
    StudentProfileModule,
    AgentsModule,
  ],
  controllers: [RoadmapController],
  providers: [RoadmapService],
  exports: [RoadmapService],
})
export class RoadmapModule {}
