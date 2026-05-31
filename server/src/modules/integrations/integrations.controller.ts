import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { IntegrationsService } from './integrations.service';

class ConnectDto {
  @IsString()
  @MaxLength(40)
  provider!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class ProviderDto {
  @IsString()
  @MaxLength(40)
  provider!: string;
}

/** Integrations foundation (Phase 10 · M12). Mock/manual/export connectors are local-safe;
 *  OAuth providers are placeholders. */
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.integrations.listForUser(user.id);
  }

  @Post('connect')
  connect(@CurrentUser() user: AuthUser, @Body() dto: ConnectDto) {
    return this.integrations.connect(user.id, dto.provider, dto.metadata ?? {});
  }

  @Post('disconnect')
  disconnect(@CurrentUser() user: AuthUser, @Body() dto: ProviderDto) {
    return this.integrations.disconnect(user.id, dto.provider);
  }

  @Post('sync')
  sync(@CurrentUser() user: AuthUser, @Body() dto: ProviderDto) {
    return this.integrations.sync(user.id, dto.provider);
  }

  /** Download the learner's plan as an .ics calendar file (raw — bypasses the JSON envelope). */
  @Get('calendar.ics')
  calendar(@Res() res: Response) {
    const today = new Date();
    const events = [0, 1, 2, 3, 4].map((d) => {
      const date = new Date(today.getTime() + d * 86400000);
      return {
        title: `Asta study block — day ${d + 1}`,
        date: date.toISOString(),
      };
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="asta-plan.ics"',
    );
    res.send(this.integrations.buildIcs(events));
  }
}
