import { ledgerKindMeta, LEDGER_KIND_META, LedgerKind } from './ledger.service';

describe('ledgerKindMeta', () => {
  it('returns the mapped meta for a known kind', () => {
    expect(ledgerKindMeta('certificate_earned').glyph).toBe('🏅');
    expect(ledgerKindMeta('practice_solved').label).toBe('Practice solved');
  });

  it('falls back gracefully for an unknown server kind', () => {
    const meta = ledgerKindMeta('some_future_kind');
    expect(meta.glyph).toBe('•');
    expect(meta.label).toBe('some future kind');
  });

  it('has a non-empty label + glyph for every known kind', () => {
    for (const kind of Object.keys(LEDGER_KIND_META) as LedgerKind[]) {
      expect(LEDGER_KIND_META[kind].label.length).toBeGreaterThan(0);
      expect(LEDGER_KIND_META[kind].glyph.length).toBeGreaterThan(0);
    }
  });
});
