import { MockAIProvider } from './mock-ai.provider';

describe('MockAIProvider', () => {
  const mock = new MockAIProvider();

  it('is never marked live', () => {
    expect(mock.isLive).toBe(false);
  });

  it('generateText returns an honest offline notice — not a fake "real" answer', async () => {
    const text = await mock.generateText([
      { role: 'user', content: 'What is a closure in JavaScript?' },
    ]);
    expect(text).toMatch(/offline demo mode/i);
    expect(text).toMatch(/API key/i);
    // Regression guard: it must NOT impersonate a genuine structured explanation.
    expect(text).not.toMatch(/here'?s a clear, structured explanation/i);
  });

  it('streamText yields the same honest message, chunked', async () => {
    let out = '';
    for await (const token of mock.streamText([
      { role: 'user', content: 'hi' },
    ])) {
      out += token;
    }
    expect(out).toMatch(/offline demo mode/i);
  });

  it('generateStructuredOutput defers to the caller-provided mockFactory', async () => {
    const result = await mock.generateStructuredOutput<{ ok: number }>(
      [],
      {},
      {
        mockFactory: () => ({ ok: 1 }),
      },
    );
    expect(result).toEqual({ ok: 1 });
  });

  it('embeddings are deterministic and L2-normalized', async () => {
    const a = await mock.generateEmbedding('react hooks');
    const b = await mock.generateEmbedding('react hooks');
    expect(a).toEqual(b);
    const norm = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
});
