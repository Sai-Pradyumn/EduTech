import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrgBrandingDocument = HydratedDocument<OrgBranding>;

/** White-label branding for an organization (Phase 10 · M15). Token-based + subtle — it
 *  never overrides the Noir Cockpit shell, only certificate/public-page accents. */
@Schema({ timestamps: true, collection: 'org_branding' })
export class OrgBranding {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true })
  org!: Types.ObjectId;

  @Prop({ default: '' })
  logoUrl!: string;

  /** OKLCH/hex accent used on certificates + public verification pages only. */
  @Prop({ default: '' })
  accentColor!: string;

  @Prop({ default: 'default' })
  certificateTemplate!: string;

  @Prop({ default: '' })
  publicName!: string;

  @Prop({ default: '' })
  supportEmail!: string;

  /** Reserved for a future verified custom domain. */
  @Prop({ default: '' })
  customDomainPlaceholder!: string;
}

export const OrgBrandingSchema = SchemaFactory.createForClass(OrgBranding);
