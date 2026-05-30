import { Injectable } from '@angular/core';

export type VoiceCommandKind = 'navigate' | 'ask' | 'speak' | 'unknown';

export interface VoiceCommand {
  kind: VoiceCommandKind;
  /** Human-readable description of what will happen (shown in the overlay). */
  label: string;
  /** Destination for `navigate`. */
  route?: string;
  /** Question to forward to the Agent OS for `ask`. */
  question?: string;
  /** Immediate spoken/short response for `speak`, or a lead-in line before navigation. */
  say?: string;
  /**
   * Sensitive/destructive intent — must be confirmed before executing.
   * The router never resolves directly to a destructive API call; it routes the
   * user to the relevant screen after explicit confirmation (safety rule).
   */
  sensitive?: boolean;
}

interface NavRule {
  /** Keyword triggers (any match wins). Order matters: most specific first. */
  keywords: string[];
  route: string;
  label: string;
  say: string;
  /** Admins use a different route for the same intent. */
  adminRoute?: string;
}

const WAKE = /^\s*(hey\s+|ok\s+|okay\s+)?(ask\s+)?asta[,:\s]*/i;
const DESTRUCTIVE = /\b(delete|remove|reset|wipe|clear all|erase|cancel (my )?subscription|unenroll|deactivate|drop)\b/i;

/**
 * Resolves a raw speech transcript into a `VoiceCommand`. Pure and synchronous —
 * the overlay/service own side effects (navigation, AI calls, TTS). Strips the
 * wake phrase, flags destructive intents for confirmation, matches navigation by
 * keyword, recognises a handful of high-value learning intents, and otherwise
 * falls back to forwarding the utterance to the AI tutor.
 */
@Injectable({ providedIn: 'root' })
export class VoiceCommandRouterService {
  /** Navigation intents — keyword → route. Built once; cheap to scan. */
  private readonly navRules: NavRule[] = [
    { keywords: ['dashboard', 'home'], route: '/app/dashboard', adminRoute: '/admin', label: 'Open Dashboard', say: 'Opening your dashboard.' },
    { keywords: ['tutor', 'ai tutor'], route: '/app/tutor', label: 'Open AI Tutor', say: 'Opening the AI tutor.' },
    { keywords: ['mentor room', 'mentor'], route: '/app/mentor-room', label: 'Open Mentor Room', say: 'Opening the mentor room.' },
    { keywords: ['doubt', 'stuck', 'bug', 'error help'], route: '/app/doubt-solver', label: 'Open Doubt Solver', say: 'Opening the doubt solver.' },
    { keywords: ['career', 'interview', 'job'], route: '/app/career-coach', label: 'Open Career Coach', say: 'Opening the career coach.' },
    { keywords: ['notes', 'study notes', 'cheat sheet', 'flashcard'], route: '/app/content-studio', label: 'Open Study Notes', say: 'Opening study notes.' },
    { keywords: ['voice room'], route: '/app/voice-room', label: 'Open Voice Room', say: 'Opening the voice room.' },
    { keywords: ['workflow'], route: '/app/workflows', label: 'Open Workflows', say: 'Opening workflows.' },
    { keywords: ['create roadmap', 'generate roadmap', 'new roadmap', 'build a roadmap'], route: '/app/roadmap/generate', label: 'Generate a Roadmap', say: 'Let’s build a roadmap.' },
    { keywords: ['roadmap', 'learning path'], route: '/app/roadmap', label: 'Open Roadmaps', say: 'Opening your roadmaps.' },
    { keywords: ['flow', 'flows', 'flow studio', 'learning flow', 'learning graph'], route: '/app/flows', label: 'Open Flow Studio', say: 'Opening Flow Studio.' },
    { keywords: ['knowledge', 'documents', 'upload', 'sources'], route: '/app/knowledge', adminRoute: '/admin/documents', label: 'Open Knowledge Hub', say: 'Opening the knowledge hub.' },
    { keywords: ['generate a quiz', 'create a quiz', 'quiz me', 'quiz', 'assessment', 'test me'], route: '/app/quizzes', adminRoute: '/admin/assessments', label: 'Open Quiz Studio', say: 'Opening quiz studio.' },
    { keywords: ['project', 'kanban'], route: '/app/projects', label: 'Open Project Studio', say: 'Opening project studio.' },
    { keywords: ['weak area', 'weak areas', 'what should i focus', 'focus on', 'my progress', 'progress', 'learning intelligence', 'insights'], route: '/app/progress', adminRoute: '/admin/analytics', label: 'Open Learning Intelligence', say: 'Here’s your learning intelligence.' },
    { keywords: ['cohort'], route: '/app/cohorts', label: 'Open Cohorts', say: 'Opening cohorts.' },
    { keywords: ['live session', 'live'], route: '/app/live-sessions', label: 'Open Live Sessions', say: 'Opening live sessions.' },
    { keywords: ['community'], route: '/app/community', label: 'Open Community', say: 'Opening the community.' },
    { keywords: ['report'], route: '/app/reports', label: 'Open Reports', say: 'Opening reports.' },
    { keywords: ['certificate'], route: '/app/certificates', label: 'Open Certificates', say: 'Opening certificates.' },
    { keywords: ['billing', 'usage', 'invoice', 'plan'], route: '/app/billing', label: 'Open Billing', say: 'Opening billing.' },
    { keywords: ['profile', 'settings', 'account'], route: '/app/profile', label: 'Open Profile & Settings', say: 'Opening your profile.' },
    { keywords: ['students', 'student management'], route: '/admin/students', label: 'Open Students', say: 'Opening students.' },
    { keywords: ['analytics', 'ai analytics'], route: '/admin/analytics', adminRoute: '/admin/analytics', label: 'Open AI Analytics', say: 'Opening analytics.' },
    { keywords: ['fine tuning', 'fine-tuning'], route: '/admin/fine-tuning', label: 'Open Fine-Tuning Lab', say: 'Opening the fine-tuning lab.' },
  ];

  /** Strip the wake phrase ("hey asta", "ask asta", "asta") off the front. */
  stripWake(transcript: string): string {
    return transcript.replace(WAKE, '').trim();
  }

  /** True if the transcript begins with (or contains) the wake phrase. */
  hasWake(transcript: string): boolean {
    return WAKE.test(transcript) || /\basta\b/i.test(transcript);
  }

  resolve(rawTranscript: string, ctx: { isAdmin: boolean }): VoiceCommand {
    const transcript = this.stripWake(rawTranscript);
    const t = transcript.toLowerCase().trim();

    if (!t) {
      return { kind: 'unknown', label: 'Didn’t catch that', say: 'I didn’t catch that — try again.' };
    }

    // Destructive intents always go through confirmation and never auto-execute.
    if (DESTRUCTIVE.test(t)) {
      return {
        kind: 'speak',
        label: 'Sensitive action',
        sensitive: true,
        say: 'That’s a sensitive change, so I won’t do it from voice. Please confirm, and I’ll take you to the right screen to do it safely.',
      };
    }

    // Summarise the current page → forwarded to the tutor with page context.
    if (/\bsummari[sz]e\b/.test(t) && /(page|screen|this)/.test(t)) {
      return {
        kind: 'ask',
        label: 'Summarise this page',
        question: 'Summarise the page the student is currently viewing in 3 concise bullet points.',
        say: 'Summarising this page.',
      };
    }

    // Navigation intents.
    for (const rule of this.navRules) {
      if (rule.keywords.some((k) => t.includes(k))) {
        const route = ctx.isAdmin && rule.adminRoute ? rule.adminRoute : rule.route;
        return { kind: 'navigate', label: rule.label, route, say: rule.say };
      }
    }

    // Explicit "ask / explain / what is …" → tutor question (use the full phrase).
    return {
      kind: 'ask',
      label: 'Ask Asta',
      question: transcript,
      say: '',
    };
  }
}
