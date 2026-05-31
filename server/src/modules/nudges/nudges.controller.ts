import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { NudgeService } from './nudge.service';

@Controller('nudges')
export class NudgesController {
  constructor(private readonly nudges: NudgeService) {}

  @Get()
  compute(@CurrentUser() user: AuthUser) {
    return this.nudges.compute(user.id);
  }
}
