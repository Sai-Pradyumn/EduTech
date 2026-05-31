import { Injectable } from '@nestjs/common';

export const VOICE_PROVIDER_TOKEN = 'VOICE_PROVIDER';

export interface SynthesisResult {
  /** Plain text the client should speak (via Web Speech API / a real TTS later). */
  text: string;
  /** Suggested voice locale (BCP-47). */
  voice: string;
  provider: string;
}

/**
 * Voice provider abstraction (Phase 3 · A5). Real STT/TTS providers (e.g. OpenAI Realtime,
 * ElevenLabs) slot in behind this; the default is a mock that round-trips text and lets the
 * browser's Web Speech API do the actual mic capture + speech synthesis. `ENABLE_REALTIME_VOICE`.
 */
export interface IVoiceProvider {
  readonly name: string;
  /** Server-side transcription hook (mock: passthrough — real STT happens in-browser). */
  transcribe(transcript: string): Promise<string>;
  /** Prepare a spoken response payload. */
  synthesize(text: string, voice?: string): Promise<SynthesisResult>;
}

@Injectable()
export class MockVoiceProvider implements IVoiceProvider {
  readonly name = 'mock';

  transcribe(transcript: string): Promise<string> {
    return Promise.resolve(transcript.trim());
  }

  synthesize(text: string, voice = 'en-US'): Promise<SynthesisResult> {
    return Promise.resolve({ text, voice, provider: this.name });
  }
}
