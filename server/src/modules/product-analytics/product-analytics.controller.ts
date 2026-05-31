import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { ProductAnalyticsService } from './product-analytics.service';

class TrackDto {
  @IsString()
  @MaxLength(64)
  event!: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}

@Controller()
export class ProductAnalyticsController {
  constructor(private readonly analytics: ProductAnalyticsService) {}

  /** Client emits whitelisted product events here. */
  @Post('analytics/track')
  track(@CurrentUser() user: AuthUser, @Body() dto: TrackDto) {
    return this.analytics.track({
      event: dto.event,
      userId: user.id,
      properties: dto.properties,
      sessionId: dto.sessionId,
    });
  }

  @Roles(Role.Admin)
  @Get('admin/product-analytics/overview')
  overview(@Query('days') days?: string) {
    return this.analytics.overview(this.days(days));
  }

  @Roles(Role.Admin)
  @Get('admin/product-analytics/funnels')
  funnels(@Query('days') days?: string) {
    return this.analytics.funnels(this.days(days));
  }

  @Roles(Role.Admin)
  @Get('admin/product-analytics/retention')
  retention(@Query('days') days?: string) {
    return this.analytics.retention(this.days(days));
  }

  private days(raw?: string): number {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 365 ? n : 30;
  }
}
