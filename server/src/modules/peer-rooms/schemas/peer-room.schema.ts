import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const PEER_ROOM_STATUSES = ['open', 'closed'] as const;
export type PeerRoomStatus = (typeof PEER_ROOM_STATUSES)[number];

export const PEER_MESSAGE_KINDS = ['chat', 'system', 'ai'] as const;
export type PeerMessageKind = (typeof PEER_MESSAGE_KINDS)[number];

@Schema({ _id: false })
export class PeerMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, enum: ['host', 'member', 'mentor'], default: 'member' })
  role!: 'host' | 'member' | 'mentor';
  @Prop({ type: Date, default: () => new Date() }) joinedAt!: Date;
}
const PeerMemberSchema = SchemaFactory.createForClass(PeerMember);

@Schema({ _id: false })
export class PeerMessage {
  @Prop({ required: true }) id!: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) user?: Types.ObjectId;
  @Prop({ default: '' }) name!: string;
  @Prop({ type: String, enum: PEER_MESSAGE_KINDS, default: 'chat' })
  kind!: PeerMessageKind;
  @Prop({ required: true }) text!: string;
  @Prop({ type: Date, default: () => new Date() }) at!: Date;
}
const PeerMessageSchema = SchemaFactory.createForClass(PeerMessage);

export type PeerRoomDocument = HydratedDocument<PeerRoom>;

@Schema({ timestamps: true, collection: 'peer_rooms' })
export class PeerRoom {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  host!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  org?: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) topic!: string;
  /** Short join code. */
  @Prop({ required: true, index: true }) code!: string;

  @Prop({ type: [PeerMemberSchema], default: [] }) members!: PeerMember[];
  @Prop({ type: [PeerMessageSchema], default: [] }) messages!: PeerMessage[];

  @Prop({ type: String, enum: PEER_ROOM_STATUSES, default: 'open' })
  status!: PeerRoomStatus;

  @Prop() linkedFlowId?: string;
  @Prop({ default: '' }) summary!: string;
  @Prop({ type: [String], default: [] }) actionItems!: string[];
}

export const PeerRoomSchema = SchemaFactory.createForClass(PeerRoom);
PeerRoomSchema.index({ 'members.user': 1, updatedAt: -1 });
