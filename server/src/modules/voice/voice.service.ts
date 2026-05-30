import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, Role } from '../../common/enums';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { IVoiceProvider, SynthesisResult, VOICE_PROVIDER_TOKEN } from './voice.provider';

export interface VoiceTurn {
  sessionId: string;
  text: string;
  speak: SynthesisResult;
}

/**
 * Voice Room service (Phase 3 · A5): a spoken tutor / mock-interview loop. Transcribed speech
 * is routed through the Agent OS (Voice agent → Tutor) and the answer is returned for the
 * client to speak. Gated by `ENABLE_REALTIME_VOICE`; mic + TTS run in-browser (Web Speech API).
 */
@Injectable()
export class VoiceService {
  constructor(
    private readonly orchestrator: AgentOrchestratorService,
    private readonly config: ConfigService,
    @Inject(VOICE_PROVIDER_TOKEN) private readonly provider: IVoiceProvider,
  ) {}

  get enabled(): boolean {
    return this.config.get<boolean>('flags.realtimeVoice') ?? false;
  }

  status(): { enabled: boolean; provider: string } {
    return { enabled: this.enabled, provider: this.provider.name };
  }

  async converse(userId: string, role: Role, transcript: string, sessionId?: string, mode: 'tutor' | 'interview' = 'tutor'): Promise<VoiceTurn> {
    if (!this.enabled) throw new ForbiddenException('Voice Room is disabled. Set ENABLE_REALTIME_VOICE=true to enable it.');
    const message = await this.provider.transcribe(transcript);
    const prompt = mode === 'interview' ? `Conduct a mock interview. Candidate said: "${message}". Ask one focused follow-up.` : message;

    const result = await this.orchestrator.handle({
      userId,
      role,
      message: prompt,
      sessionId,
      agentType: AgentType.Voice,
      source: 'voice',
    });

    const text = this.forSpeech(result.response.answer);
    return { sessionId: result.sessionId, text, speak: await this.provider.synthesize(text) };
  }

  /** Strip markdown so the spoken output sounds natural. */
  private forSpeech(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, ' (code shown on screen) ')
      .replace(/[#*_>`~|]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);
  }
}
