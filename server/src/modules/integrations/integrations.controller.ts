import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
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

class AnnounceDto {
  @IsString()
  @MaxLength(40)
  provider!: string;

  @IsString()
  @MaxLength(2000)
  message!: string;
}

class CsvImportDto {
  @IsString()
  @MaxLength(1_000_000)
  csv!: string;
}

/** Integrations foundation (Phase 10 · M12). Webhook/manual/csv/export connectors are fully
 *  functional with no paid account; OAuth providers activate when their keys are configured. */
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly config: ConfigService,
  ) {}

  /** Begin Google Calendar OAuth — returns the consent URL the client redirects to. */
  @Get('google_calendar/oauth/start')
  googleCalendarStart(@CurrentUser() user: AuthUser) {
    return { authUrl: this.integrations.googleCalendarAuthUrl(user.id) };
  }

  /** OAuth callback (Google redirects here). Public: identity travels in the signed `state`. */
  @Public()
  @Get('google_calendar/callback')
  async googleCalendarCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const origin =
      this.config.get<string>('clientOrigin') ?? 'http://localhost:4200';
    try {
      await this.integrations.completeGoogleCalendar(code, state);
      res.redirect(`${origin}/app/integrations?calendar=connected`);
    } catch {
      res.redirect(`${origin}/app/integrations?calendar=error`);
    }
  }

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

  /** Post a message to a connected chat webhook (Slack/Discord). */
  @Post('announce')
  announce(@CurrentUser() user: AuthUser, @Body() dto: AnnounceDto) {
    return this.integrations.announce(user.id, dto.provider, dto.message);
  }

  /** Import a roster CSV for the LMS connector (name, email, role). */
  @Post('lms/import')
  importLms(@CurrentUser() user: AuthUser, @Body() dto: CsvImportDto) {
    return this.integrations.importLmsCsv(user.id, dto.csv);
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
