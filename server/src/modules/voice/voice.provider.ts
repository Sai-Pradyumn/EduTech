import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export const VOICE_PROVIDER_TOKEN = 'VOICE_PROVIDER';

export interface SynthesisResult {
  /** Plain text the client should speak (via Web Speech API when no server audio is present). */
  text: string;
  /** Suggested voice locale (BCP-47) or provider voice name. */
  voice: string;
  provider: string;
  /** Real server-side TTS audio as a data-URI (set by live providers). */
  audioUrl?: string;
}

/**
 * Voice provider abstraction (Phase 3 · A5). The default is a mock that round-trips text and
 * lets the browser's Web Speech API do mic capture + speech synthesis. A real provider
 * (OpenAIVoiceProvider) does server-side TTS, activated by ENABLE_REALTIME_VOICE + OPENAI_API_KEY.
 */
export interface IVoiceProvider {
  readonly name: string;
  /** Server-side transcription hook (mock/openai: passthrough — mic STT happens in-browser). */
  transcribe(transcript: string): Promise<string>;
  /** Prepare a spoken response payload (real providers attach `audioUrl`). */
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

/**
 * Real TTS via OpenAI. The browser still captures the mic (Web Speech STT), so `transcribe`
 * stays a passthrough; `synthesize` returns real spoken audio as a data-URI the client plays.
 * On any error it degrades to text-only (the browser speaks it), so the room never breaks.
 */
export class OpenAIVoiceProvider implements IVoiceProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model = 'gpt-4o-mini-tts',
    private readonly ttsVoice = 'alloy',
  ) {
    this.client = new OpenAI({ apiKey });
  }

  transcribe(transcript: string): Promise<string> {
    return Promise.resolve(transcript.trim());
  }

  async synthesize(
    text: string,
    voice = this.ttsVoice,
  ): Promise<SynthesisResult> {
    try {
      const res = await this.client.audio.speech.create({
        model: this.model,
        voice: voice,
        input: text.slice(0, 4000),
      });
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        text,
        voice,
        provider: this.name,
        audioUrl: `data:audio/mp3;base64,${buf.toString('base64')}`,
      };
    } catch {
      // Fall back to text-only so the browser's Web Speech API can still speak it.
      return { text, voice: 'en-US', provider: this.name };
    }
  }
}
