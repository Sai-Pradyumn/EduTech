import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiService } from './ai.service';
import { aiProviderFactory } from './ai-provider.factory';
import { MockAIProvider } from './providers/mock-ai.provider';
import { AiUsageLog, AiUsageLogSchema } from './schemas/ai-usage-log.schema';

/** Global so any agent/module can inject AiService without re-importing. */
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AiUsageLog.name, schema: AiUsageLogSchema }])],
  providers: [MockAIProvider, aiProviderFactory, AiService],
  exports: [AiService],
})
export class AiModule {}
