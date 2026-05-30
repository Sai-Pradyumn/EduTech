import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MentorNoteDocument = HydratedDocument<MentorNote>;

/** A private note a mentor keeps on a student. */
@Schema({ timestamps: true, collection: 'mentor_notes' })
export class MentorNote {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  mentor!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  student!: Types.ObjectId;

  @Prop({ required: true })
  content!: string;
}

export const MentorNoteSchema = SchemaFactory.createForClass(MentorNote);
MentorNoteSchema.index({ mentor: 1, student: 1, createdAt: -1 });
