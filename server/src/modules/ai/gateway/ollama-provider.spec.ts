import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { FactoryProvider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthTrackerService } from './health-tracker.service';
import { LlmGatewayService } from './llm-gateway.service';
import { providerChainFactory } from './provider-chain';
import { MockAIProvider } from '../providers/mock-ai.provider';
import { IAIProvider } from '../interfaces/ai-provider.interface';

/**
 * Proves the "real AI with zero cloud keys" path end-to-end: a stub OpenAI-compatible
 * server stands in for a local Ollama daemon, and the real gateway + provider chain
 * route a chat call to it and surface its answer (NOT the mock placeholder) — with
 * every cloud key blank. Self-contained: no Ollama install, no network.
 */
type ReqHandler = (body: string) => { status?: number; json: unknown };

function startStub(handler: ReqHandler): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c as string));
      req.on('end', () => {
        const { status = 200, json } = handler(body);
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(json));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/v1` });
    });
  });
}

function chatCompletion(content: string) {
  return {
    id: 'stub',
    object: 'chat.completion',
    created: 0,
    model: 'llama3.2',
    choices: [
      { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
    usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
  };
}

/** Full `ai` config with every cloud provider keyless and Ollama pointed at `baseURL`. */
function aiConfig(baseURL: string, ollamaEnabled = true) {
  return {
    provider: 'auto',
    strategy: 'fallback',
    maxOutputTokens: 256,
    requestTimeoutMs: 5000,
    order: ['groq', 'gemini', 'openai', 'claude', 'ollama'],
    providers: {
      claude: { apiKey: '', model: 'm' },
      openai: { apiKey: '', model: 'm' },
      groq: { apiKey: '', model: 'm', baseURL: 'https://x' },
      mistral: { apiKey: '', model: 'm', baseURL: 'https://x' },
      openrouter: { apiKey: '', model: 'm', baseURL: 'https://x', headers: {} },
      deepseek: { apiKey: '', model: 'm', baseURL: 'https://x' },
      gemini: { apiKey: '', model: 'm' },
      ollama: { enabled: ollamaEnabled, apiKey: 'ollama', model: 'llama3.2', baseURL },
    },
  };
}

function buildGateway(baseURL: string): LlmGatewayService {
  const ai = aiConfig(baseURL);
  const config = { get: () => ai } as unknown as ConfigService<never, true>;
  const chain = (providerChainFactory as FactoryProvider).useFactory(
    config,
    new MockAIProvider(),
  ) as IAIProvider[];
  return new LlmGatewayService(chain, new HealthTrackerService(), config);
}

describe('Ollama local provider (zero-key real AI)', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('routes a chat call to the local endpoint and returns its real answer', async () => {
    const { server, url } = await startStub(() => ({
      json: chatCompletion('REAL local answer from the Ollama stub.'),
    }));
    try {
      const gateway = buildGateway(url);
      const out = await gateway.generateText([{ role: 'user', content: 'hi' }]);
      expect(out).toBe('REAL local answer from the Ollama stub.');
      // Sanity: it is NOT the honest offline placeholder.
      expect(out).not.toMatch(/offline demo mode/i);
    } finally {
      server.close();
    }
  });

  it('falls back to the mock terminal when the local daemon errors', async () => {
    // 400 is non-retryable, so the gateway fails over immediately (deterministic, fast).
    const { server, url } = await startStub(() => ({
      status: 400,
      json: { error: { message: 'model "llama3.2" not found, run: ollama pull llama3.2' } },
    }));
    try {
      const gateway = buildGateway(url);
      const out = await gateway.generateText([{ role: 'user', content: 'hi' }]);
      // No hang, no throw — the gateway degrades to the honest mock notice.
      expect(out).toMatch(/offline demo mode/i);
    } finally {
      server.close();
    }
  });
});
