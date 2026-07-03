import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrgRole, Role } from '../../../common/enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email!: string;

  /** Optional: OAuth-only accounts (Google) have no password. */
  @Prop({ select: false })
  passwordHash?: string;

  /** Google OAuth subject id (set when the account is linked to Google). */
  @Prop({ index: true })
  googleId?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: Role, default: Role.Student, index: true })
  role!: Role;

  /** Platform-wide RBAC role (super_admin / platform_admin) — acts across all orgs.
   *  Optional & additive: normal users have none and are scoped by org memberships. */
  @Prop({ type: String, enum: OrgRole })
  platformRole?: OrgRole;

  /** The user's default/active organization (multi-org users switch via x-org-id). */
  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  primaryOrganization?: Types.ObjectId;

  /** Email-OTP verification. New email signups start false until they verify; Google logins
   *  are true (Google verified the address). Login treats `!== false` as OK so pre-existing
   *  accounts (no field) are never locked out. */
  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ default: false })
  isOnboarded!: boolean;

  /** Show me on cohort peer leaderboards (opt-in; hidden by default). */
  @Prop({ default: false })
  leaderboardOptIn!: boolean;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop()
  lastActiveAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
