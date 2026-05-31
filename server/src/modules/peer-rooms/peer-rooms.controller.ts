import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { PeerRoomsService } from './peer-rooms.service';
import { PeerRoomDocument } from './schemas/peer-room.schema';
import {
  CreateRoomDto,
  JoinRoomDto,
  PostMessageDto,
} from './dto/peer-room.dto';

function toView(r: PeerRoomDocument, userId: string) {
  return {
    id: String(r._id),
    title: r.title,
    topic: r.topic,
    code: r.code,
    isHost: r.host.toString() === userId,
    isMember: r.members.some((m) => m.user.toString() === userId),
    members: r.members.map((m) => ({ name: m.name, role: m.role })),
    messages: r.messages.map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      text: m.text,
      at: m.at?.toISOString() ?? '',
      mine: m.user?.toString() === userId,
    })),
    status: r.status,
    linkedFlowId: r.linkedFlowId ?? null,
    summary: r.summary,
    actionItems: r.actionItems,
    createdAt:
      (r as PeerRoomDocument & { createdAt?: Date }).createdAt?.toISOString() ??
      '',
  };
}

@Controller('peer-rooms')
export class PeerRoomsController {
  constructor(
    private readonly rooms: PeerRoomsService,
    private readonly config: ConfigService,
  ) {}

  private assertEnabled(): void {
    if (
      this.config.get<{ peerRooms?: boolean }>('flags')?.peerRooms === false
    ) {
      throw new ForbiddenException(
        'Peer Rooms is disabled on this deployment.',
      );
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    this.assertEnabled();
    return toView(await this.rooms.create(user.id, user.email, dto), user.id);
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.rooms.list(user.id)).map((r) => toView(r, user.id));
  }

  @Post('join')
  async joinByCode(@CurrentUser() user: AuthUser, @Body() dto: JoinRoomDto) {
    this.assertEnabled();
    return toView(
      await this.rooms.joinByCode(user.id, user.email, user.role, dto.code),
      user.id,
    );
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.rooms.get(user.id, id), user.id);
  }

  @Post(':id/join')
  async join(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(
      await this.rooms.join(user.id, user.email, user.role, id),
      user.id,
    );
  }

  @Post(':id/messages')
  async message(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PostMessageDto,
  ) {
    return toView(
      await this.rooms.postMessage(user.id, user.email, id, dto.text),
      user.id,
    );
  }

  @Post(':id/moderate')
  async moderate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.rooms.moderate(user.id, id, user.role), user.id);
  }

  @Post(':id/summary')
  async summary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.rooms.summarize(user.id, id), user.id);
  }

  @Post(':id/link-flow')
  async linkFlow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { room, flowId } = await this.rooms.linkFlow(user.id, id);
    return { room: toView(room, user.id), flowId };
  }

  @Post(':id/close')
  async close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.rooms.close(user.id, id), user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rooms.remove(user.id, id);
  }
}
