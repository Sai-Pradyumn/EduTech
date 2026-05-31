import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  OrgBranding,
  OrgBrandingDocument,
} from './schemas/org-branding.schema';

export interface BrandingView {
  orgId: string;
  logoUrl: string;
  accentColor: string;
  certificateTemplate: string;
  publicName: string;
  supportEmail: string;
}

const EMPTY = (orgId: string): BrandingView => ({
  orgId,
  logoUrl: '',
  accentColor: '',
  certificateTemplate: 'default',
  publicName: '',
  supportEmail: '',
});

@Injectable()
export class OrgBrandingService {
  constructor(
    @InjectModel(OrgBranding.name)
    private readonly branding: Model<OrgBrandingDocument>,
  ) {}

  async get(orgId: string): Promise<BrandingView> {
    const doc = await this.branding
      .findOne({ org: new Types.ObjectId(orgId) })
      .lean<OrgBrandingDocument>()
      .exec();
    if (!doc) return EMPTY(orgId);
    return {
      orgId,
      logoUrl: doc.logoUrl,
      accentColor: doc.accentColor,
      certificateTemplate: doc.certificateTemplate,
      publicName: doc.publicName,
      supportEmail: doc.supportEmail,
    };
  }

  async update(
    orgId: string,
    patch: Partial<Omit<BrandingView, 'orgId'>>,
  ): Promise<BrandingView> {
    await this.branding
      .findOneAndUpdate(
        { org: new Types.ObjectId(orgId) },
        { $set: patch },
        { upsert: true, new: true },
      )
      .exec();
    return this.get(orgId);
  }
}
