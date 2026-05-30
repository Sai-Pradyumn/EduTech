import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { AI_PROVIDER_TOKEN, IAIProvider } from './interfaces/ai-provider.interface';
import { MockAIProvider } from './providers/mock-ai.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

/** Builds the active IAIProvider from AI_PROVIDER; falls back to mock with a warning. */
export const aiProviderFactory: Provider = {
  provide: AI_PROVIDER_TOKEN,
  inject: [ConfigService, MockAIProvider],
  useFactory: (config: ConfigService<AppConfig, true>, mock: MockAIProvider): IAIProvider => {
    const logger = new Logger('AiProviderFactory');
    const ai = config.get('ai', { infer: true });
    switch (ai.provider) {
      case 'openai':
        logger.log('Using OpenAI provider (placeholder — wire SDK to enable).');
        return new OpenAIProvider(ai.openaiApiKey);
      case 'gemini':
        logger.log('Using Gemini provider (placeholder — wire SDK to enable).');
        return new GeminiProvider(ai.geminiApiKey);
      case 'claude':
        logger.log('Using Claude provider (placeholder — wire SDK to enable).');
        return new ClaudeProvider(ai.claudeApiKey);
      default:
        logger.log('Using Mock AI provider (no API keys required).');
        return mock;
    }
  },
};
