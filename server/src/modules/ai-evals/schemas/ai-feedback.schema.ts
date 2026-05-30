import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiFeedbackDocument = HydratedDocument<AiFeedback>;

@Schema({ timestamps: true })
export class AiFeedback {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AgentMessage', index: true })
  message?: Types.ObjectId;

  @Prop({ required: true, enum: ['up', 'down', 'too_hard', 'too_easy', 'incorrect'] })
  rating!: 'up' | 'down' | 'too_hard' | 'too_easy' | 'incorrect';

  @Prop({ default: '' })
  reason!: string;
}
export const AiFeedbackSchema = SchemaFactory.createForClass(AiFeedback);
