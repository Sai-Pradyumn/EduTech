import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { MentorCouncilService } from './mentor-council.service';

@Controller('mentor-council')
export class MentorCouncilController {
  constructor(private readonly council: MentorCouncilService) {}

  @Get()
  convene(@CurrentUser() user: AuthUser) {
    return this.council.convene(user.id);
  }

  @Post('convene')
  reconvene(@CurrentUser() user: AuthUser) {
    return this.council.convene(user.id);
  }
}
