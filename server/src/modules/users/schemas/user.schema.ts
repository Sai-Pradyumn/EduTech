import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrgRole, Role } from '../../../common/enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

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

  @Prop({ default: false })
  isOnboarded!: boolean;

  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop()
  lastActiveAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
