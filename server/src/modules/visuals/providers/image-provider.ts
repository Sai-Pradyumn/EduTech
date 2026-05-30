import { Injectable } from '@nestjs/common';
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

  async generate(prompt: string): Promise<ImageResult> {
    return { url: illustrationDataUri(prompt), provider: this.name };
  }
}
