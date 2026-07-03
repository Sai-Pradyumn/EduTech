import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChannelKind = 'discussion' | 'help' | 'showcase';
export type ThreadKind = 'discussion' | 'question' | 'showcase';

export type CommunityChannelDocument = HydratedDocument<CommunityChannel>;
export type CommunityThreadDocument = HydratedDocument<CommunityThread>;
export type CommunityReplyDocument = HydratedDocument<CommunityReply>;

/**
 * Community channel (Phase 4 · B9): an org-scoped discussion space. A few defaults
 * (General / Help / Showcase) are seeded lazily the first time a channel list is requested.
 */
@Schema({ timestamps: true, collection: 'community_channels' })
export class CommunityChannel {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organization!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({
    type: String,
    enum: ['discussion', 'help', 'showcase'],
    default: 'discussion',
  })
  kind!: ChannelKind;

  @Prop({ default: 0 })
  threadCount!: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}
export const CommunityChannelSchema =
  SchemaFactory.createForClass(CommunityChannel);
CommunityChannelSchema.index({ organization: 1, slug: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'community_threads' })
export class CommunityThread {
  @Prop({
    type: Types.ObjectId,
    ref: 'CommunityChannel',
    required: true,
    index: true,
  })
  channel!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organization!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author!: Types.ObjectId;

  @Prop({ default: '' })
  authorName!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  body!: string;

  @Prop({
    type: String,
    enum: ['discussion', 'question', 'showcase'],
    default: 'discussion',
  })
  kind!: ThreadKind;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  /** Optional Project Studio link for showcase threads. */
  @Prop({ type: Types.ObjectId, ref: 'Project' })
  project?: Types.ObjectId;

  @Prop({ default: '' })
  projectTitle!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  upvotes!: Types.ObjectId[];

  @Prop({ default: 0 })
  replyCount!: number;

  /** Questions only — whether an accepted answer exists. */
  @Prop({ default: false })
  resolved!: boolean;

  @Prop({ default: false })
  pinned!: boolean;
}
export const CommunityThreadSchema =
  SchemaFactory.createForClass(CommunityThread);
CommunityThreadSchema.index({ channel: 1, pinned: -1, updatedAt: -1 });

@Schema({ timestamps: true, collection: 'community_replies' })
export class CommunityReply {
  @Prop({
    type: Types.ObjectId,
    ref: 'CommunityThread',
    required: true,
    index: true,
  })
  thread!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author!: Types.ObjectId;

  @Prop({ default: '' })
  authorName!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  upvotes!: Types.ObjectId[];

  /** Marked as the accepted answer on a question thread. */
  @Prop({ default: false })
  isAnswer!: boolean;
}
export const CommunityReplySchema =
  SchemaFactory.createForClass(CommunityReply);
CommunityReplySchema.index({ thread: 1, isAnswer: -1, createdAt: 1 });

export type CommunityReportDocument = HydratedDocument<CommunityReport>;

/**
 * A member's flag on a thread or reply. Moderators (OrgManage) work the queue:
 * open reports surface in the community UI with jump-to-target and resolve.
 * The preview is a snapshot, so the queue stays meaningful even after the
 * offending content is deleted.
 */
@Schema({ timestamps: true, collection: 'community_reports' })
export class CommunityReport {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organization!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CommunityThread', required: true })
  thread!: Types.ObjectId;

  /** Set when the report targets a reply inside the thread. */
  @Prop({ type: Types.ObjectId, ref: 'CommunityReply' })
  reply?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter!: Types.ObjectId;

  @Prop({ default: '' }) reporterName!: string;
  @Prop({ default: '' }) reason!: string;
  @Prop({ default: '' }) threadTitle!: string;
  /** Snapshot of the reported content (survives target deletion). */
  @Prop({ default: '' }) preview!: string;

  @Prop({
    type: String,
    enum: ['open', 'resolved'],
    default: 'open',
    index: true,
  })
  status!: 'open' | 'resolved';

  createdAt?: Date;
}
export const CommunityReportSchema =
  SchemaFactory.createForClass(CommunityReport);
CommunityReportSchema.index({ organization: 1, status: 1, createdAt: -1 });
