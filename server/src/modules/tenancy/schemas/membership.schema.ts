import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MembershipStatus, OrgRole, Permission } from '../../../common/enums';

export type MembershipDocument = HydratedDocument<Membership>;

/** A user's role inside one organization (the m:n tenancy source of truth). */
@Schema({ timestamps: true, collection: 'memberships' })
export class Membership {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organization!: Types.ObjectId;

  @Prop({ type: String, enum: OrgRole, default: OrgRole.Student })
  orgRole!: OrgRole;

  /** Optional extra grants beyond the role's defaults. */
  @Prop({ type: [String], enum: Permission, default: [] })
  extraPermissions!: Permission[];

  @Prop({
    type: String,
    enum: MembershipStatus,
    default: MembershipStatus.Active,
  })
  status!: MembershipStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);
// One membership per (user, organization).
MembershipSchema.index({ user: 1, organization: 1 }, { unique: true });
