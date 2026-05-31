import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrgBranding, OrgBrandingSchema } from './schemas/org-branding.schema';
import { OrgBrandingController } from './org-branding.controller';
import { OrgBrandingService } from './org-branding.service';

/** Org white-label branding (Phase 10 · M15). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrgBranding.name, schema: OrgBrandingSchema },
    ]),
  ],
  controllers: [OrgBrandingController],
  providers: [OrgBrandingService],
  exports: [OrgBrandingService],
})
export class OrgBrandingModule {}
