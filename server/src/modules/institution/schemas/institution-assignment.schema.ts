import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const ASSIGNMENT_KINDS = [
  'flow',
  'template',
  'roadmap',
  'course',
  'quiz',
  'project',
] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export type InstitutionAssignmentDocument =
  HydratedDocument<InstitutionAssignment>;

/**
 * A real, persisted class assignment — a mentor/admin hands a learning asset to
 * a cohort with an optional due date. Replaces the fire-and-forget announcement
 * so assignments can be listed, tracked, and surfaced on the cohort (INST-GAP-001).
 */
@Schema({ timestamps: true, collection: 'institution_assignments' })
export class InstitutionAssignment {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organization!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Cohort', required: true, index: true })
  cohort!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: String, enum: ASSIGNMENT_KINDS, required: true })
  kind!: AssignmentKind;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) note!: string;
  @Prop() dueAt?: Date;
}

export const InstitutionAssignmentSchema = SchemaFactory.createForClass(
  InstitutionAssignment,
);
InstitutionAssignmentSchema.index({ cohort: 1, createdAt: -1 });
