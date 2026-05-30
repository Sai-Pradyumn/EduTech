import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrgType } from '../../../common/enums';

export type OrganizationDocument = HydratedDocument<Organization>;

@Schema({ _id: false })
export class OrgBranding {
  @Prop() logoUrl?: string;
  @Prop({ default: '#16a34a' }) primaryColor!: string;
  @Prop({ default: '' }) tagline!: string;
}
const OrgBrandingSchema = SchemaFactory.createForClass(OrgBranding);

@Schema({ timestamps: true, collection: 'organizations' })
export class Organization {
  @Prop({ required: true, trim: true })
  name!: string;

  /** URL-safe unique handle (e.g. "sreenidhi-college"). */
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  slug!: string;

  @Prop({ type: String, enum: OrgType, default: OrgType.College })
  type!: OrgType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: OrgBrandingSchema, default: () => ({}) })
  branding!: OrgBranding;

  /** Plan key — billing lands in B5; defaults everyone to "free". */
  @Prop({ default: 'free' })
  plan!: string;

  @Prop({ default: 'active' })
  status!: string;

  @Prop({ default: 0 })
  memberCount!: number;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
