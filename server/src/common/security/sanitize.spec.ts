import {
  safeCompare,
  sanitizeFilename,
  sanitizeLogValue,
  stripDangerousKeys,
} from './sanitize';

describe('security/sanitize', () => {
  describe('stripDangerousKeys', () => {
    it('removes Mongo operator keys at any depth and reports paths', () => {
      const { cleaned, removed } = stripDangerousKeys({
        email: 'a@b.com',
        password: { $gt: '' },
        filter: { nested: { $where: 'sleep(1000)' } },
      });
      expect(cleaned).toEqual({
        email: 'a@b.com',
        password: {},
        filter: { nested: {} },
      });
      expect(removed).toEqual(
        expect.arrayContaining(['password.$gt', 'filter.nested.$where']),
      );
    });

    it('removes dotted keys (Mongo path traversal)', () => {
      const { cleaned } = stripDangerousKeys({ 'a.b': 1, ok: 2 });
      expect(cleaned).toEqual({ ok: 2 });
    });

    it('removes prototype-pollution vectors', () => {
      const input = JSON.parse(
        '{"__proto__": {"polluted": true}, "constructor": 1, "safe": "x"}',
      ) as Record<string, unknown>;
      const { cleaned, removed } = stripDangerousKeys(input);
      expect(Object.keys(cleaned)).toEqual(['safe']);
      expect(removed.length).toBe(2);
      // The global prototype must not have been touched.
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('preserves arrays, dates, and primitives; never mutates input', () => {
      const input = { list: [{ $bad: 1, good: 2 }], when: new Date(0), n: 5 };
      const { cleaned } = stripDangerousKeys(input);
      expect((cleaned.list[0] as Record<string, unknown>).good).toBe(2);
      expect((cleaned.list[0] as Record<string, unknown>).$bad).toBeUndefined();
      expect(cleaned.when).toBeInstanceOf(Date);
      expect((input.list[0] as Record<string, unknown>).$bad).toBe(1); // untouched
    });

    it('survives circular structures', () => {
      const a: Record<string, unknown> = { name: 'a' };
      a.self = a;
      expect(() => stripDangerousKeys(a)).not.toThrow();
    });
  });

  describe('sanitizeLogValue', () => {
    it('strips CRLF so a value cannot forge log lines', () => {
      const forged = 'user@x.com\r\n[FAKE] admin login ok';
      const out = sanitizeLogValue(forged);
      expect(out).not.toContain('\n');
      expect(out).not.toContain('\r');
      expect(out).toContain('[FAKE]'); // content kept, line structure neutralized
    });

    it('strips terminal-escape control characters and caps length', () => {
      const esc = String.fromCharCode(27);
      const out = sanitizeLogValue(
        esc + '[31mred' + esc + '[0m' + 'x'.repeat(600),
      );
      expect(out).not.toContain(esc);
      expect(out.length).toBeLessThanOrEqual(516);
    });
  });

  describe('sanitizeFilename', () => {
    it('removes path separators and traversal dots', () => {
      expect(sanitizeFilename('../../etc/passwd')).toBe('etc_passwd');
      expect(sanitizeFilename('..\\..\\boot.ini')).toBe('boot.ini');
    });

    it('neutralizes Windows-illegal characters and reserved names', () => {
      expect(sanitizeFilename('a<b>:c?.txt')).toBe('a_b__c_.txt');
      expect(sanitizeFilename('CON.txt')).toBe('_CON.txt');
    });

    it('caps length but keeps the extension, and never returns empty', () => {
      const long = `${'x'.repeat(300)}.pdf`;
      const out = sanitizeFilename(long);
      expect(out.length).toBeLessThanOrEqual(120);
      expect(out.endsWith('.pdf')).toBe(true);
      expect(sanitizeFilename('...')).toBe('file');
      expect(sanitizeFilename(undefined)).toBe('file');
    });
  });

  describe('safeCompare', () => {
    it('matches equal strings and rejects different ones (any lengths)', () => {
      expect(safeCompare('whsec_abc123', 'whsec_abc123')).toBe(true);
      expect(safeCompare('whsec_abc123', 'whsec_abc124')).toBe(false);
      expect(safeCompare('short', 'much-longer-value')).toBe(false);
      expect(safeCompare('', '')).toBe(true);
    });
  });
});
