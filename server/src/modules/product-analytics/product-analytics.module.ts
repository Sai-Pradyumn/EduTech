import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProductEvent,
  ProductEventSchema,
} from './schemas/product-event.schema';
import { ProductAnalyticsController } from './product-analytics.controller';
import { ProductAnalyticsService } from './product-analytics.service';

/** Product analytics (Phase 10 · M8). Global so server-side flows can track funnels too. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductEvent.name, schema: ProductEventSchema },
    ]),
  ],
  controllers: [ProductAnalyticsController],
  providers: [ProductAnalyticsService],
  exports: [ProductAnalyticsService],
})
export class ProductAnalyticsModule {}
