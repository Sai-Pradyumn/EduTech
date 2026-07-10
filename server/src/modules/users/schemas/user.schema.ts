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

  /** Session generation counter (§6 · session invalidation). Signed into tokens as `tv`;
   *  bumping it invalidates every outstanding refresh token ("log out all devices"). */
  @Prop({ default: 0 })
  tokenVersion!: number;

  /** Per-account brute-force throttle (SECURITY_IMPLEMENTATION.md §6 · AU-04). Reset to 0
   *  on any successful login; drives the exponential lockout in login-throttle.ts. */
  @Prop({ default: 0 })
  failedLoginAttempts!: number;

  /** When set and in the future, credential logins for this account are refused. Time-based
   *  and self-healing (never a permanent lock) so it can't be weaponised as an account DoS. */
  @Prop()
  loginLockedUntil?: Date;

  /* ── TOTP multi-factor auth (SECURITY_IMPLEMENTATION.md §6/§17 · AU-03) ──────────── */

  /** Whether TOTP MFA is active. Selected by default so login can decide to challenge. */
  @Prop({ default: false })
  mfaEnabled!: boolean;

  /** Base32 TOTP secret. select:false — never leaves the server except as the one-time
   *  provisioning URI during enrollment, over TLS, to the enrolling user. */
  @Prop({ select: false })
  mfaSecret?: string;

  /** bcrypt hashes of single-use recovery codes (shown once at activation). select:false. */
  @Prop({ type: [String], select: false })
  mfaRecoveryHashes?: string[];

  @Prop()
  mfaEnrolledAt?: Date;

  @Prop()
  lastActiveAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
