import {
  checkBreachedPassword,
  countInRange,
  hashParts,
} from './breached-password';

describe('security/breached-password', () => {
  describe('hashParts', () => {
    it('splits the SHA-1 into a 5-char prefix and 35-char suffix', () => {
      // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8 (a well-known digest).
      const { prefix, suffix } = hashParts('password');
      expect(prefix).toBe('5BAA6');
      expect(suffix).toBe('1E4C9B93F3F0682250B6CF8331B7EE68FD8');
      expect(prefix.length).toBe(5);
      expect(suffix.length).toBe(35);
    });
  });

  describe('countInRange', () => {
    const body = [
      '0018A45C4D1DEF81644B54AB7F969B88D65:3',
      '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824',
      '011053FD0102E94D6AE2F8B83D76FAF94F6:1',
    ].join('\r\n');

    it('finds the matching suffix count', () => {
      expect(countInRange(body, '1E4C9B93F3F0682250B6CF8331B7EE68FD8')).toBe(
        9545824,
      );
    });

    it('is case-insensitive on the suffix', () => {
      expect(countInRange(body, '1e4c9b93f3f0682250b6cf8331b7ee68fd8')).toBe(
        9545824,
      );
    });

    it('returns 0 for a clean suffix and tolerates junk lines', () => {
      expect(countInRange(body + '\nnot-a-line', 'F'.repeat(35))).toBe(0);
      expect(countInRange('', 'ABC')).toBe(0);
    });
  });

  describe('checkBreachedPassword', () => {
    const rangeBody = '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\nAAAA:2';

    it('flags a breached password using only the hash prefix in the request', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(rangeBody),
      });
      const result = await checkBreachedPassword('password', { fetchFn });
      expect(result).toEqual({ breached: true, count: 9545824, checked: true });
      // k-anonymity: the URL must contain the 5-char prefix and nothing longer.
      const url = (fetchFn.mock.calls[0] as unknown[])[0] as string;
      expect(url.endsWith('/range/5BAA6')).toBe(true);
      expect(url).not.toContain('1E4C9B93');
    });

    it('passes a clean password', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('AAAA:2\r\nBBBB:5'),
      });
      const result = await checkBreachedPassword(
        'genuinely-unique-passphrase-9Q!x',
        { fetchFn },
      );
      expect(result.breached).toBe(false);
      expect(result.checked).toBe(true);
    });

    it('fails open (checked:false, not breached) on network error', async () => {
      const fetchFn = jest.fn().mockRejectedValue(new Error('offline'));
      const result = await checkBreachedPassword('anything', { fetchFn });
      expect(result).toEqual({ breached: false, count: 0, checked: false });
    });

    it('fails open on a non-2xx response', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ ok: false });
      const result = await checkBreachedPassword('anything', { fetchFn });
      expect(result.checked).toBe(false);
    });

    it('respects a custom threshold', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('1E4C9B93F3F0682250B6CF8331B7EE68FD8:3'),
      });
      const lenient = await checkBreachedPassword('password', {
        fetchFn,
        threshold: 10,
      });
      expect(lenient.breached).toBe(false);
      expect(lenient.count).toBe(3);
    });
  });
});
