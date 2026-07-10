import {
  canonicalize,
  ChainedEntry,
  computeEntryHash,
  GENESIS_HASH,
  verifyChain,
} from './audit-chain';

function buildChain(
  payloads: Array<{ action: string; metadata?: Record<string, unknown> }>,
): ChainedEntry[] {
  const out: ChainedEntry[] = [];
  let prev = GENESIS_HASH;
  payloads.forEach((payload, i) => {
    const timestampIso = new Date(1_700_000_000_000 + i * 1000).toISOString();
    const entryHash = computeEntryHash(prev, payload, timestampIso);
    out.push({ prevHash: prev, entryHash, timestampIso, payload });
    prev = entryHash;
  });
  return out;
}

describe('security/audit-chain', () => {
  describe('canonicalize', () => {
    it('is stable across key insertion order', () => {
      expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(
        canonicalize({ a: { c: 3, d: 2 }, b: 1 }),
      );
    });

    it('drops undefined values but keeps null', () => {
      expect(canonicalize({ a: undefined, b: null })).toBe('{"b":null}');
    });

    it('preserves array order (arrays are ordered data)', () => {
      expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
    });
  });

  describe('verifyChain', () => {
    it('accepts an intact chain (and the empty chain)', () => {
      expect(verifyChain([]).valid).toBe(true);
      const chain = buildChain([
        { action: 'user.login' },
        { action: 'admin.export', metadata: { rows: 10 } },
        { action: 'user.delete' },
      ]);
      expect(verifyChain(chain)).toEqual({ valid: true, checked: 3 });
    });

    it('detects modification of a historical entry', () => {
      const chain = buildChain([
        { action: 'user.login' },
        { action: 'admin.export', metadata: { rows: 10 } },
        { action: 'user.delete' },
      ]);
      chain[1].payload.metadata = { rows: 999999 }; // tamper
      const result = verifyChain(chain);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(1);
      expect(result.reason).toMatch(/modification/);
    });

    it('detects deletion of an entry (the gap breaks the link)', () => {
      const chain = buildChain([
        { action: 'a' },
        { action: 'b' },
        { action: 'c' },
      ]);
      chain.splice(1, 1); // delete the middle entry
      const result = verifyChain(chain);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(1);
      expect(result.reason).toMatch(/insertion|deletion/);
    });

    it('detects a forged timestamp', () => {
      const chain = buildChain([{ action: 'a' }, { action: 'b' }]);
      chain[0].timestampIso = new Date(0).toISOString();
      expect(verifyChain(chain).valid).toBe(false);
    });

    it('requires the first entry to anchor at the genesis hash', () => {
      const chain = buildChain([{ action: 'a' }]);
      chain[0].prevHash = 'f'.repeat(64);
      const result = verifyChain(chain);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(0);
    });
  });
});
