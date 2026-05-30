import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { LearningIntelligenceService } from './learning-intelligence.service';

/** Learning-Intelligence cockpit: one aggregated overview for the dashboard. */
@Controller('intelligence')
export class LearningIntelligenceController {
  constructor(private readonly intelligence: LearningIntelligenceService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.intelligence.overview(user.id);
  }
}
