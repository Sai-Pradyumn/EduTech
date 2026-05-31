import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Permission } from '../../common/enums';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { OrgContext } from '../tenancy/rbac.types';
import { AuditService } from '../audit/audit.service';
import { DeveloperService, WEBHOOK_EVENTS } from './developer.service';

class CreateKeyDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  scopes?: string[];
}

class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @ArrayMaxSize(20)
  events!: string[];
}

class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsArray()
  events?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Developer platform (Phase 10 · M11). Org-scoped API keys + webhooks. OrgManage only. */
@Permissions(Permission.OrgManage)
@Controller('developer')
export class DeveloperController {
  constructor(
    private readonly dev: DeveloperService,
    private readonly audit: AuditService,
  ) {}

  @Get('events')
  events() {
    return WEBHOOK_EVENTS;
  }

  // ── API keys ──
  @Get('api-keys')
  listKeys(@CurrentOrg() org: OrgContext) {
    return this.dev.listKeys(org.organizationId ?? '');
  }

  @Post('api-keys')
  async createKey(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateKeyDto,
  ) {
    const result = await this.dev.createKey(
      org.organizationId ?? '',
      dto.name,
      dto.scopes ?? [],
      user.id,
    );
    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      orgId: org.organizationId ?? undefined,
      action: 'api_key.created',
      targetType: 'api_key',
      targetId: result.id,
      metadata: { name: dto.name },
    });
    return result;
  }

  @Delete('api-keys/:id')
  async revokeKey(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const result = await this.dev.revokeKey(org.organizationId ?? '', id);
    await this.audit.record({
      actorId: user.id,
      orgId: org.organizationId ?? undefined,
      action: 'api_key.revoked',
      targetType: 'api_key',
      targetId: id,
    });
    return result;
  }

  // ── webhooks ──
  @Get('webhooks')
  listWebhooks(@CurrentOrg() org: OrgContext) {
    return this.dev.listWebhooks(org.organizationId ?? '');
  }

  @Post('webhooks')
  createWebhook(@CurrentOrg() org: OrgContext, @Body() dto: CreateWebhookDto) {
    return this.dev.createWebhook(
      org.organizationId ?? '',
      dto.url,
      dto.events,
    );
  }

  @Patch('webhooks/:id')
  updateWebhook(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.dev.updateWebhook(org.organizationId ?? '', id, dto);
  }

  @Delete('webhooks/:id')
  deleteWebhook(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.dev.deleteWebhook(org.organizationId ?? '', id);
  }

  @Post('webhooks/:id/test')
  testWebhook(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.dev.testWebhook(org.organizationId ?? '', id);
  }

  @Get('webhook-deliveries')
  deliveries(@CurrentOrg() org: OrgContext) {
    return this.dev.listDeliveries(org.organizationId ?? '');
  }
}
