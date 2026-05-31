import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class ResumeProjectBlock {
  @Prop({ required: true }) title!: string;
  @Prop({ type: [String], default: [] }) bullets!: string[];
}
const ResumeProjectBlockSchema =
  SchemaFactory.createForClass(ResumeProjectBlock);

export type ResumeDocument = HydratedDocument<Resume>;

/** Phase 9 · A resume generated from verified Skill Passport evidence; editable, exportable. */
@Schema({ timestamps: true, collection: 'resumes' })
export class Resume {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  user!: Types.ObjectId;

  @Prop({ default: '' }) headline!: string;
  @Prop({ default: '' }) summary!: string;
  @Prop({ type: [String], default: [] }) skills!: string[];
  @Prop({ type: [String], default: [] }) highlights!: string[];
  @Prop({ type: [ResumeProjectBlockSchema], default: [] })
  projects!: ResumeProjectBlock[];
  @Prop() generatedAt?: Date;
}

export const ResumeSchema = SchemaFactory.createForClass(Resume);
