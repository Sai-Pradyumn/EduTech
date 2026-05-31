import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Permission } from '../../common/enums';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { OrgContext } from '../tenancy/rbac.types';
import { AuditService } from '../audit/audit.service';
import { OrgBrandingService } from './org-branding.service';

class BrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  logoUrl?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @IsHexColor()
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  certificateTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  publicName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  supportEmail?: string;
}

/** Org branding (Phase 10 · M15). Read is public (certificate/verification pages render it);
 *  writes require org management. */
@Controller()
export class OrgBrandingController {
  constructor(
    private readonly branding: OrgBrandingService,
    private readonly audit: AuditService,
  ) {}

  @Permissions(Permission.OrgManage)
  @Get('org/branding')
  get(@CurrentOrg() org: OrgContext) {
    return this.branding.get(org.organizationId ?? '');
  }

  @Permissions(Permission.OrgManage)
  @Patch('org/branding')
  async update(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: BrandingDto,
  ) {
    const result = await this.branding.update(org.organizationId ?? '', dto);
    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      orgId: org.organizationId ?? undefined,
      action: 'org_branding.update',
      targetType: 'org',
      targetId: org.organizationId ?? undefined,
      metadata: { fields: Object.keys(dto) },
    });
    return result;
  }

  /** Public branding for certificate/portfolio verification pages. */
  @Public()
  @Get('org/:orgId/branding/public')
  publicBranding(@Param('orgId') orgId: string) {
    return this.branding.get(orgId);
  }
}
