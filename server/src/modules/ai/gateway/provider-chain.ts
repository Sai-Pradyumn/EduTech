import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { IAIProvider } from '../interfaces/ai-provider.interface';
import { ClaudeProvider } from '../providers/claude.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import { MockAIProvider } from '../providers/mock-ai.provider';
import { OpenAICompatibleProvider } from '../providers/openai-compatible.provider';

/** Ordered list of providers the gateway tries, best → fallback. Mock is always last. */
export const PROVIDER_CHAIN_TOKEN = 'PROVIDER_CHAIN_TOKEN';

/**
 * Builds the multi-provider registry from configured keys, then orders it by LLM_PROVIDERS
 * (auto-select + fallback chain). Mirrors the reference repo: Groq/Mistral/OpenRouter/
 * DeepSeek go through one OpenAI-compatible adapter; Gemini + Claude have native adapters.
 * Mock is always the terminal fallback so the app runs with zero keys.
 */
export const providerChainFactory: Provider = {
  provide: PROVIDER_CHAIN_TOKEN,
  inject: [ConfigService, MockAIProvider],
  useFactory: (
    config: ConfigService<AppConfig, true>,
    mock: MockAIProvider,
  ): IAIProvider[] => {
    const logger = new Logger('LlmProviderChain');
    const ai = config.get('ai', { infer: true });
    const p = ai.providers;
    const max = ai.maxOutputTokens;

    const registry: Record<string, IAIProvider> = {
      claude: new ClaudeProvider(p.claude.apiKey, p.claude.model, max),
      gemini: new GeminiProvider(p.gemini.apiKey, p.gemini.model, max),
      openai: new OpenAICompatibleProvider(
        {
          name: 'openai',
          label: 'OpenAI',
          apiKey: p.openai.apiKey,
          model: p.openai.model,
          embeddings: true,
        },
        max,
      ),
      groq: new OpenAICompatibleProvider(
        {
          name: 'groq',
          label: 'Groq',
          apiKey: p.groq.apiKey,
          model: p.groq.model,
          baseURL: p.groq.baseURL,
        },
        max,
      ),
      mistral: new OpenAICompatibleProvider(
        {
          name: 'mistral',
          label: 'Mistral',
          apiKey: p.mistral.apiKey,
          model: p.mistral.model,
          baseURL: p.mistral.baseURL,
        },
        max,
      ),
      openrouter: new OpenAICompatibleProvider(
        {
          name: 'openrouter',
          label: 'OpenRouter',
          apiKey: p.openrouter.apiKey,
          model: p.openrouter.model,
          baseURL: p.openrouter.baseURL,
          extraHeaders: p.openrouter.headers,
        },
        max,
      ),
      deepseek: new OpenAICompatibleProvider(
        {
          name: 'deepseek',
          label: 'DeepSeek',
          apiKey: p.deepseek.apiKey,
          model: p.deepseek.model,
          baseURL: p.deepseek.baseURL,
        },
        max,
      ),
      // Local, free, zero-key. Reuses the OpenAI-compatible adapter against Ollama's
      // /v1 endpoint. Only "live" when explicitly enabled (so we don't add a failing
      // localhost hop for anyone not running it); the SDK needs a non-empty key.
      ollama: new OpenAICompatibleProvider(
        {
          name: 'ollama',
          label: 'Ollama (local)',
          apiKey: p.ollama.enabled ? p.ollama.apiKey || 'ollama' : '',
          model: p.ollama.model,
          baseURL: p.ollama.baseURL,
        },
        max,
      ),
    };

    // The priority order (configured names that actually exist in the registry).
    const order = ai.order.filter((name) => registry[name]);
    const live = order.filter((name) => registry[name].isLive);

    let selected: string[];
    if (ai.provider === 'mock') {
      selected = [];
    } else if (ai.provider !== 'auto' && registry[ai.provider]?.isLive) {
      // Pin the requested provider first, then the remaining live ones in priority order.
      selected = [ai.provider, ...live.filter((n) => n !== ai.provider)];
    } else {
      selected = live;
    }

    const chain: IAIProvider[] = selected.map((n) => registry[n]);
    chain.push(mock); // always-available terminal fallback

    // Debug: show which keys are configured (non-empty)
    const configuredKeys = Object.entries({
      GROQ: p.groq.apiKey,
      GEMINI: p.gemini.apiKey,
      MISTRAL: p.mistral.apiKey,
      OPENROUTER: p.openrouter.apiKey,
      DEEPSEEK: p.deepseek.apiKey,
      OPENAI: p.openai.apiKey,
      CLAUDE: p.claude.apiKey,
    })
      .filter(([, key]) => key && key.trim())
      .map(([name]) => name);

    if (selected.length) {
      const embedder =
        chain.find((c) => c.capabilities.embeddings && c.isLive)?.name ??
        'mock-hashed';
      logger.log(
        `✓ LLM providers configured: ${
          configuredKeys.join(', ') ||
          (p.ollama.enabled ? 'Ollama (local, zero-key)' : 'none')
        }`,
      );
      logger.log(
        `✓ Provider chain: ${selected.join(' → ')} → mock | Strategy: ${ai.strategy} | Embeddings: ${embedder}`,
      );
    } else {
      logger.error(
        `❌ NO LIVE LLM PROVIDERS! Running in MOCK MODE (placeholder answers, not real AI).\n` +
          `   Option A — add a cloud key to .env: GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY, CLAUDE_API_KEY\n` +
          `   Option B — real AI locally with NO key: install Ollama, run 'ollama pull llama3.2', then set OLLAMA_ENABLED=true.\n` +
          `   Then restart the app.\n` +
          `   Configured keys: ${configuredKeys.length > 0 ? configuredKeys.join(', ') : 'NONE'}`,
      );
    }
    return chain;
  },
};
