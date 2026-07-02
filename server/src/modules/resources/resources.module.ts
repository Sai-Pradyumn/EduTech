import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Roadmap, RoadmapSchema } from '../roadmap/schemas/roadmap.schema';
import { StudentProfileModule } from '../student-profile/student-profile.module';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import {
  Resource,
  ResourceProgress,
  ResourceProgressSchema,
  ResourceSchema,
} from './schemas/resource.schema';

/**
 * A→Z Resources: a shipped, curated catalog of real learning resources,
 * personalized to each learner (goal / weak areas / current roadmap week),
 * with a save → in-progress → done personal library.
 */
@Module({
  imports: [
    StudentProfileModule,
    MongooseModule.forFeature([
      { name: Resource.name, schema: ResourceSchema },
      { name: ResourceProgress.name, schema: ResourceProgressSchema },
      { name: Roadmap.name, schema: RoadmapSchema },
    ]),
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
