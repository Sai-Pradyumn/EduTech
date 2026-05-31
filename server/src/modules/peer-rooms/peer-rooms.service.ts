import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { AgentType, Role } from '../../common/enums';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { FlowsService } from '../flows/flows.service';
import { PeerRoom, PeerRoomDocument } from './schemas/peer-room.schema';
import { CreateRoomDto } from './dto/peer-room.dto';

@Injectable()
export class PeerRoomsService {
  constructor(
    @InjectModel(PeerRoom.name) private readonly model: Model<PeerRoomDocument>,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly flows: FlowsService,
  ) {}

  private nameFor(email: string): string {
    return email.split('@')[0].replace(/[._]/g, ' ');
  }

  async create(
    userId: string,
    email: string,
    dto: CreateRoomDto,
  ): Promise<PeerRoomDocument> {
    const code = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const name = this.nameFor(email);
    return this.model.create({
      host: new Types.ObjectId(userId),
      title: dto.title.trim(),
      topic: dto.topic.trim(),
      code,
      members: [
        {
          user: new Types.ObjectId(userId),
          name,
          role: 'host',
          joinedAt: new Date(),
        },
      ],
      messages: [
        {
          id: this.mid(),
          name: 'Asta',
          kind: 'system',
          text: `Room created for "${dto.topic.trim()}". Share code ${code} to invite peers.`,
          at: new Date(),
        },
      ],
      status: 'open',
    });
  }

  /** Rooms the user is a member of, plus other open rooms for discovery. */
  async list(userId: string): Promise<PeerRoomDocument[]> {
    const oid = new Types.ObjectId(userId);
    return this.model
      .find({ $or: [{ 'members.user': oid }, { status: 'open' }] })
      .sort({ updatedAt: -1 })
      .limit(50)
      .exec();
  }

  async get(userId: string, id: string): Promise<PeerRoomDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Room not found');
    const r = await this.model.findById(id).exec();
    if (!r) throw new NotFoundException('Room not found');
    const isMember = r.members.some((m) => m.user.toString() === userId);
    if (!isMember && r.status !== 'open')
      throw new ForbiddenException('This room is closed.');
    return r;
  }

  async joinByCode(
    userId: string,
    email: string,
    role: Role,
    code: string,
  ): Promise<PeerRoomDocument> {
    const r = await this.model.findOne({ code: code.toUpperCase() }).exec();
    if (!r) throw new NotFoundException('No room with that code');
    return this.addMember(r, userId, email, role);
  }

  async join(
    userId: string,
    email: string,
    role: Role,
    id: string,
  ): Promise<PeerRoomDocument> {
    const r = await this.get(userId, id);
    return this.addMember(r, userId, email, role);
  }

  private async addMember(
    r: PeerRoomDocument,
    userId: string,
    email: string,
    role: Role,
  ): Promise<PeerRoomDocument> {
    if (r.status === 'closed')
      throw new ForbiddenException('This room is closed.');
    if (!r.members.some((m) => m.user.toString() === userId)) {
      const name = this.nameFor(email);
      r.members.push({
        user: new Types.ObjectId(userId),
        name,
        role: role === Role.Mentor ? 'mentor' : 'member',
        joinedAt: new Date(),
      });
      r.messages.push({
        id: this.mid(),
        name: 'Asta',
        kind: 'system',
        text: `${name} joined the room.`,
        at: new Date(),
      });
      r.markModified('members');
      r.markModified('messages');
      await r.save();
    }
    return r;
  }

  async postMessage(
    userId: string,
    email: string,
    id: string,
    text: string,
  ): Promise<PeerRoomDocument> {
    const r = await this.requireMember(userId, id);
    r.messages.push({
      id: this.mid(),
      user: new Types.ObjectId(userId),
      name: this.nameFor(email),
      kind: 'chat',
      text: text.trim(),
      at: new Date(),
    });
    r.markModified('messages');
    return r.save();
  }

  /** AI moderator posts a guiding nudge based on the recent discussion. */
  async moderate(
    userId: string,
    id: string,
    role: Role,
  ): Promise<PeerRoomDocument> {
    const r = await this.requireMember(userId, id);
    const recent = r.messages
      .filter((m) => m.kind === 'chat')
      .slice(-8)
      .map((m) => `${m.name}: ${m.text}`)
      .join('\n');
    let text: string;
    try {
      const result = await this.orchestrator.handle({
        userId,
        role,
        message: `You are the AI moderator of a peer study room on "${r.topic}". Recent discussion:\n${recent || '(quiet so far)'}\n\nIn 2-3 sentences, nudge the group forward with a guiding question or a clarifying point. Spoken-friendly, no markdown.`,
        agentType: AgentType.Mentor,
        source: 'chat',
      });
      text = this.clean(result.response.answer);
    } catch {
      text = `Let's keep momentum on ${r.topic}. What's one thing each of you still finds confusing?`;
    }
    r.messages.push({
      id: this.mid(),
      name: 'AI Moderator',
      kind: 'ai',
      text,
      at: new Date(),
    });
    r.markModified('messages');
    return r.save();
  }

  async summarize(userId: string, id: string): Promise<PeerRoomDocument> {
    const r = await this.requireMember(userId, id);
    const chats = r.messages.filter((m) => m.kind === 'chat');
    r.summary = chats.length
      ? `Peer room on "${r.topic}" with ${r.members.length} member(s) and ${chats.length} message(s). Key threads: ${chats
          .slice(-5)
          .map((m) => m.text.slice(0, 60))
          .join('; ')}.`
      : `Peer room on "${r.topic}" — no discussion yet.`;
    r.actionItems = chats
      .slice(-4)
      .map((m) => `Follow up: ${m.text.slice(0, 70)}`);
    r.messages.push({
      id: this.mid(),
      name: 'Asta',
      kind: 'system',
      text: 'Room summary + action items generated.',
      at: new Date(),
    });
    r.markModified('messages');
    r.markModified('actionItems');
    return r.save();
  }

  /** Create a shared flow for the room's topic (visible via linkedFlowId). */
  async linkFlow(
    userId: string,
    id: string,
  ): Promise<{ room: PeerRoomDocument; flowId: string }> {
    const r = await this.requireMember(userId, id);
    const flow = await this.flows.generate(userId, {
      goal: `Learn ${r.topic}`,
    });
    r.linkedFlowId = String(flow._id);
    r.messages.push({
      id: this.mid(),
      name: 'Asta',
      kind: 'system',
      text: 'A shared learning flow was attached to this room.',
      at: new Date(),
    });
    r.markModified('messages');
    await r.save();
    return { room: r, flowId: String(flow._id) };
  }

  async close(userId: string, id: string): Promise<PeerRoomDocument> {
    const r = await this.get(userId, id);
    if (r.host.toString() !== userId)
      throw new ForbiddenException('Only the host can close the room.');
    r.status = 'closed';
    return r.save();
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const r = await this.model.findById(id).exec();
    if (!r) throw new NotFoundException('Room not found');
    if (r.host.toString() !== userId)
      throw new ForbiddenException('Only the host can delete the room.');
    await r.deleteOne();
    return { ok: true };
  }

  private async requireMember(
    userId: string,
    id: string,
  ): Promise<PeerRoomDocument> {
    const r = await this.get(userId, id);
    if (!r.members.some((m) => m.user.toString() === userId))
      throw new ForbiddenException('Join the room first.');
    if (r.status === 'closed')
      throw new ForbiddenException('This room is closed.');
    return r;
  }

  private mid(): string {
    return `msg_${randomUUID().slice(0, 8)}`;
  }
  private clean(md: string): string {
    return md
      .replace(/[#*_>`~|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }
}
