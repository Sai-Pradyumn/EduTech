import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { OutcomeCouncilService } from './outcome-council.service';

@Controller('outcome-council')
export class OutcomeCouncilController {
  constructor(private readonly council: OutcomeCouncilService) {}

  /** Run the council now — gathers context, ranks specialist proposals, narrates a verdict. */
  @Post('recommend')
  recommend(@CurrentUser() user: AuthUser) {
    return this.council.recommend(user.id);
  }

  /** The last cached verdict (for cheap dashboard reads). */
  @Get('latest')
  latest(@CurrentUser() user: AuthUser) {
    return this.council.latest(user.id);
  }
}
