import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIProviderCallError,
  IAIProvider,
  ProviderCapabilities,
} from '../interfaces/ai-provider.interface';
import { MockAIProvider } from '../providers/mock-ai.provider';
import { HealthTrackerService } from './health-tracker.service';
import { LlmGatewayService } from './llm-gateway.service';

/** A controllable provider double: succeeds, or throws a status-coded call error. */
class FakeProvider implements IAIProvider {
  calls = 0;
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    streaming: true,
    structured: true,
    embeddings: true,
  };
  constructor(
    readonly name: string,
    readonly isLive: boolean,
    private readonly behavior: 'ok' | { status?: number },
    private readonly text = `answer from ${name}`,
  ) {}
  generateText(): Promise<string> {
    this.calls++;
    if (this.behavior === 'ok') return Promise.resolve(this.text);
    return Promise.reject(
      new AIProviderCallError(
        this.name,
        `${this.behavior.status} fail`,
        this.behavior.status,
      ),
    );
  }
  async *streamText(): AsyncIterable<string> {
    yield await this.generateText();
  }
  generateStructuredOutput<T>(): Promise<T> {
    return this.generateText() as unknown as Promise<T>;
  }
  generateEmbedding(): Promise<number[]> {
    return Promise.resolve([0]);
  }
}

/** Minimal ConfigService stub returning the `ai` namespace the gateway reads. */
function fakeConfig(strategy: 'fallback' | 'parallel' | 'refine' = 'fallback') {
  return {
    get: () => ({ requestTimeoutMs: 5000, strategy }),
  } as unknown as ConfigService<never, true>;
}

const ask = () => [{ role: 'user' as const, content: 'What is a closure?' }];

describe('LlmGatewayService — fallback chain', () => {
  let health: HealthTrackerService;
  // The gateway logs every failover; silence it so the suite output stays clean.
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });
  beforeEach(() => {
    health = new HealthTrackerService();
  });

  it('returns the first live provider that succeeds, without trying the rest', async () => {
    const a = new FakeProvider('groq', true, 'ok');
    const b = new FakeProvider('gemini', true, 'ok');
    const gw = new LlmGatewayService(
      [a, b, new MockAIProvider()],
      health,
      fakeConfig(),
    );

    const out = await gw.generateText(ask());

    expect(out).toBe('answer from groq');
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(0);
  });

  it('fails over a 401 provider to the next live one', async () => {
    const a = new FakeProvider('groq', true, { status: 401 });
    const b = new FakeProvider('gemini', true, 'ok');
    const gw = new LlmGatewayService(
      [a, b, new MockAIProvider()],
      health,
      fakeConfig(),
    );

    const out = await gw.generateText(ask());

    expect(out).toBe('answer from gemini');
    expect(a.calls).toBe(1); // a 4xx is not retried
  });

  it('lands on the honest mock terminal when every real provider fails', async () => {
    const a = new FakeProvider('groq', true, { status: 401 });
    const b = new FakeProvider('gemini', true, { status: 429 });
    const c = new FakeProvider('deepseek', true, { status: 402 });
    const gw = new LlmGatewayService(
      [a, b, c, new MockAIProvider()],
      health,
      fakeConfig(),
    );

    const out = await gw.generateText(ask());

    expect(out).toMatch(/offline demo mode/i);
  });

  it('retries a transient 5xx once, but never a 4xx', async () => {
    const fivexx = new FakeProvider('groq', true, { status: 500 });
    const gw1 = new LlmGatewayService(
      [fivexx, new MockAIProvider()],
      health,
      fakeConfig(),
    );
    await gw1.generateText(ask());
    expect(fivexx.calls).toBe(2); // original + one retry

    const fourxx = new FakeProvider('groq', true, { status: 400 });
    const gw2 = new LlmGatewayService(
      [fourxx, new MockAIProvider()],
      new HealthTrackerService(),
      fakeConfig(),
    );
    await gw2.generateText(ask());
    expect(fourxx.calls).toBe(1); // no retry
  });

  it('skips a provider that is cooling down (circuit breaker)', async () => {
    const a = new FakeProvider('groq', true, 'ok');
    health.recordFailure('groq', 401); // 5-minute cooldown
    const b = new FakeProvider('gemini', true, 'ok');
    const gw = new LlmGatewayService(
      [a, b, new MockAIProvider()],
      health,
      fakeConfig(),
    );

    const out = await gw.generateText(ask());

    expect(out).toBe('answer from gemini');
    expect(a.calls).toBe(0); // skipped while cooling down
  });

  it('reports name = first live provider, or mock when none are live', () => {
    const live = new LlmGatewayService(
      [new FakeProvider('groq', true, 'ok'), new MockAIProvider()],
      health,
      fakeConfig(),
    );
    expect(live.name).toBe('groq');
    expect(live.isLive).toBe(true);

    const offline = new LlmGatewayService(
      [new MockAIProvider()],
      health,
      fakeConfig(),
    );
    expect(offline.name).toBe('mock');
    expect(offline.isLive).toBe(false);
  });
});
