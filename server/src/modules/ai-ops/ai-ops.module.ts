import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AiUsageLog,
  AiUsageLogSchema,
} from '../ai/schemas/ai-usage-log.schema';
import {
  AiBudgetPolicy,
  AiBudgetPolicySchema,
} from './schemas/ai-budget-policy.schema';
import { AiOpsController } from './ai-ops.controller';
import { AiOpsService } from './ai-ops.service';

/** AI Ops (Phase 10 · M2). Ai gateway is @Global, so only the data models are registered here. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUsageLog.name, schema: AiUsageLogSchema },
      { name: AiBudgetPolicy.name, schema: AiBudgetPolicySchema },
    ]),
  ],
  controllers: [AiOpsController],
  providers: [AiOpsService],
  exports: [AiOpsService],
})
export class AiOpsModule {}
