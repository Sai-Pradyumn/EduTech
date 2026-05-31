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
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { VoiceService } from './voice.service';
import {
  VOICE_MODES,
  VoiceMode,
  VoiceSessionDocument,
} from './schemas/voice-session.schema';

class VoiceAskDto {
  @IsString() @MinLength(1) @MaxLength(2000) transcript!: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsIn(['tutor', 'interview']) mode?: 'tutor' | 'interview';
}

class CreateSessionDto {
  @IsIn(VOICE_MODES) mode!: VoiceMode;
}

class TurnDto {
  @IsString() @MinLength(1) @MaxLength(2000) transcript!: string;
}

class PatchSessionDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
}

class EndSessionDto {
  @IsOptional() @IsNumber() durationMs?: number;
}

function toView(s: VoiceSessionDocument) {
  return {
    id: String(s._id),
    mode: s.mode,
    title: s.title,
    transcript: s.transcript.map((t) => ({
      role: t.role,
      text: t.text,
      at: t.at?.toISOString() ?? '',
    })),
    summary: s.summary,
    extractedActions: s.extractedActions,
    linkedFlowId: s.linkedFlowId ?? null,
    linkedQuizId: s.linkedQuizId ?? null,
    linkedRoadmapId: s.linkedRoadmapId ?? null,
    linkedProjectId: s.linkedProjectId ?? null,
    durationMs: s.durationMs,
    status: s.status,
    createdAt:
      (
        s as VoiceSessionDocument & { createdAt?: Date }
      ).createdAt?.toISOString() ?? '',
  };
}

/** Voice Room (Phase 8 · complete voice-native learning). Browser does mic STT + TTS; sessions persist. */
@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Get('status')
  status() {
    return this.voice.status();
  }

  // legacy single-shot (Ask Asta dock)
  @Post('ask')
  ask(@CurrentUser() user: AuthUser, @Body() dto: VoiceAskDto) {
    return this.voice.converse(
      user.id,
      user.role,
      dto.transcript,
      dto.sessionId,
      dto.mode ?? 'tutor',
    );
  }

  // ── sessions ──
  @Post('sessions')
  async createSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSessionDto,
  ) {
    return toView(await this.voice.createSession(user.id, dto.mode));
  }

  @Get('sessions')
  async list(@CurrentUser() user: AuthUser) {
    return (await this.voice.list(user.id)).map(toView);
  }

  @Get('sessions/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.voice.get(user.id, id));
  }

  @Post('sessions/:id/turn')
  turn(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TurnDto,
  ) {
    return this.voice.addTurn(user.id, user.role, id, dto.transcript);
  }

  @Patch('sessions/:id')
  async patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchSessionDto,
  ) {
    return toView(await this.voice.patch(user.id, id, dto));
  }

  @Post('sessions/:id/summarize')
  async summarize(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.voice.summarize(user.id, id));
  }

  @Post('sessions/:id/create-flow')
  async createFlow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { session, flowId } = await this.voice.createFlow(user.id, id);
    return { session: toView(session), flowId };
  }

  @Post('sessions/:id/create-quiz')
  async createQuiz(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { session, quizId } = await this.voice.createQuiz(user.id, id);
    return { session: toView(session), quizId };
  }

  @Post('sessions/:id/extract-notes')
  extractNotes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.voice.extractNotes(user.id, id);
  }

  @Post('sessions/:id/end')
  async end(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EndSessionDto,
  ) {
    return toView(await this.voice.end(user.id, id, dto.durationMs));
  }

  @Delete('sessions/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.voice.remove(user.id, id);
  }
}
