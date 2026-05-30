import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CohortStatus } from '../../../common/enums';

export type CohortDocument = HydratedDocument<Cohort>;

/** A pinned announcement within a cohort (mentor/admin → students). */
@Schema({ _id: false })
export class CohortAnnouncement {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  body!: string;

  @Prop({ default: '' })
  authorName!: string;

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;
}
export const CohortAnnouncementSchema = SchemaFactory.createForClass(CohortAnnouncement);

/**
 * Cohort (Phase 4 · B3): an org-scoped group of students guided by mentors toward a
 * shared roadmap goal over a timeline, with announcements + a leaderboard. Brings
 * `organization` scoping to learning data; the leaderboard reuses the LI engine.
 */
@Schema({ timestamps: true, collection: 'cohorts' })
export class Cohort {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organization!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  mentors!: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [], index: true })
  students!: Types.ObjectId[];

  /** Shared roadmap target for the cohort (e.g. "MERN Developer"). */
  @Prop({ default: '' })
  roadmapGoal!: string;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop({ type: String, enum: CohortStatus, default: CohortStatus.Draft })
  status!: CohortStatus;

  @Prop({ type: [CohortAnnouncementSchema], default: [] })
  announcements!: CohortAnnouncement[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const CohortSchema = SchemaFactory.createForClass(Cohort);
