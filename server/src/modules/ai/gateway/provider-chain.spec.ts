import { FactoryProvider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockAIProvider } from '../providers/mock-ai.provider';
import { IAIProvider } from '../interfaces/ai-provider.interface';
import { PROVIDER_CHAIN_TOKEN, providerChainFactory } from './provider-chain';

/** The factory is exported as the `Provider` union; narrow it for the test. */
const chainDef = providerChainFactory as FactoryProvider;

type AiConfig = ReturnType<typeof baseAi>;

/** A full `ai` config namespace with all providers keyless by default. */
function baseAi(over: Partial<Record<string, unknown>> = {}) {
  return {
    provider: 'auto',
    strategy: 'fallback',
    maxOutputTokens: 2048,
    order: [
      'groq',
      'gemini',
      'mistral',
      'openrouter',
      'deepseek',
      'openai',
      'claude',
    ],
    providers: {
      claude: { apiKey: '', model: 'm' },
      openai: { apiKey: '', model: 'm' },
      groq: { apiKey: '', model: 'm', baseURL: 'https://x' },
      mistral: { apiKey: '', model: 'm', baseURL: 'https://x' },
      openrouter: { apiKey: '', model: 'm', baseURL: 'https://x', headers: {} },
      deepseek: { apiKey: '', model: 'm', baseURL: 'https://x' },
      gemini: { apiKey: '', model: 'm' },
    },
    ...over,
  };
}

function build(ai: AiConfig): IAIProvider[] {
  const config = { get: () => ai } as unknown as ConfigService<never, true>;
  const factory = chainDef.useFactory as (
    c: ConfigService<never, true>,
    m: MockAIProvider,
  ) => IAIProvider[];
  return factory(config, new MockAIProvider());
}

describe('providerChainFactory', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('exposes a stable DI token', () => {
    expect(chainDef.provide).toBe(PROVIDER_CHAIN_TOKEN);
  });

  it('with zero keys, the chain is the mock terminal only', () => {
    const chain = build(baseAi());
    expect(chain.map((c) => c.name)).toEqual(['mock']);
  });

  it('selects live providers in priority order, mock always last', () => {
    const ai = baseAi();
    ai.providers.groq.apiKey = 'k-groq';
    ai.providers.gemini.apiKey = 'k-gemini';
    const chain = build(ai);
    expect(chain.map((c) => c.name)).toEqual(['groq', 'gemini', 'mock']);
  });

  it('honors a custom priority order', () => {
    const ai = baseAi({ order: ['gemini', 'groq'] });
    ai.providers.groq.apiKey = 'k-groq';
    ai.providers.gemini.apiKey = 'k-gemini';
    const chain = build(ai);
    expect(chain.map((c) => c.name)).toEqual(['gemini', 'groq', 'mock']);
  });

  it('AI_PROVIDER=mock forces mock-only even when keys exist', () => {
    const ai = baseAi({ provider: 'mock' });
    ai.providers.groq.apiKey = 'k-groq';
    const chain = build(ai);
    expect(chain.map((c) => c.name)).toEqual(['mock']);
  });

  it('a pinned provider is tried first, then remaining live ones', () => {
    const ai = baseAi({ provider: 'gemini' });
    ai.providers.groq.apiKey = 'k-groq';
    ai.providers.gemini.apiKey = 'k-gemini';
    const chain = build(ai);
    expect(chain[0].name).toBe('gemini');
    expect(chain[chain.length - 1].name).toBe('mock');
  });
});
