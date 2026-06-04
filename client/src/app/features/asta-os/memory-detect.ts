import { AstaMemorySuggestion } from '../../core/models';

/** Tidy a captured fragment: trim, drop trailing punctuation, collapse spaces. */
function clean(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+$/, '')
    .trim();
}

type Detector = (msg: string) => AstaMemorySuggestion | null;

/**
 * Ordered, conservative detectors — the first match wins so the learner is never
 * shown more than one card per message. These are heuristics over what the learner
 * typed (not an LLM): Asta noticed a pattern and asks before saving anything.
 */
const DETECTORS: readonly Detector[] = [
  // time availability — "I only have 30 minutes daily"
  (m) => {
    const t = /\b(\d{1,3})\s*(minutes?|mins?|hours?|hrs?)\b(?:\s*(a day|daily|per day|each day|today))?/i.exec(m);
    if (!t) return null;
    const amount = `${t[1]} ${t[2].toLowerCase().startsWith('h') ? 'hours' : 'minutes'}`;
    const cadence = t[3] ? ' a day' : '';
    return { type: 'time_availability', value: clean(`${amount}${cadence}`), summary: `You have about ${amount}${cadence} to learn.` };
  },
  // interview target — "I have an interview next week"
  (m) => {
    const t = /\binterview\b.*?\b(today|tomorrow|next week|this week|in \d+ days?|on \w+)\b/i.exec(m);
    if (!t) return null;
    return { type: 'interview_target', value: clean(t[1]), summary: `You have an interview ${clean(t[1])}.` };
  },
  // exam target — "exam on Friday"
  (m) => {
    const t = /\bexam\b.*?\b(today|tomorrow|next week|this week|in \d+ days?|on \w+)\b/i.exec(m);
    if (!t) return null;
    return { type: 'exam_target', value: clean(t[1]), summary: `You have an exam ${clean(t[1])}.` };
  },
  // energy pattern — "I'm tired today"
  (m) => {
    const t = /\b(?:i'?m|i am|feeling|feel)\s+(tired|exhausted|burnt out|burned out|drained|low energy|low on energy)\b/i.exec(m);
    if (!t) return null;
    return { type: 'energy_pattern', value: clean(t[1]), summary: `You’re low on energy right now — Asta can keep it light.` };
  },
  // preferred modality — "I prefer visual explanations"
  (m) => {
    const t = /\b(?:prefer|like|learn best (?:with|by|through))\s+([a-z-]+)/i.exec(m);
    const modality = t ? t[1].toLowerCase() : '';
    if (!['visual', 'video', 'reading', 'text', 'practice', 'hands-on', 'audio', 'diagrams', 'examples'].includes(modality)) return null;
    return { type: 'preferred_modality', value: modality, summary: `You prefer ${modality} learning.` };
  },
  // weak area — "I'm weak in recursion"
  (m) => {
    const t = /\b(?:weak|struggle|struggling|bad|not good|terrible)\s+(?:at|in|with)\s+([a-z0-9 +#.-]{2,40})/i.exec(m);
    if (!t) return null;
    return { type: 'weak_area', value: clean(t[1]), summary: `You’re weak in ${clean(t[1])}.` };
  },
  // career goal — "I want to become a backend developer"
  (m) => {
    const t = /\b(?:want to become|become a|aiming to be|goal is to be|i want to be)\s+(?:an?\s+)?([a-z0-9 +#.-]{2,40})/i.exec(m);
    if (!t) return null;
    return { type: 'career_goal', value: clean(t[1]), summary: `You want to become a ${clean(t[1])}.` };
  },
  // learning goal — "I want to learn Java full stack"
  (m) => {
    const t = /\b(?:want to learn|trying to learn|want to master|learning|studying)\s+([a-z0-9 +#.-]{2,50})/i.exec(m);
    if (!t) return null;
    return { type: 'learning_goal', value: clean(t[1]), summary: `You want to learn ${clean(t[1])}.` };
  },
  // pace preference — "go slower"
  (m) => {
    const t = /\b(go slower|slow down|take it slow|go faster|speed up|too fast for me)\b/i.exec(m);
    if (!t) return null;
    const faster = /fast|speed/i.test(t[1]);
    return { type: 'pace_preference', value: faster ? 'faster' : 'slower', summary: `You’d like Asta to go ${faster ? 'faster' : 'slower'}.` };
  },
];

/** Returns at most one memory-worthy suggestion for the message, or null. */
export function detectMemory(message: string): AstaMemorySuggestion | null {
  const msg = message.trim();
  if (msg.length < 6) return null;
  for (const detect of DETECTORS) {
    const hit = detect(msg);
    if (hit && hit.value) return hit;
  }
  return null;
}
