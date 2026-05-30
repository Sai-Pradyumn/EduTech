import { AIMessage } from '../interfaces/ai-provider.interface';

/** Splits the system prompt out of a message list (most chat APIs separate it). */
export function splitSystem(
  messages: AIMessage[],
  systemOverride?: string,
): { system: string; turns: AIMessage[] } {
  const systemParts: string[] = [];
  if (systemOverride) systemParts.push(systemOverride);
  const turns: AIMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else turns.push(m);
  }
  // A chat must start with a user turn; if it doesn't, prepend a neutral one.
  if (turns.length === 0 || turns[0].role !== 'user') {
    turns.unshift({ role: 'user', content: systemParts.length ? 'Continue.' : '...' });
  }
  return { system: systemParts.join('\n\n').trim(), turns };
}

/** Best-effort JSON extraction from a model response (handles ```json fences and prose). */
export function parseJsonLoose<T>(text: string): T {
  const trimmed = text.trim();
  // Strip code fences.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Fall back to the first balanced {...} or [...] block.
    const start = candidate.search(/[[{]/);
    if (start >= 0) {
      const open = candidate[start];
      const close = open === '{' ? '}' : ']';
      const end = candidate.lastIndexOf(close);
      if (end > start) {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      }
    }
    throw new Error('Provider did not return valid JSON.');
  }
}

/** A JSON-mode instruction appended to the system prompt for providers without tool-use. */
export function jsonSchemaInstruction(schema: Record<string, unknown>): string {
  return [
    'You MUST respond with a single valid JSON object and nothing else.',
    'Do not wrap it in markdown code fences. Do not add commentary.',
    'The JSON must conform to this JSON schema:',
    JSON.stringify(schema),
  ].join('\n');
}
