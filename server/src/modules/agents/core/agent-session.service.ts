import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType, Intent } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { AgentResponse } from '../../ai/types/agent.types';
import {
  AgentMessage,
  AgentMessageDocument,
  AgentSession,
  AgentSessionDocument,
} from '../schemas/agent-session.schema';

const RECENT_WINDOW = 8; // turns kept verbatim; older turns roll into the summary
const SUMMARIZE_AT = 16; // only summarize once a session grows past this many messages

/** One cross-session search hit: the best (newest) match within a session. */
export interface SessionSearchHit {
  sessionId: string;
  title: string;
  agentType: string;
  when: string;
  /** Matching excerpt from a message; empty when only the title matched. */
  snippet: string;
}

@Injectable()
export class AgentSessionService {
  private readonly logger = new Logger(AgentSessionService.name);

  constructor(
    @InjectModel(AgentSession.name)
    private readonly sessions: Model<AgentSessionDocument>,
    @InjectModel(AgentMessage.name)
    private readonly messages: Model<AgentMessageDocument>,
    private readonly ai: AiService,
  ) {}

  /**
   * Roll older turns into a rolling LLM summary so long chats stay coherent without a huge
   * prompt. Fire-and-forget after a turn; no-op offline or under the threshold.
   */
  async maybeSummarize(userId: string, sessionId: string): Promise<void> {
    if (!this.ai.isLive || !Types.ObjectId.isValid(sessionId)) return;
    try {
      const count = await this.messages.countDocuments({
        session: sessionId,
        user: new Types.ObjectId(userId),
      });
      if (count <= SUMMARIZE_AT) return;
      const older = await this.messages
        .find({ session: sessionId, user: new Types.ObjectId(userId) })
        .sort({ createdAt: 1 })
        .limit(count - RECENT_WINDOW)
        .exec();
      const transcript = older
        .map(
          (m) =>
            `${m.role === 'assistant' ? 'Asta' : 'Student'}: ${m.content.slice(0, 600)}`,
        )
        .join('\n');
      const summary = await this.ai.generateText(
        [
          {
            role: 'system',
            content:
              'Summarize this tutoring conversation in 4-6 sentences: topics covered, the student’s understanding/struggles, and any decisions. Be specific and concise.',
          },
          { role: 'user', content: transcript },
        ],
        {
          temperature: 0.2,
          maxTokens: 320,
          meta: {
            userId,
            agentType: AgentType.Tutor,
            operation: 'session.summary',
          },
        },
      );
      if (summary.trim()) {
        await this.sessions
          .updateOne(
            { _id: sessionId },
            { $set: { summary: summary.trim().slice(0, 1500) } },
          )
          .exec();
      }
    } catch (err) {
      this.logger.warn(
        `Session summarization failed: ${(err as Error).message}`,
      );
    }
  }

  async ensureSession(
    userId: string,
    sessionId?: string,
    source = 'chat',
  ): Promise<AgentSessionDocument> {
    if (sessionId && Types.ObjectId.isValid(sessionId)) {
      const existing = await this.sessions.findOne({
        _id: sessionId,
        user: new Types.ObjectId(userId),
      });
      if (existing) return existing;
    }
    return this.sessions.create({ user: new Types.ObjectId(userId), source });
  }

  listSessions(userId: string): Promise<AgentSessionDocument[]> {
    return this.sessions
      .find({ user: new Types.ObjectId(userId) })
      .sort({ pinned: -1, lastMessageAt: -1, updatedAt: -1 })
      .limit(50)
      .exec();
  }

  /** Pin/unpin a session (pinned sessions lead every history list). */
  async setPinned(
    userId: string,
    sessionId: string,
    pinned: boolean,
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(sessionId)) return false;
    const res = await this.sessions
      .updateOne(
        { _id: sessionId, user: new Types.ObjectId(userId) },
        { $set: { pinned } },
      )
      .exec();
    return res.matchedCount > 0;
  }

  /**
   * Search across ALL of a user's sessions — titles and message content.
   * Returns at most 20 sessions, newest hit first, one snippet per session.
   */
  async searchSessions(
    userId: string,
    query: string,
  ): Promise<SessionSearchHit[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const uid = new Types.ObjectId(userId);
    const [msgs, titled] = await Promise.all([
      this.messages
        .find({ user: uid, content: rx })
        .sort({ createdAt: -1 })
        .limit(80)
        .lean()
        .exec(),
      this.sessions
        .find({ user: uid, title: rx })
        .sort({ lastMessageAt: -1 })
        .limit(10)
        .lean()
        .exec(),
    ]);

    const bySession = new Map<string, { snippet: string; when?: Date }>();
    for (const m of msgs) {
      const key = String(m.session);
      if (bySession.has(key)) continue; // newest hit per session wins
      const text = m.content;
      const at = text.toLowerCase().indexOf(q.toLowerCase());
      const from = at >= 0 ? Math.max(0, at - 40) : 0;
      const to = at >= 0 ? at + q.length + 60 : 100;
      const snippet = `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`;
      bySession.set(key, {
        snippet,
        when: (m as { createdAt?: Date }).createdAt,
      });
    }
    for (const s of titled) {
      const key = String(s._id);
      if (!bySession.has(key)) {
        bySession.set(key, { snippet: '', when: s.lastMessageAt });
      }
    }

    const ids = [...bySession.keys()].slice(0, 20);
    if (ids.length === 0) return [];
    const sess = await this.sessions
      .find({ _id: { $in: ids }, user: uid })
      .lean()
      .exec();
    const byId = new Map(sess.map((s) => [String(s._id), s]));
    return ids.flatMap((id) => {
      const s = byId.get(id);
      if (!s) return [];
      const hit = bySession.get(id);
      return [
        {
          sessionId: id,
          title: s.title || 'Untitled session',
          agentType: String(s.agentType),
          when: (hit?.when ?? s.lastMessageAt)?.toISOString() ?? '',
          snippet: hit?.snippet ?? '',
        },
      ];
    });
  }

  async getMessages(
    userId: string,
    sessionId: string,
  ): Promise<AgentMessageDocument[]> {
    if (!Types.ObjectId.isValid(sessionId)) return [];
    return this.messages
      .find({ session: sessionId, user: new Types.ObjectId(userId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  /**
   * Recent turns as {role, content} for multi-turn coherence — so a live LLM remembers
   * the conversation, not just the current message. Newest `limit`, chronological order;
   * long answers truncated to keep the prompt lean.
   */
  async recentHistory(
    userId: string,
    sessionId: string,
    limit = 8,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    if (!Types.ObjectId.isValid(sessionId)) return [];
    const docs = await this.messages
      .find({ session: sessionId, user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return docs.reverse().map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content:
        m.content.length > 1500 ? `${m.content.slice(0, 1500)}…` : m.content,
    }));
  }

  async addUserMessage(
    userId: string,
    sessionId: string,
    content: string,
  ): Promise<AgentMessageDocument> {
    const msg = await this.messages.create({
      session: new Types.ObjectId(sessionId),
      user: new Types.ObjectId(userId),
      role: 'user',
      content,
    });
    // Title + order the session from the FIRST user message immediately — so a
    // session is named even if the agent fails before it can reply (was left as
    // "New session" until the assistant message saved).
    await this.sessions.updateOne(
      { _id: sessionId },
      { lastMessageAt: new Date(), ...(await this.maybeTitle(sessionId)) },
    );
    return msg;
  }

  async addAssistantMessage(
    userId: string,
    sessionId: string,
    response: AgentResponse,
  ): Promise<AgentMessageDocument> {
    const msg = await this.messages.create({
      session: new Types.ObjectId(sessionId),
      user: new Types.ObjectId(userId),
      role: 'assistant',
      agentType: response.agentType,
      intent: response.intent,
      content: response.answer,
      visualBlocks: response.visualBlocks,
      actions: response.actions,
      sources: response.sources ?? [],
      followUpQuestions: response.followUpQuestions,
      recommendedNextActions: response.recommendedNextActions,
      confidence: response.confidence,
    });
    await this.sessions.updateOne(
      { _id: sessionId },
      {
        lastMessageAt: new Date(),
        agentType: response.agentType,
        ...(await this.maybeTitle(sessionId)),
      },
    );
    return msg;
  }

  /** Title the session from its first user message (with deterministic cleanup). */
  private async maybeTitle(sessionId: string): Promise<{ title?: string }> {
    const session = await this.sessions.findById(sessionId);
    if (session && session.title === 'New session') {
      const first = await this.messages
        .findOne({ session: sessionId, role: 'user' })
        .sort({ createdAt: 1 });
      if (first) return { title: this.deriveTitle(first.content) };
    }
    return {};
  }

  /**
   * Turn a raw first-message into a readable, semantic session title: strip
   * politeness + leading imperatives ("add", "create", "explain"…) and trailing
   * "…to the roadmap screen" destinations so the title is the SUBJECT, sentence-case
   * it, and truncate at a word boundary. "Add system design roadmap to the roadmap
   * screen" → "System design roadmap".
   */
  private deriveTitle(raw: string): string {
    let t = raw.trim().replace(/\s+/g, ' ');
    t = t.replace(
      /^(hey\s+asta[,\s]+|asta[,\s]+|please\s+|can you\s+|could you\s+|i want to\s+|i'd like to\s+)/i,
      '',
    );
    t = t.replace(
      /^(add|create|make|generate|build|give me|show me|help me(?: with)?|explain|teach me(?: about)?|tell me about|update|set up|set)\s+/i,
      '',
    );
    t = t.replace(
      /\s+(?:to|on|in|for)\s+(?:the\s+)?[\w\s-]{1,30}\s+(?:screen|page|section|tab|view)\b.*$/i,
      '',
    );
    t = t.trim();
    if (!t) t = raw.trim();
    const capped = t.charAt(0).toUpperCase() + t.slice(1);
    if (capped.length <= 60) return capped;
    const cut = capped.slice(0, 60);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }

  setSessionAgent(
    sessionId: string,
    agentType: AgentType,
    intent: Intent,
  ): Promise<unknown> {
    return this.sessions
      .updateOne({ _id: sessionId }, { agentType })
      .exec()
      .then(() => intent);
  }
}
