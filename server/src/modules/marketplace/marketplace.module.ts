import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import {
  MarketplaceTemplate,
  MarketplaceTemplateSchema,
} from './schemas/marketplace-template.schema';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

/**
 * Phase 9 · Creator/Template Marketplace — mentors/creators publish reusable learning assets
 * (flow/roadmap/quiz/project/… templates); admins moderate; learners browse and clone into their
 * own assets. Foundation layer (no payments).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketplaceTemplate.name, schema: MarketplaceTemplateSchema },
    ]),
    UsersModule,
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
