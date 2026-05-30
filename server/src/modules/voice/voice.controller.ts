import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { VoiceService } from './voice.service';

class VoiceAskDto {
  @IsString() @MinLength(1) @MaxLength(2000) transcript!: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsIn(['tutor', 'interview']) mode?: 'tutor' | 'interview';
}

/** Voice Room surface (Phase 3 · A5). Gated by ENABLE_REALTIME_VOICE in the service. */
@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Get('status')
  status() {
    return this.voice.status();
  }

  @Post('ask')
  ask(@CurrentUser() user: AuthUser, @Body() dto: VoiceAskDto) {
    return this.voice.converse(user.id, user.role, dto.transcript, dto.sessionId, dto.mode ?? 'tutor');
  }
}
