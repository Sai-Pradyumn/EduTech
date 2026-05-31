import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/interfaces';
import { SkillPassportService } from './skill-passport.service';
import { AddEvidenceDto, UpdatePassportDto } from './dto/skill-passport.dto';
import { SkillEvidenceDocument } from './schemas/skill-evidence.schema';

function evidenceView(e: SkillEvidenceDocument) {
  return {
    id: String(e._id),
    skill: e.skill,
    sourceType: e.sourceType,
    summary: e.summary,
    score: e.score ?? null,
    url: e.url ?? null,
    verificationLevel: e.verificationLevel,
    visibleOnPassport: e.visibleOnPassport,
  };
}

@Controller('skill-passport')
export class SkillPassportController {
  constructor(private readonly passport: SkillPassportService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.passport.getMe(user.id);
  }

  @Patch('me')
  patch(@CurrentUser() user: AuthUser, @Body() dto: UpdatePassportDto) {
    return this.passport.patchMe(user.id, dto);
  }

  @Post('recompute')
  recompute(@CurrentUser() user: AuthUser) {
    return this.passport.recompute(user.id);
  }

  @Post('publish')
  publish(@CurrentUser() user: AuthUser) {
    return this.passport.setVisibility(user.id, 'public');
  }

  @Post('unpublish')
  unpublish(@CurrentUser() user: AuthUser) {
    return this.passport.setVisibility(user.id, 'private');
  }

  @Get('evidence')
  async evidence(@CurrentUser() user: AuthUser) {
    return (await this.passport.listEvidence(user.id)).map(evidenceView);
  }

  @Post('add-evidence')
  async addEvidence(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddEvidenceDto,
  ) {
    return evidenceView(await this.passport.addEvidence(user.id, dto));
  }

  /** Project Review 2.0 — promote a reviewed project into verified passport evidence. */
  @Post('from-project/:projectId')
  async fromProject(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return evidenceView(await this.passport.addProjectEvidence(user.id, projectId));
  }

  @Delete('evidence/:id')
  removeEvidence(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.passport.removeEvidence(user.id, id);
  }

  /** Public, unauthenticated profile (honors visibility + per-section privacy). */
  @Public()
  @Get('public/:username')
  publicProfile(@Param('username') username: string) {
    return this.passport.getPublicByUsername(username);
  }
}
