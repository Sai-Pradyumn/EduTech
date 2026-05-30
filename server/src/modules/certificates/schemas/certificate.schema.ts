import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CertificateDocument = HydratedDocument<Certificate>;

/**
 * Certificate / credential (Phase 4 · B7). Issued by a mentor/instructor/admin to a
 * student for a verified skill, score or completed project. Publicly verifiable by
 * `verificationId`. PDF generation + LinkedIn share land later.
 */
@Schema({ timestamps: true, collection: 'certificates' })
export class Certificate {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  skill!: string;

  @Prop({ default: 0 })
  score!: number;

  @Prop({ type: Types.ObjectId, ref: 'Project' })
  project?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organization?: Types.ObjectId;

  @Prop({ default: '' })
  issuerName!: string;

  @Prop({ required: true, unique: true, index: true })
  verificationId!: string;

  @Prop({ default: false })
  revoked!: boolean;
}

export const CertificateSchema = SchemaFactory.createForClass(Certificate);
