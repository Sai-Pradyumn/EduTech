import { Injectable } from '@nestjs/common';
import { AgentType, INTENT_AGENT_MAP, Intent } from '../../../common/enums';

interface IntentRule {
  intent: Intent;
  keywords: string[];
}

/** Keyword-scored intent classifier (mock). Real providers can swap in
 *  generateStructuredOutput with an intent enum — same interface either way. */
const RULES: IntentRule[] = [
  { intent: Intent.RoadmapGeneration, keywords: ['roadmap', 'learning path', 'plan to learn', 'study plan for'] },
  { intent: Intent.QuizGeneration, keywords: ['quiz', 'test me', 'mcq', 'questions on', 'assessment'] },
  { intent: Intent.ProjectPlanning, keywords: ['project', 'build an app', 'build a', 'architecture for'] },
  { intent: Intent.DocumentQuestion, keywords: ['from my notes', 'document', 'pdf', 'uploaded', 'according to'] },
  { intent: Intent.CareerGuidance, keywords: ['career', 'resume', 'job', 'interview prep', 'placement', 'internship', 'skill gap', 'am i ready', 'how ready'] },
  { intent: Intent.MentorReview, keywords: ['review my progress', 'how am i doing', 'plan my week', 'am i on track', 'mentor'] },
  { intent: Intent.VoicePractice, keywords: ['speak', 'voice', 'pronounce', 'mock interview out loud'] },
  { intent: Intent.ContentGeneration, keywords: ['generate notes', 'make notes', 'study notes', 'flashcards', 'flash cards', 'cheat sheet', 'cheatsheet', 'study material', 'summarize this topic'] },
  { intent: Intent.DoubtSolving, keywords: ['error', 'bug', "doesn't work", "isn't working", 'not working', 'why is', 'fix this', 'stuck on', 'undefined', 'cannot read', 'is not a function', 'throws', 'exception', 'traceback', 'stack trace', 'cors', 'crash', 'failing'] },
  { intent: Intent.ConceptExplanation, keywords: ['explain', 'what is', 'how does', 'teach me', 'understand', 'difference between'] },
];

@Injectable()
export class AgentRouterService {
  classifyIntent(message: string, hint?: Intent): Intent {
    if (hint) return hint;
    const text = message.toLowerCase();
    let best: { intent: Intent; score: number } = { intent: Intent.GeneralChat, score: 0 };
    for (const rule of RULES) {
      const score = rule.keywords.reduce((s, kw) => s + (text.includes(kw) ? kw.length : 0), 0);
      if (score > best.score) best = { intent: rule.intent, score };
    }
    return best.score > 0 ? best.intent : Intent.ConceptExplanation;
  }

  selectAgent(intent: Intent): AgentType {
    return INTENT_AGENT_MAP[intent];
  }
}
