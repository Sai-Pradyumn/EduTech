import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { ReplayService } from './replay.service';

@Controller('replay')
export class ReplayController {
  constructor(private readonly replay: ReplayService) {}

  @Get()
  generate(@CurrentUser() user: AuthUser) {
    return this.replay.generate(user.id);
  }
}
