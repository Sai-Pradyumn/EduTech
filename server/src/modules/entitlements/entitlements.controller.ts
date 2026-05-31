import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { FeatureKey, FEATURE_KEYS } from '../billing/plans';
import { EntitlementsService } from './entitlements.service';

class FeatureDto {
  @IsIn(FEATURE_KEYS)
  featureKey!: FeatureKey;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;
}

/** Entitlement checks (Phase 10 · M1). The gate every paid/limited capability consults. */
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.entitlements.summary(user.id);
  }

  @Post('check')
  check(@CurrentUser() user: AuthUser, @Body() dto: FeatureDto) {
    return this.entitlements.check(user.id, dto.featureKey, dto.amount ?? 1);
  }

  @Post('consume')
  consume(@CurrentUser() user: AuthUser, @Body() dto: FeatureDto) {
    return this.entitlements.consume(
      user.id,
      dto.featureKey,
      dto.amount ?? 1,
      true,
    );
  }
}
