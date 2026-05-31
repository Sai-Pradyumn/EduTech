import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from './schemas/api-key.schema';
import {
  WebhookDelivery,
  WebhookDeliverySchema,
  WebhookEndpoint,
  WebhookEndpointSchema,
} from './schemas/webhook.schema';
import { DeveloperController } from './developer.controller';
import { DeveloperService } from './developer.service';

/** Developer platform (Phase 10 · M11): API keys + webhooks. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: WebhookEndpoint.name, schema: WebhookEndpointSchema },
      { name: WebhookDelivery.name, schema: WebhookDeliverySchema },
    ]),
  ],
  controllers: [DeveloperController],
  providers: [DeveloperService],
  exports: [DeveloperService],
})
export class DeveloperModule {}
