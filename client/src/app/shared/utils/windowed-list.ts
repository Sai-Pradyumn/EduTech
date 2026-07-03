import { Signal, computed, signal } from '@angular/core';

export interface WindowedList<T> {
  /** The bounded slice to render (first `limit` items). */
  items: Signal<T[]>;
  /** How many items are currently hidden past the window. */
  remaining: Signal<number>;
  hasMore: Signal<boolean>;
  /** Reveal one more page (`step` items). */
  more: () => void;
  /** Collapse back to the first page (e.g. after a filter change). */
  reset: () => void;
}

/**
 * Bounds how much of a potentially-unbounded list is committed to the DOM at once
 * (Performance backlog — ledger timeline, audit logs, admin roster, community
 * threads). Renders the first `step` items and reveals `step` more on demand.
 *
 * This is deliberately dependency-free windowing rather than CDK virtual scroll:
 * these lists have non-uniform row heights and layout that a fixed-`itemSize`
 * viewport would break — the ledger's timeline connector, the roster's semantic
 * `<table>`, and community's rich thread cards. Windowing keeps the DOM bounded
 * while preserving each native layout.
 */
export function windowedList<T>(
  source: Signal<T[]>,
  step = 50,
): WindowedList<T> {
  const limit = signal(step);
  return {
    items: computed(() => source().slice(0, limit())),
    remaining: computed(() => Math.max(0, source().length - limit())),
    hasMore: computed(() => source().length > limit()),
    more: () => limit.update((n) => n + step),
    reset: () => limit.set(step),
  };
}
