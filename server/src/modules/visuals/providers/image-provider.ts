import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { illustrationDataUri } from '../visual-explainer/visual-generator';

export const IMAGE_PROVIDER_TOKEN = 'IMAGE_PROVIDER_TOKEN';

export interface ImageResult {
  /** A renderable image reference — a data-URI (mock) or a hosted URL (real providers). */
  url: string;
  provider: string;
}

/**
 * Provider-agnostic image generation contract. Real providers (OpenAI Images / Gemini / Stability)
 * can be slotted in behind ENABLE_IMAGE_GENERATION; the app never hard-depends on a paid API.
 */
export interface IImageProvider {
  readonly name: string;
  readonly isLive: boolean;
  generate(prompt: string): Promise<ImageResult>;
}

/**
 * Default provider: returns a deterministic, dependency-free SVG illustration as a data-URI.
 * Always available — keeps the Visual Studio fully functional with no image API keys.
 */
@Injectable()
export class MockImageProvider implements IImageProvider {
  readonly name = 'mock';
  readonly isLive = false;

  generate(prompt: string): Promise<ImageResult> {
    return Promise.resolve({
      url: illustrationDataUri(prompt),
      provider: this.name,
    });
  }
}

/**
 * Real image generation via OpenAI Images. Activated by ENABLE_IMAGE_GENERATION + OPENAI_API_KEY.
 * Returns the generated PNG as a data-URI. On any error it falls back to the deterministic SVG so
 * the Visual Studio never breaks.
 */
export class OpenAIImageProvider implements IImageProvider {
  readonly name = 'openai';
  readonly isLive = true;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model = 'gpt-image-1',
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(prompt: string): Promise<ImageResult> {
    try {
      const res = await this.client.images.generate({
        model: this.model,
        prompt: prompt.slice(0, 4000),
        size: '1024x1024',
      });
      const b64 = res.data?.[0]?.b64_json;
      if (b64) {
        return { url: `data:image/png;base64,${b64}`, provider: this.name };
      }
      const url = res.data?.[0]?.url;
      if (url) return { url, provider: this.name };
      return { url: illustrationDataUri(prompt), provider: this.name };
    } catch {
      return { url: illustrationDataUri(prompt), provider: this.name };
    }
  }
}
