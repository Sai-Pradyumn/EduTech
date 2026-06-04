import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { AssessmentService } from './services/assessment.service';
import { GenerateQuizDto, SubmitAttemptDto } from './dto/assessment.dto';

/** Quiz Studio REST surface: generate adaptive quizzes, take them, get graded feedback. */
@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessment: AssessmentService) {}

  @Post('quizzes')
  @HttpCode(HttpStatus.CREATED)
  async generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateQuizDto) {
    const quiz = await this.assessment.generate(user.id, dto);
    return this.assessment.toTakeQuiz(quiz);
  }

  @Get('quizzes')
  list(@CurrentUser() user: AuthUser) {
    return this.assessment.list(user.id);
  }

  @Get('quizzes/:id')
  take(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessment.getForTaking(user.id, id);
  }

  @Post('quizzes/:id/attempts')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.assessment.submit(user.id, id, dto);
  }

  @Get('attempts')
  attempts(@CurrentUser() user: AuthUser) {
    return this.assessment.listAttempts(user.id);
  }

  @Get('quizzes/:id/attempts')
  quizAttempts(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessment.attemptsForQuiz(user.id, id);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.assessment.stats(user.id);
  }
}
