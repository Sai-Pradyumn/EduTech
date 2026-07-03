import { Types } from 'mongoose';
import { KnowledgeService } from './knowledge.service';

/**
 * Audio overview — live narration vs honest extractive fallback.
 * Hermetic: fake models/storage/AI.
 */
describe('KnowledgeService.audioOverview', () => {
  const userId = new Types.ObjectId().toHexString();
  const docId = new Types.ObjectId();

  const chunk = (text: string, i: number) => ({
    text,
    chunkIndex: i,
    keywords: [],
  });

  function build(opts: {
    live: boolean;
    script?: string;
    fail?: boolean;
    chunks?: { text: string }[];
  }) {
    const doc = {
      _id: docId,
      user: new Types.ObjectId(userId),
      title: 'Event Loop Internals',
      topic: 'javascript',
      tags: ['js'],
      chunkCount: 4,
    };
    const docs = { findOne: jest.fn().mockResolvedValue(doc) };
    const chunkDocs = opts.chunks ?? [
      chunk('The event loop processes macrotasks one at a time.', 0),
      chunk('Microtasks drain completely between macrotasks.', 1),
    ];
    const chunks = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(chunkDocs),
      }),
    };
    const ai = {
      isLive: opts.live,
      generateStructuredOutput: opts.fail
        ? jest.fn().mockRejectedValue(new Error('down'))
        : jest.fn().mockResolvedValue({ script: opts.script ?? '' }),
      logUsage: jest.fn().mockResolvedValue(undefined),
    };
    const service = new KnowledgeService(
      docs as never,
      chunks as never,
      {} as never,
      ai as never,
    );
    return { service, ai };
  }

  it('narrates with the live model and marks the result as real', async () => {
    const script = 'Welcome. '.repeat(60); // > 400 chars
    const { service } = build({ live: true, script });
    const out = await service.audioOverview(userId, String(docId));
    expect(out.fallback).toBe(false);
    expect(out.script).toBe(script.trim());
    expect(out.title).toBe('Event Loop Internals');
  });

  it('falls back to an honest extractive script offline', async () => {
    const { service, ai } = build({ live: false });
    const out = await service.audioOverview(userId, String(docId));
    expect(out.fallback).toBe(true);
    expect(out.script).toContain('Event Loop Internals');
    expect(out.script).toContain('event loop processes macrotasks');
    expect(out.script).toContain('live AI provider');
    expect(ai.generateStructuredOutput).not.toHaveBeenCalled();
  });

  it('treats a degenerate short script or provider failure as fallback', async () => {
    const short = build({ live: true, script: 'too short' });
    expect(
      (await short.service.audioOverview(userId, String(docId))).fallback,
    ).toBe(true);

    const failing = build({ live: true, fail: true });
    expect(
      (await failing.service.audioOverview(userId, String(docId))).fallback,
    ).toBe(true);
  });
});
