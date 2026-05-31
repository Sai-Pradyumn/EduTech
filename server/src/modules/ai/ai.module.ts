import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiService } from './ai.service';
import { HealthTrackerService } from './gateway/health-tracker.service';
import { LlmGatewayService } from './gateway/llm-gateway.service';
import { providerChainFactory } from './gateway/provider-chain';
import { AiRateLimitService } from './guards/ai-rate-limit.service';
import { PromptInjectionGuard } from './guards/prompt-injection.guard';
import { AI_PROVIDER_TOKEN } from './interfaces/ai-provider.interface';
import { MockAIProvider } from './providers/mock-ai.provider';
import { AiUsageLog, AiUsageLogSchema } from './schemas/ai-usage-log.schema';

/**
 * Global AI module. The LLM gateway (multi-provider chain + health/fallback) is the
 * active IAIProvider; AiService is the facade every agent/RAG depends on.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUsageLog.name, schema: AiUsageLogSchema },
    ]),
  ],
  providers: [
    MockAIProvider,
    HealthTrackerService,
    providerChainFactory,
    LlmGatewayService,
    { provide: AI_PROVIDER_TOKEN, useExisting: LlmGatewayService },
    AiService,
    AiRateLimitService,
    PromptInjectionGuard,
  ],
  exports: [
    AiService,
    LlmGatewayService,
    AiRateLimitService,
    PromptInjectionGuard,
  ],
})
export class AiModule {}
