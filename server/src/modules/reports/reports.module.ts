import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { LearningIntelligenceModule } from '../learning-intelligence/learning-intelligence.module';
import { AiModule } from '../ai/ai.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './services/reports.service';

/**
 * Enterprise reports (Phase 4 · B16): read-only org outcome / weak-topic / AI-usage reports
 * with CSV export. Leaf consumer — reuses Tenancy (roster), Learning-Intelligence and AI.
 */
@Module({
  imports: [TenancyModule, LearningIntelligenceModule, AiModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
