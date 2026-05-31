import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType, Difficulty, Role } from '../../common/enums';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { FlowsService } from '../flows/flows.service';
import { AssessmentService } from '../assessment/services/assessment.service';
import {
  IVoiceProvider,
  SynthesisResult,
  VOICE_PROVIDER_TOKEN,
} from './voice.provider';
import {
  VoiceMode,
  VoiceSession,
  VoiceSessionDocument,
} from './schemas/voice-session.schema';

export interface VoiceTurnResult {
  sessionId: string;
  text: string;
  speak: SynthesisResult;
}

/** How each mode shapes the prompt + which agent answers. */
const MODE_CONFIG: Record<
  VoiceMode,
  { agent: AgentType; title: string; frame: (m: string) => string }
> = {
  tutor: {
    agent: AgentType.Tutor,
    title: 'Voice tutor',
    frame: (m) =>
      `${m}\n\nExplain clearly and end with one Socratic question to check understanding. Keep it spoken-friendly.`,
  },
  viva: {
    agent: AgentType.Tutor,
    title: 'Voice viva',
    frame: (m) =>
      `Oral viva. The learner said: "${m}". Briefly assess it, then ask the next viva question. Keep it short and spoken.`,
  },
  interview: {
    agent: AgentType.Career,
    title: 'Mock interview',
    frame: (m) =>
      `Mock interview. Candidate said: "${m}". Give one line of feedback, then ask one focused follow-up question.`,
  },
  doubt: {
    agent: AgentType.DoubtSolver,
    title: 'Voice doubt solver',
    frame: (m) =>
      `Quick doubt: "${m}". Give a hint first, then a concise answer. Spoken-friendly.`,
  },
  flow_builder: {
    agent: AgentType.Tutor,
    title: 'Voice flow builder',
    frame: (m) =>
      `The learner wants to learn: "${m}". Confirm the goal in one sentence and say you can turn it into a learning flow.`,
  },
  revision: {
    agent: AgentType.Tutor,
    title: 'Voice revision',
    frame: (m) =>
      `Revision recap of: "${m}". Give a crisp 3-point recap, spoken-friendly.`,
  },
  mentor: {
    agent: AgentType.Mentor,
    title: 'Voice mentor',
    frame: (m) =>
      `Mentor check-in: "${m}". Give motivation + one concrete next step.`,
  },
  project_review: {
    agent: AgentType.Mentor,
    title: 'Voice project review',
    frame: (m) =>
      `Project review. The learner described: "${m}". Give one strength and one improvement.`,
  },
};

@Injectable()
export class VoiceService {
  constructor(
    private readonly orchestrator: AgentOrchestratorService,
    private readonly config: ConfigService,
    @InjectModel(VoiceSession.name)
    private readonly sessions: Model<VoiceSessionDocument>,
    private readonly flows: FlowsService,
    private readonly assessment: AssessmentService,
    @Inject(VOICE_PROVIDER_TOKEN) private readonly provider: IVoiceProvider,
  ) {}

  /** Voice Room itself is on by default (browser STT/TTS); server-side realtime STT/TTS is separate. */
  get enabled(): boolean {
    return this.config.get<{ voice?: boolean }>('flags')?.voice !== false;
  }
  private get realtime(): boolean {
    return this.config.get<boolean>('flags.realtimeVoice') ?? false;
  }

  status(): {
    enabled: boolean;
    provider: string;
    serverStt: boolean;
    serverTts: boolean;
  } {
    return {
      enabled: this.enabled,
      provider: this.provider.name,
      serverStt: this.realtime,
      serverTts: this.realtime,
    };
  }

  private assertEnabled(): void {
    if (!this.enabled)
      throw new ForbiddenException(
        'Voice Room is disabled. Set ENABLE_VOICE=true to enable it.',
      );
  }

  // ───────────────────────── sessions ─────────────────────────

  async createSession(
    userId: string,
    mode: VoiceMode,
  ): Promise<VoiceSessionDocument> {
    this.assertEnabled();
    return this.sessions.create({
      user: new Types.ObjectId(userId),
      mode,
      title: MODE_CONFIG[mode].title,
      status: 'active',
    });
  }

  list(userId: string): Promise<VoiceSessionDocument[]> {
    return this.sessions
      .find({ user: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async get(userId: string, id: string): Promise<VoiceSessionDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Voice session not found');
    const s = await this.sessions.findById(id).exec();
    if (!s || s.user.toString() !== userId)
      throw new NotFoundException('Voice session not found');
    return s;
  }

  /** Append a spoken user turn, route it through the Agent OS by mode, persist + return the answer. */
  async addTurn(
    userId: string,
    role: Role,
    id: string,
    transcript: string,
  ): Promise<VoiceTurnResult> {
    this.assertEnabled();
    const session = await this.get(userId, id);
    const message = await this.provider.transcribe(transcript);
    session.transcript.push({ role: 'user', text: message, at: new Date() });
    if (session.transcript.length === 1) session.title = message.slice(0, 60);

    const cfg = MODE_CONFIG[session.mode];
    const result = await this.orchestrator.handle({
      userId,
      role,
      message: cfg.frame(message),
      agentType: cfg.agent,
      source: 'voice',
    });

    const text = this.forSpeech(result.response.answer);
    session.transcript.push({ role: 'assistant', text, at: new Date() });
    session.markModified('transcript');
    await session.save();
    return {
      sessionId: String(session._id),
      text,
      speak: await this.provider.synthesize(text),
    };
  }

  async patch(
    userId: string,
    id: string,
    body: { title?: string },
  ): Promise<VoiceSessionDocument> {
    const s = await this.get(userId, id);
    if (body.title !== undefined) s.title = body.title;
    return s.save();
  }

  async end(
    userId: string,
    id: string,
    durationMs?: number,
  ): Promise<VoiceSessionDocument> {
    const s = await this.get(userId, id);
    s.status = 'completed';
    if (typeof durationMs === 'number') s.durationMs = durationMs;
    if (!s.summary) this.applySummary(s);
    return s.save();
  }

  // ───────────────────────── derived artifacts ─────────────────────────

  async summarize(userId: string, id: string): Promise<VoiceSessionDocument> {
    const s = await this.get(userId, id);
    this.applySummary(s);
    return s.save();
  }

  private applySummary(s: VoiceSessionDocument): void {
    const userTurns = s.transcript
      .filter((t) => t.role === 'user')
      .map((t) => t.text);
    s.summary = userTurns.length
      ? `Voice ${s.mode} session covering: ${userTurns.slice(0, 5).join('; ')}.`
      : 'Empty voice session.';
    s.extractedActions = userTurns
      .slice(0, 5)
      .map((t) => `Follow up on: ${t.slice(0, 70)}`);
    s.markModified('extractedActions');
  }

  /** Turn the session goal into a learning flow (voice-to-flow). */
  async createFlow(
    userId: string,
    id: string,
  ): Promise<{ session: VoiceSessionDocument; flowId: string }> {
    const s = await this.get(userId, id);
    const goal = this.firstUserText(s) || s.title;
    const flow = await this.flows.generate(userId, { goal });
    s.linkedFlowId = String(flow._id);
    await s.save();
    return { session: s, flowId: String(flow._id) };
  }

  /** Turn the session topic into a quiz (voice-to-quiz). */
  async createQuiz(
    userId: string,
    id: string,
  ): Promise<{ session: VoiceSessionDocument; quizId: string }> {
    const s = await this.get(userId, id);
    const topic = (this.firstUserText(s) || s.title).slice(0, 110);
    const quiz = await this.assessment.generate(userId, {
      source: 'topic',
      topic,
      difficulty: Difficulty.Intermediate,
    });
    s.linkedQuizId = String(quiz._id);
    await s.save();
    return { session: s, quizId: String(quiz._id) };
  }

  /** Extract structured notes from the transcript (voice-to-notes). */
  async extractNotes(
    userId: string,
    id: string,
  ): Promise<{ notes: string; actions: string[] }> {
    const s = await this.get(userId, id);
    if (!s.summary) this.applySummary(s);
    const points = s.transcript
      .filter((t) => t.role === 'assistant')
      .map((t) => `- ${t.text.slice(0, 160)}`);
    const notes = `# Notes · ${s.title}\n\n${s.summary}\n\n## Key points\n${points.join('\n') || '- (none yet)'}`;
    await s.save();
    return { notes, actions: s.extractedActions };
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const s = await this.get(userId, id);
    await s.deleteOne();
    return { ok: true };
  }

  // ───────────────────────── legacy single-shot (kept for the Ask-Asta dock) ─────────────────────────

  async converse(
    userId: string,
    role: Role,
    transcript: string,
    sessionId?: string,
    mode: 'tutor' | 'interview' = 'tutor',
  ): Promise<VoiceTurnResult> {
    this.assertEnabled();
    const message = await this.provider.transcribe(transcript);
    const prompt =
      mode === 'interview'
        ? `Conduct a mock interview. Candidate said: "${message}". Ask one focused follow-up.`
        : message;
    const result = await this.orchestrator.handle({
      userId,
      role,
      message: prompt,
      sessionId,
      agentType: AgentType.Voice,
      source: 'voice',
    });
    const text = this.forSpeech(result.response.answer);
    return {
      sessionId: result.sessionId,
      text,
      speak: await this.provider.synthesize(text),
    };
  }

  private firstUserText(s: VoiceSessionDocument): string {
    return s.transcript.find((t) => t.role === 'user')?.text ?? '';
  }

  /** Strip markdown so the spoken output sounds natural. */
  private forSpeech(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, ' (code shown on screen) ')
      .replace(/[#*_>`~|]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);
  }
}
