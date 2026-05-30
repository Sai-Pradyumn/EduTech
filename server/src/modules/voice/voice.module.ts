import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { MockVoiceProvider, VOICE_PROVIDER_TOKEN } from './voice.provider';

/**
 * Voice Room (Phase 3 · A5): spoken tutor / mock interview behind IVoiceProvider (mock default).
 * Routes transcribed speech through the Agent OS; mic capture + TTS happen in-browser via the
 * Web Speech API. Gated by ENABLE_REALTIME_VOICE.
 */
@Module({
  imports: [AgentsModule],
  controllers: [VoiceController],
  providers: [VoiceService, { provide: VOICE_PROVIDER_TOKEN, useClass: MockVoiceProvider }],
  exports: [VoiceService],
})
export class VoiceModule {}
