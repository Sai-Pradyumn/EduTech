import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/interfaces';
import { PushService } from './push.service';

class SubscribeDto {
  @IsString()
  @MaxLength(512)
  endpoint!: string;

  @IsObject()
  keys!: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  userAgent?: string;
}

class UnsubscribeDto {
  @IsString()
  @MaxLength(512)
  endpoint!: string;
}

/** Web Push subscription management (Phase 10 · M4/M5). */
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Public()
  @Get('vapid-public-key')
  vapidKey() {
    return this.push.vapidPublicKey();
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.push.subscribe(user.id, dto);
  }

  @Delete('subscribe')
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(user.id, dto.endpoint);
  }
}
