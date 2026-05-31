import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { SkillTwinService } from './skill-twin.service';

@Controller('skill-twin')
export class SkillTwinController {
  constructor(private readonly twin: SkillTwinService) {}

  /** The live learner model — readiness, retention/burnout risk, mastery, misconceptions, next moves. */
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.twin.compute(user.id);
  }

  /** Clear the learner's mistake memory + flagged weak areas. */
  @Post('reset')
  reset(@CurrentUser() user: AuthUser) {
    return this.twin.resetMemory(user.id);
  }
}
