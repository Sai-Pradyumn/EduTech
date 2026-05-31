import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { FlowsModule } from '../flows/flows.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { MockVoiceProvider, VOICE_PROVIDER_TOKEN } from './voice.provider';
import { VoiceSession, VoiceSessionSchema } from './schemas/voice-session.schema';

/**
 * Voice Room (Phase 8 · complete voice-native learning). Persisted multi-turn sessions across 8 modes
 * (tutor / viva / interview / doubt / flow-builder / revision / mentor / project-review), routed through
 * the Agent OS, with voice-to-flow and voice-to-quiz. Mic capture + speech run in-browser (Web Speech
 * API); server STT/TTS sit behind IVoiceProvider (mock default). On by default (`ENABLE_VOICE`).
 */
@Module({
  imports: [
    AgentsModule,
    FlowsModule,
    AssessmentModule,
    MongooseModule.forFeature([{ name: VoiceSession.name, schema: VoiceSessionSchema }]),
  ],
  controllers: [VoiceController],
  providers: [VoiceService, { provide: VOICE_PROVIDER_TOKEN, useClass: MockVoiceProvider }],
  exports: [VoiceService],
})
export class VoiceModule {}
