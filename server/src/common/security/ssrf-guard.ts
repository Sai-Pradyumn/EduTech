import { lookup } from 'dns/promises';

/**
 * SSRF egress guard (SECURITY_IMPLEMENTATION.md §4.6/§10). Any time the server fetches a
 * URL derived from user input — RAG ingestion by URL, webhook callbacks, avatar-by-URL,
 * link unfurling — route it through {@link assertPublicUrl} first.
 *
 * Strategy, per the OWASP SSRF Prevention Cheat Sheet:
 *   1. Enforce protocol allowlist (http/https only) and reject embedded credentials.
 *   2. Optionally enforce a host allowlist (the strongest control — prefer it when the set
 *      of legitimate destinations is known).
 *   3. Resolve DNS and verify EVERY resolved address is publicly routable, which defeats
 *      DNS-rebinding and decimal/hex/IPv6 encodings that bypass string blocklists.
 *
 * Blocklisting IP ranges is a backstop, not the primary defence; the allowlist + resolve
 * step is what actually holds.
 */

export interface SsrfOptions {
  /** Permitted URL protocols. Default: http, https. */
  allowedProtocols?: string[];
  /**
   * If set, the URL host must match one of these (exact or subdomain). This is the
   * strongest control; use it wherever the legitimate destinations are known.
   */
  allowedHosts?: string[];
  /** Escape hatch for trusted internal callers/tests. Never set this for user input. */
  allowPrivate?: boolean;
}

export type IpClass =
  | 'public'
  | 'loopback'
  | 'private'
  | 'link-local'
  | 'unique-local'
  | 'cgnat'
  | 'multicast'
  | 'reserved'
  | 'unspecified'
  | 'documentation';

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function ipv4ToInt(ip: string): number | null {
  const m = IPV4_RE.exec(ip);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return null;
  return (
    ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
  );
}

function inCidr(ipInt: number, base: string, maskBits: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/** Classify an IPv4 literal into a routability bucket. */
export function classifyIpv4(ip: string): IpClass {
  const n = ipv4ToInt(ip);
  if (n === null) return 'reserved';
  if (inCidr(n, '0.0.0.0', 8)) return 'unspecified';
  if (inCidr(n, '127.0.0.0', 8)) return 'loopback';
  if (inCidr(n, '169.254.0.0', 16)) return 'link-local'; // incl. 169.254.169.254 metadata
  if (inCidr(n, '10.0.0.0', 8)) return 'private';
  if (inCidr(n, '172.16.0.0', 12)) return 'private';
  if (inCidr(n, '192.168.0.0', 16)) return 'private';
  if (inCidr(n, '100.64.0.0', 10)) return 'cgnat';
  if (inCidr(n, '192.0.0.0', 24)) return 'reserved';
  if (inCidr(n, '192.0.2.0', 24)) return 'documentation';
  if (inCidr(n, '198.51.100.0', 24)) return 'documentation';
  if (inCidr(n, '203.0.113.0', 24)) return 'documentation';
  if (inCidr(n, '198.18.0.0', 15)) return 'reserved';
  if (inCidr(n, '224.0.0.0', 4)) return 'multicast';
  if (inCidr(n, '240.0.0.0', 4)) return 'reserved';
  return 'public';
}

/** Classify an IPv6 literal (handles IPv4-mapped addresses by delegating to the v4 logic). */
export function classifyIpv6(ip: string): IpClass {
  const addr = ip
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0];
  if (addr === '::1') return 'loopback';
  if (addr === '::' || addr === '') return 'unspecified';

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible — classify the embedded v4 address.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(addr);
  if (mapped) return classifyIpv4(mapped[1]);

  if (/^fe[89ab][0-9a-f]:/.test(addr)) return 'link-local'; // fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return 'unique-local'; // fc00::/7
  if (/^ff[0-9a-f]{2}:/.test(addr)) return 'multicast'; // ff00::/8
  if (addr.startsWith('2001:db8:')) return 'documentation';
  return 'public';
}

/** True if the literal IP address is anything other than publicly routable. */
export function isPrivateIp(ip: string): boolean {
  const cls = ip.includes(':') ? classifyIpv6(ip) : classifyIpv4(ip);
  return cls !== 'public';
}

function isIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '');
  return IPV4_RE.test(h) || h.includes(':');
}

function hostAllowed(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase();
  return allowed.some((a) => {
    const norm = a.toLowerCase();
    return h === norm || h.endsWith(`.${norm}`);
  });
}

export interface UrlShapeResult {
  ok: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Synchronous, DNS-free checks: valid URL, allowed protocol, no embedded credentials,
 * host allowlist (if provided), and — for IP-literal hosts — public-range enforcement.
 * DNS-name hosts still need {@link assertPublicUrl} to catch rebinding.
 */
export function checkUrlShape(
  raw: string,
  opts: SsrfOptions = {},
): UrlShapeResult {
  const protocols = opts.allowedProtocols ?? ['http:', 'https:'];
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }
  if (!protocols.includes(url.protocol))
    return { ok: false, reason: `Protocol not allowed: ${url.protocol}` };
  if (url.username || url.password)
    return { ok: false, reason: 'Embedded credentials are not allowed' };

  const host = url.hostname;
  if (!host) return { ok: false, reason: 'Missing host' };
  if (host.toLowerCase() === 'localhost')
    return { ok: false, reason: 'localhost is not allowed' };

  if (opts.allowedHosts && !hostAllowed(host, opts.allowedHosts))
    return { ok: false, reason: `Host not in allowlist: ${host}` };

  if (isIpLiteral(host) && !opts.allowPrivate) {
    const bare = host.replace(/^\[|\]$/g, '');
    if (isPrivateIp(bare))
      return { ok: false, reason: `Non-public IP address: ${bare}` };
  }
  return { ok: true, url };
}

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`Blocked outbound request: ${reason}`);
    this.name = 'SsrfBlockedError';
  }
}

/**
 * Full guard: runs the shape checks, then resolves the hostname and rejects if ANY
 * resolved address is non-public. Call this immediately before making the request; if the
 * caller can pin/reuse the resolved IP, even better (prevents a re-resolve race).
 */
export async function assertPublicUrl(
  raw: string,
  opts: SsrfOptions = {},
): Promise<URL> {
  const shape = checkUrlShape(raw, opts);
  if (!shape.ok || !shape.url)
    throw new SsrfBlockedError(shape.reason ?? 'invalid');
  if (opts.allowPrivate) return shape.url;

  const host = shape.url.hostname.replace(/^\[|\]$/g, '');
  if (isIpLiteral(host)) return shape.url; // already range-checked in checkUrlShape

  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new SsrfBlockedError(`DNS resolution failed for ${host}`);
  }
  if (records.length === 0)
    throw new SsrfBlockedError(`No DNS records for ${host}`);
  for (const rec of records) {
    if (isPrivateIp(rec.address))
      throw new SsrfBlockedError(
        `${host} resolves to a non-public address (${rec.address})`,
      );
  }
  return shape.url;
}
