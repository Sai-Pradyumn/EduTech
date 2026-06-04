import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { AiRateLimitService } from '../ai/guards/ai-rate-limit.service';
import { CognitiveGuardianService } from './cognitive-guardian.service';
import { GuardianReviewDto } from './dto/guardian.dto';

/** On-demand Cognitive Guardian review of a tutor answer (rate-limited per user). */
@Controller('guardian')
export class CognitiveGuardianController {
  constructor(
    private readonly guardian: CognitiveGuardianService,
    private readonly rateLimit: AiRateLimitService,
  ) {}

  @Post('review')
  review(@CurrentUser() user: AuthUser, @Body() dto: GuardianReviewDto) {
    this.rateLimit.enforce(user.id);
    return this.guardian.review(dto.question, dto.answer);
  }
}
