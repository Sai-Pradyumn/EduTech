import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { FlowsModule } from '../flows/flows.module';
import { PeerRoom, PeerRoomSchema } from './schemas/peer-room.schema';
import { PeerRoomsController } from './peer-rooms.controller';
import { PeerRoomsService } from './peer-rooms.service';

/**
 * Phase 8 · Peer Rooms — collaborative study rooms (join by code, shared message board, an AI
 * moderator that nudges the group, room summary + action items, and a shared learning flow).
 * Reuses the Agent OS for moderation and Flows for the shared flow.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: PeerRoom.name, schema: PeerRoomSchema }]),
    AgentsModule,
    FlowsModule,
  ],
  controllers: [PeerRoomsController],
  providers: [PeerRoomsService],
  exports: [PeerRoomsService],
})
export class PeerRoomsModule {}
