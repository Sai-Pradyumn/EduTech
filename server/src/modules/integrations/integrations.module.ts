import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  IntegrationConnection,
  IntegrationConnectionSchema,
  IntegrationSyncLog,
  IntegrationSyncLogSchema,
} from './schemas/integration.schema';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

/** Integrations foundation (Phase 10 · M12). Mock/manual/export connectors are local-safe. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationConnection.name, schema: IntegrationConnectionSchema },
      { name: IntegrationSyncLog.name, schema: IntegrationSyncLogSchema },
    ]),
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
