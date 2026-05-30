/** Shared scoring primitives for the vector stores. Pure functions, no I/O. */

/** Cosine similarity for (already L2-normalized) vectors; safe on mismatched/empty. */
export function cosine(a: number[], b: number[]): number {
  // Different dimensions ⇒ embedded by different providers/models (e.g. mock-256 vs a
  // real 768/1536-dim model). Comparing them is meaningless, so score 0 (the keyword
  // path still matches). Re-ingest a corpus after switching providers for dense recall.
  if (a.length !== b.length) return 0;
  const n = a.length;
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'for', 'on', 'with', 'as',
  'by', 'at', 'be', 'this', 'that', 'it', 'from', 'how', 'what', 'why', 'when', 'do', 'does',
  'i', 'my', 'me', 'you', 'your', 'we', 'can', 'about', 'into', 'which', 'who',
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

/** Term-overlap score (0..1): fraction of query terms present, weighted by repetition. */
export function termOverlap(queryTerms: string[], docText: string): number {
  if (queryTerms.length === 0) return 0;
  const docTerms = tokenize(docText);
  if (docTerms.length === 0) return 0;
  const docSet = new Map<string, number>();
  for (const t of docTerms) docSet.set(t, (docSet.get(t) ?? 0) + 1);
  let matched = 0;
  let weight = 0;
  for (const q of new Set(queryTerms)) {
    const hits = docSet.get(q);
    if (hits) {
      matched += 1;
      weight += Math.min(3, hits);
    }
  }
  const coverage = matched / new Set(queryTerms).size;
  const density = weight / Math.sqrt(docTerms.length);
  return Math.min(1, 0.7 * coverage + 0.3 * Math.min(1, density));
}
