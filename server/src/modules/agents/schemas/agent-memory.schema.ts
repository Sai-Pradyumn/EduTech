import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MemoryKind =
  | 'fact'
  | 'preference'
  | 'weak_topic'
  | 'goal'
  | 'summary';

export type AgentMemoryDocument = HydratedDocument<AgentMemory>;

@Schema({ timestamps: true })
export class AgentMemory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['fact', 'preference', 'weak_topic', 'goal', 'summary'],
    index: true,
  })
  kind!: MemoryKind;

  @Prop({ required: true })
  content!: string;

  /** Higher = more relevant; used to rank retrieval. */
  @Prop({ default: 1 })
  weight!: number;

  @Prop({ default: 'system' })
  source!: string;
}
export const AgentMemorySchema = SchemaFactory.createForClass(AgentMemory);
