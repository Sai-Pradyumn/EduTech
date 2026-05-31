import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/interfaces';
import { AuditService } from '../audit/audit.service';
import { FeatureFlagsService } from './feature-flags.service';

class FlagPatchDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;

  @IsOptional()
  @IsArray()
  allowedPlans?: string[];
}

@Controller()
export class FeatureFlagsController {
  constructor(
    private readonly flags: FeatureFlagsService,
    private readonly audit: AuditService,
  ) {}

  /** Public flag map for the client shell. */
  @Public()
  @Get('feature-flags')
  publicFlags() {
    return this.flags.publicMap();
  }

  @Roles(Role.Admin)
  @Get('admin/feature-flags')
  adminFlags() {
    return this.flags.list();
  }

  @Roles(Role.Admin)
  @Patch('admin/feature-flags/:key')
  async setFlag(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body() dto: FlagPatchDto,
  ) {
    const result = await this.flags.set(key, dto, user.id);
    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'feature_flag.update',
      targetType: 'feature_flag',
      targetId: key,
      metadata: { ...dto },
    });
    return result;
  }
}
