import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType, Intent } from '../../../common/enums';
import { AgentResponse } from '../../ai/types/agent.types';
import {
  AgentMessage,
  AgentMessageDocument,
  AgentSession,
  AgentSessionDocument,
} from '../schemas/agent-session.schema';

@Injectable()
export class AgentSessionService {
  constructor(
    @InjectModel(AgentSession.name) private readonly sessions: Model<AgentSessionDocument>,
    @InjectModel(AgentMessage.name) private readonly messages: Model<AgentMessageDocument>,
  ) {}

  async ensureSession(userId: string, sessionId?: string, source = 'chat'): Promise<AgentSessionDocument> {
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
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(50)
      .exec();
  }

  async getMessages(userId: string, sessionId: string): Promise<AgentMessageDocument[]> {
    if (!Types.ObjectId.isValid(sessionId)) return [];
    return this.messages
      .find({ session: sessionId, user: new Types.ObjectId(userId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async addUserMessage(userId: string, sessionId: string, content: string): Promise<AgentMessageDocument> {
    return this.messages.create({
      session: new Types.ObjectId(sessionId),
      user: new Types.ObjectId(userId),
      role: 'user',
      content,
    });
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
      { lastMessageAt: new Date(), agentType: response.agentType, ...(await this.maybeTitle(sessionId)) },
    );
    return msg;
  }

  /** Title the session from its first user message. */
  private async maybeTitle(sessionId: string): Promise<{ title?: string }> {
    const session = await this.sessions.findById(sessionId);
    if (session && session.title === 'New session') {
      const first = await this.messages
        .findOne({ session: sessionId, role: 'user' })
        .sort({ createdAt: 1 });
      if (first) return { title: first.content.slice(0, 60) };
    }
    return {};
  }

  setSessionAgent(sessionId: string, agentType: AgentType, intent: Intent): Promise<unknown> {
    return this.sessions.updateOne({ _id: sessionId }, { agentType }).exec().then(() => intent);
  }
}
