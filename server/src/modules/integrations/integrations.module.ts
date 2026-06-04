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
import { GoogleCalendarService } from './google-calendar.service';

/** Integrations foundation (Phase 10 · M12). Webhook/manual/csv/export connectors are
 *  fully functional; Google Calendar OAuth activates when Google credentials are configured. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationConnection.name, schema: IntegrationConnectionSchema },
      { name: IntegrationSyncLog.name, schema: IntegrationSyncLogSchema },
    ]),
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, GoogleCalendarService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
