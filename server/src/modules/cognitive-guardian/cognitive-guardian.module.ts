import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CognitiveGuardianController } from './cognitive-guardian.controller';
import { CognitiveGuardianService } from './cognitive-guardian.service';

/**
 * Cognitive Guardian — a deep, on-demand LLM verification pass over tutor answers
 * (correctness / misconceptions / hallucination / hint-first). Uses the shared AI
 * gateway (mock fallback) and its per-user rate limit. Both come from AiModule.
 */
@Module({
  imports: [AiModule],
  controllers: [CognitiveGuardianController],
  providers: [CognitiveGuardianService],
  exports: [CognitiveGuardianService],
})
export class CognitiveGuardianModule {}
