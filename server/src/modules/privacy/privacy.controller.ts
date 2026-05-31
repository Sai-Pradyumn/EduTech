import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { PrivacyService } from './privacy.service';

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('settings')
  settings(@CurrentUser() user: AuthUser) {
    return this.privacy.settings(user.id);
  }

  @Get('export')
  exportData(@CurrentUser() user: AuthUser) {
    return this.privacy.exportData(user.id);
  }

  @Post('make-private')
  makePrivate(@CurrentUser() user: AuthUser) {
    return this.privacy.makePrivate(user.id);
  }

  @Post('reset-skill-twin')
  resetTwin(@CurrentUser() user: AuthUser) {
    return this.privacy.resetSkillTwin(user.id);
  }

  @Post('clear-applications')
  clearApplications(@CurrentUser() user: AuthUser) {
    return this.privacy.clearApplications(user.id);
  }
}
