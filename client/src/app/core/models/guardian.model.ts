/** Frontend mirror of the Cognitive Guardian verdict (server cognitive-guardian module). */

export type GuardianVerdictKind = 'solid' | 'careful' | 'uncertain';

export interface GuardianVerdict {
  verdict: GuardianVerdictKind;
  confidence: number; // 0–1
  concerns: string[];
  suggestion: string;
  hintFirst: boolean;
}
