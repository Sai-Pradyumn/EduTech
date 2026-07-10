import { createHash } from 'crypto';

/**
 * Tamper-evident audit chaining (SECURITY_IMPLEMENTATION.md §15 P2 — hash-chained audit
 * log). Each audit entry stores the hash of its predecessor plus its own content hash:
 *
 *     entryHash = SHA-256( prevHash || canonical(payload) || timestamp )
 *
 * Editing or deleting ANY historical entry breaks every subsequent link, so tampering is
 * detectable by a linear re-walk (verifyChain). This makes the log tamper-EVIDENT, not
 * tamper-PROOF: an attacker with full DB write access could rebuild the whole chain, which
 * is why §15 also calls for shipping logs to an external sink they can't rewrite. Pure
 * functions — persistence lives in AuditService.
 */

/** Hash of "nothing before this" — the chain's genesis anchor. */
export const GENESIS_HASH = '0'.repeat(64);

export interface ChainablePayload {
  action: string;
  actorId?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Deterministic serialization: keys sorted recursively so semantically-equal payloads hash
 * identically regardless of property insertion order.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
  return `{${entries.join(',')}}`;
}

/** Compute an entry's chain hash from its predecessor's hash, payload, and timestamp. */
export function computeEntryHash(
  prevHash: string,
  payload: ChainablePayload,
  timestampIso: string,
): string {
  return createHash('sha256')
    .update(prevHash)
    .update('|')
    .update(canonicalize(payload))
    .update('|')
    .update(timestampIso)
    .digest('hex');
}

export interface ChainedEntry {
  prevHash: string;
  entryHash: string;
  timestampIso: string;
  payload: ChainablePayload;
}

export interface ChainVerification {
  valid: boolean;
  checked: number;
  /** Index (0-based, in the order given) of the first broken link, if any. */
  brokenAt?: number;
  reason?: string;
}

/**
 * Verify a chain given entries in WRITE ORDER (oldest first). Confirms each entry's hash
 * recomputes from its content and that every prevHash matches its predecessor's entryHash.
 */
export function verifyChain(entries: ChainedEntry[]): ChainVerification {
  let expectedPrev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== expectedPrev) {
      return {
        valid: false,
        checked: i,
        brokenAt: i,
        reason:
          'prevHash does not match the previous entry (insertion/deletion)',
      };
    }
    const recomputed = computeEntryHash(e.prevHash, e.payload, e.timestampIso);
    if (recomputed !== e.entryHash) {
      return {
        valid: false,
        checked: i,
        brokenAt: i,
        reason: 'entryHash does not recompute from content (modification)',
      };
    }
    expectedPrev = e.entryHash;
  }
  return { valid: true, checked: entries.length };
}
