import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { AIMessage } from '../../ai/interfaces/ai-provider.interface';
import {
  IImageProvider,
  IMAGE_PROVIDER_TOKEN,
} from '../providers/image-provider';
import {
  VISUAL_CONTENT_FORMATS,
  VISUAL_TYPES,
} from '../schemas/visual-asset.schema';
import { buildVisual, typeLabel } from './visual-generator';
import { GeneratedVisual, VisualGenInput } from './generated-visual.types';

const VISUAL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['type', 'contentFormat', 'content'],
  properties: {
    type: { type: 'string', enum: VISUAL_TYPES as unknown as string[] },
    contentFormat: {
      type: 'string',
      enum: VISUAL_CONTENT_FORMATS as unknown as string[],
    },
    content: { type: 'string' },
    mermaid: { type: 'string' },
    caption: { type: 'string' },
    howToRead: { type: 'string' },
  },
};

/**
 * VisualExplainerAgent — turns a concept into a structured educational visual. Prefers renderable,
 * dependency-free formats (jsonGraph / SVG / mermaid / markdown); illustrations go through the
 * image-provider abstraction (mock by default). Works fully offline via the deterministic generator.
 */
@Injectable()
export class VisualExplainerService {
  readonly type = AgentType.ContentCreator; // shares content-class telemetry; no new enum needed
  private readonly logger = new Logger(VisualExplainerService.name);

  constructor(
    private readonly ai: AiService,
    @Inject(IMAGE_PROVIDER_TOKEN) private readonly images: IImageProvider,
  ) {}

  async generate(
    userId: string,
    input: VisualGenInput,
  ): Promise<GeneratedVisual> {
    const startedAt = Date.now();
    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: this.userPrompt(input) },
    ];

    let visual: GeneratedVisual;
    try {
      visual = await this.ai.generateStructuredOutput<GeneratedVisual>(
        messages,
        VISUAL_SCHEMA,
        {
          mockFactory: () => buildVisual(input),
          meta: {
            userId,
            agentType: AgentType.ContentCreator,
            operation: 'visual.generate',
          },
        },
      );
      visual = this.normalize(visual, input);
    } catch (err) {
      this.logger.error(`Visual generation failed: ${(err as Error).message}`);
      visual = buildVisual(input);
    }

    if (!this.isValid(visual)) {
      visual = buildVisual(input);
      if (!this.isValid(visual)) {
        throw new InternalServerErrorException(
          'Could not generate a valid visual. Please try again.',
        );
      }
    }

    // Illustration/analogy go through the image-provider abstraction (mock by default).
    if (
      (visual.type === 'illustration' || visual.type === 'analogy') &&
      (!visual.content || visual.contentFormat !== 'imageUrl')
    ) {
      const img = await this.images.generate(input.concept);
      visual.content = img.url;
      visual.contentFormat = 'imageUrl';
      visual.metadata = { ...visual.metadata, imageProvider: img.provider };
    }

    await this.ai.logUsage({
      userId,
      agentType: this.type,
      operation: 'visual.generate',
      feature: 'visual',
      tokensIn: messages.reduce((s, m) => s + m.content.length, 0),
      tokensOut: visual.content.length,
      latencyMs: Date.now() - startedAt,
    });
    return visual;
  }

  private normalize(
    v: GeneratedVisual,
    input: VisualGenInput,
  ): GeneratedVisual {
    if (!v || !v.content) return buildVisual(input);
    const fb = buildVisual(input);
    return {
      type: VISUAL_TYPES.includes(v.type) ? v.type : fb.type,
      contentFormat: VISUAL_CONTENT_FORMATS.includes(v.contentFormat)
        ? v.contentFormat
        : fb.contentFormat,
      content: v.content || fb.content,
      mermaid: v.mermaid || fb.mermaid,
      caption: v.caption || fb.caption,
      howToRead: v.howToRead || fb.howToRead,
      thumbnail: v.thumbnail || fb.thumbnail,
      metadata: { ...fb.metadata, ...(v.metadata ?? {}) },
    };
  }

  private isValid(v: GeneratedVisual | undefined): boolean {
    return Boolean(
      v &&
      typeof v.content === 'string' &&
      v.content.length > 0 &&
      VISUAL_TYPES.includes(v.type),
    );
  }

  private systemPrompt(): string {
    return [
      "You are Asta's Visual Explainer. Turn a concept into ONE structured educational visual.",
      `Pick the best type from: ${VISUAL_TYPES.map(typeLabel).join(', ')}.`,
      'Prefer renderable structured formats: a JSON graph ({layout:vertical|radial|layered|horizontal, nodes:[{id,label,kind}], edges:[{from,to,label}]}) as contentFormat "jsonGraph", or "mermaid", or "markdown".',
      'Always include a plain-language caption and a "how to read this" note. Be concrete and educational, not decorative.',
      'Return strictly the GeneratedVisual JSON shape.',
    ].join(' ');
  }

  private userPrompt(i: VisualGenInput): string {
    return JSON.stringify({
      concept: i.concept,
      instruction: i.prompt,
      requestedType: i.type,
      level: i.level ?? 'beginner',
    });
  }
}
