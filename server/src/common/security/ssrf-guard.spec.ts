import {
  assertPublicUrl,
  checkUrlShape,
  classifyIpv4,
  classifyIpv6,
  isPrivateIp,
  SsrfBlockedError,
} from './ssrf-guard';

describe('security/ssrf-guard', () => {
  describe('classifyIpv4', () => {
    it.each([
      ['127.0.0.1', 'loopback'],
      ['169.254.169.254', 'link-local'], // cloud metadata endpoint
      ['10.1.2.3', 'private'],
      ['172.16.0.1', 'private'],
      ['172.31.255.255', 'private'],
      ['192.168.1.1', 'private'],
      ['100.64.0.1', 'cgnat'],
      ['0.0.0.0', 'unspecified'],
      ['8.8.8.8', 'public'],
      ['1.1.1.1', 'public'],
    ])('%s → %s', (ip, cls) => {
      expect(classifyIpv4(ip)).toBe(cls);
    });

    it('does not misclassify a public address adjacent to a private block', () => {
      expect(classifyIpv4('11.0.0.1')).toBe('public');
      expect(classifyIpv4('172.32.0.1')).toBe('public');
    });
  });

  describe('classifyIpv6', () => {
    it.each([
      ['::1', 'loopback'],
      ['fe80::1', 'link-local'],
      ['fc00::1', 'unique-local'],
      ['fd00::1', 'unique-local'],
      ['::ffff:169.254.169.254', 'link-local'], // IPv4-mapped metadata
      ['::ffff:8.8.8.8', 'public'],
      ['2606:4700:4700::1111', 'public'],
    ])('%s → %s', (ip, cls) => {
      expect(classifyIpv6(ip)).toBe(cls);
    });
  });

  describe('isPrivateIp', () => {
    it('flags private/loopback/metadata and passes public', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('169.254.169.254')).toBe(true);
      expect(isPrivateIp('::1')).toBe(true);
      expect(isPrivateIp('8.8.8.8')).toBe(false);
    });
  });

  describe('checkUrlShape', () => {
    it('rejects non-http(s) protocols', () => {
      expect(checkUrlShape('file:///etc/passwd').ok).toBe(false);
      expect(checkUrlShape('gopher://evil').ok).toBe(false);
      expect(checkUrlShape('ftp://host/x').ok).toBe(false);
    });

    it('rejects embedded credentials (used to smuggle a real host)', () => {
      expect(checkUrlShape('http://user:pass@example.com').ok).toBe(false);
    });

    it('rejects localhost and private/metadata IP literals', () => {
      expect(checkUrlShape('http://localhost/admin').ok).toBe(false);
      expect(checkUrlShape('http://127.0.0.1:3000/').ok).toBe(false);
      expect(checkUrlShape('http://169.254.169.254/latest/meta-data/').ok).toBe(
        false,
      );
      expect(checkUrlShape('http://[::1]/').ok).toBe(false);
      expect(checkUrlShape('http://10.0.0.5/internal').ok).toBe(false);
    });

    it('accepts a well-formed public URL', () => {
      const r = checkUrlShape('https://example.com/path?q=1');
      expect(r.ok).toBe(true);
      expect(r.url?.hostname).toBe('example.com');
    });

    it('enforces a host allowlist when provided', () => {
      const opts = { allowedHosts: ['hooks.stripe.com'] };
      expect(checkUrlShape('https://hooks.stripe.com/x', opts).ok).toBe(true);
      expect(checkUrlShape('https://api.stripe.com/x', opts).ok).toBe(false);
      expect(checkUrlShape('https://evil.com/x', opts).ok).toBe(false);
    });

    it('allowlist matches subdomains but not lookalikes', () => {
      const opts = { allowedHosts: ['example.com'] };
      expect(checkUrlShape('https://cdn.example.com/a', opts).ok).toBe(true);
      expect(checkUrlShape('https://example.com.evil.net/a', opts).ok).toBe(
        false,
      );
    });
  });

  describe('assertPublicUrl', () => {
    it('throws SsrfBlockedError for an IP-literal metadata URL without DNS', async () => {
      await expect(
        assertPublicUrl('http://169.254.169.254/latest/'),
      ).rejects.toBeInstanceOf(SsrfBlockedError);
    });

    it('throws for loopback literal', async () => {
      await expect(assertPublicUrl('http://127.0.0.1/')).rejects.toBeInstanceOf(
        SsrfBlockedError,
      );
    });

    it('honours allowPrivate for trusted internal use', async () => {
      const url = await assertPublicUrl('http://127.0.0.1:6379/', {
        allowPrivate: true,
      });
      expect(url.hostname).toBe('127.0.0.1');
    });
  });
});
