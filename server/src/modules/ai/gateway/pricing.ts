/** Approximate USD price per 1M tokens, keyed by model-name prefix. Tunable. */
interface Rate {
  in: number;
  out: number;
}

const RATES: { match: RegExp; rate: Rate }[] = [
  { match: /^claude-opus/i, rate: { in: 15, out: 75 } },
  { match: /^claude-sonnet/i, rate: { in: 3, out: 15 } },
  { match: /^claude-haiku/i, rate: { in: 0.8, out: 4 } },
  { match: /^gpt-4o-mini/i, rate: { in: 0.15, out: 0.6 } },
  { match: /^gpt-4o/i, rate: { in: 2.5, out: 10 } },
  { match: /^gpt-4/i, rate: { in: 10, out: 30 } },
  { match: /^gemini-.*flash/i, rate: { in: 0.1, out: 0.4 } },
  { match: /^gemini-.*pro/i, rate: { in: 1.25, out: 5 } },
  { match: /^text-embedding-3-small/i, rate: { in: 0.02, out: 0 } },
  { match: /^text-embedding/i, rate: { in: 0.1, out: 0 } },
];

const FALLBACK: Rate = { in: 0.5, out: 1.5 };

/** Estimated USD cost for a call (0 for mock / unknown free models). */
export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  if (!model || model === 'mock') return 0;
  const rate = RATES.find((r) => r.match.test(model))?.rate ?? FALLBACK;
  const cost = (promptTokens / 1_000_000) * rate.in + (completionTokens / 1_000_000) * rate.out;
  return Math.round(cost * 1e6) / 1e6; // 6dp
}

/** Rough token estimate when a provider reports no usage (mock path). ~4 chars/token. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text?.length ?? 0) / 4));
}
