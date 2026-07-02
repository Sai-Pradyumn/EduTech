import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { DocumentChunkDocument } from '../schemas/document-chunk.schema';
import { QdrantVectorStore } from './qdrant-vector-store';

/**
 * Hermetic: fetch is mocked, Mongo model is faked. Proves the three contract
 * points — dense hits map from Qdrant payloads, count drift triggers a resync
 * of exactly that user, and any Qdrant failure degrades to the inherited
 * in-process cosine search (RAG never breaks because the vector DB is down).
 */

const USER = '507f1f77bcf86cd799439011';

const MONGO_CHUNKS = [
  {
    _id: '65f000000000000000000001',
    document: '65f000000000000000000abc',
    documentTitle: 'DBMS notes',
    text: 'Third normal form removes transitive dependencies.',
    embedding: [1, 0, 0],
  },
];

function fakeChunksModel(count: number) {
  const chain = {
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(MONGO_CHUNKS),
  };
  return {
    find: jest.fn(() => chain),
    countDocuments: jest.fn(() => ({ exec: () => Promise.resolve(count) })),
  } as unknown as Model<DocumentChunkDocument>;
}

/** Routes fake fetch responses by URL suffix. */
function mockFetch(routes: Record<string, object>) {
  return jest.fn((url: string | URL) => {
    const u = String(url);
    for (const [suffix, value] of Object.entries(routes)) {
      if (u.includes(suffix)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(value),
          text: () => Promise.resolve(''),
        } as Response);
      }
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    } as Response);
  });
}

describe('QdrantVectorStore', () => {
  const realFetch = global.fetch;
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
    global.fetch = realFetch;
  });

  it('maps Qdrant payloads to ChunkHits (dense path)', async () => {
    global.fetch = mockFetch({
      '/points/count': { result: { count: 1 } }, // in sync — no resync
      '/points/search': {
        result: [
          {
            id: 'x',
            score: 0.83,
            payload: {
              chunkId: 'c1',
              document: 'd1',
              documentTitle: 'DBMS notes',
              text: 'Third normal form removes transitive dependencies.',
              headingPath: 'Normalization',
            },
          },
        ],
      },
    }) as unknown as typeof fetch;

    const store = new QdrantVectorStore(
      fakeChunksModel(1),
      'http://qdrant:6333',
    );
    const hits = await store.search(
      { text: '3NF', embedding: [1, 0, 0] },
      { userId: USER },
      5,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].documentTitle).toBe('DBMS notes');
    expect(hits[0].score).toBeCloseTo(0.83);
    expect(hits[0].headingPath).toBe('Normalization');
  });

  it('count drift triggers a scoped resync (delete + re-upsert that user)', async () => {
    const calls: string[] = [];
    const fetchMock = mockFetch({
      '/points/count': { result: { count: 0 } }, // Qdrant empty, Mongo has 1 → drift
      '/points/search': { result: [] },
    });
    global.fetch = ((url: string | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(url)}`);
      return fetchMock(url);
    }) as unknown as typeof fetch;

    const store = new QdrantVectorStore(
      fakeChunksModel(1),
      'http://qdrant:6333',
    );
    await store.search(
      { text: 'q', embedding: [1, 0, 0] },
      { userId: USER },
      5,
    );

    expect(calls.some((c) => c.includes('/points/delete'))).toBe(true);
    const upsert = calls.find(
      (c) => c.startsWith('PUT') && c.includes('/points?wait=true'),
    );
    expect(upsert).toBeTruthy();
  });

  it('any Qdrant failure degrades to the in-process cosine search', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const store = new QdrantVectorStore(
      fakeChunksModel(1),
      'http://qdrant:6333',
    );
    const hits = await store.search(
      { text: '3NF', embedding: [1, 0, 0] },
      { userId: USER },
      5,
    );
    // Fallback ranked the Mongo chunk by cosine ([1,0,0]·[1,0,0] = 1).
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toContain('transitive dependencies');
    expect(hits[0].score).toBeCloseTo(1);
  });
});
