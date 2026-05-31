import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { InterviewService } from './interview.service';
import { InterviewSessionDocument } from './schemas/interview-session.schema';
import { INTERVIEW_TYPES, INTERVIEW_TYPE_META, InterviewType } from './interview-bank';
import { RespondInterviewDto, StartInterviewDto } from './dto/interview.dto';

function toView(s: InterviewSessionDocument) {
  return {
    id: String(s._id),
    type: s.type,
    typeLabel: INTERVIEW_TYPE_META[s.type].label,
    role: s.role,
    status: s.status,
    currentIndex: s.currentIndex,
    total: s.questions.length,
    questions: s.questions.map((q) => ({ id: q.id, question: q.question, answer: q.answer, feedback: q.feedback, score: q.score ?? null, answered: q.answered })),
    communicationScore: s.communicationScore,
    technicalScore: s.technicalScore,
    confidenceScore: s.confidenceScore,
    overallScore: s.overallScore,
    summary: s.summary,
    strengths: s.strengths,
    weakConcepts: s.weakConcepts,
    createdAt: (s as InterviewSessionDocument & { createdAt?: Date }).createdAt?.toISOString() ?? '',
  };
}

@Controller('interview')
export class InterviewController {
  constructor(private readonly interview: InterviewService) {}

  /** Available interview types (for the picker). */
  @Get('types')
  types() {
    return INTERVIEW_TYPES.map((t) => ({ type: t, ...INTERVIEW_TYPE_META[t as InterviewType] }));
  }

  @Post('start')
  async start(@CurrentUser() user: AuthUser, @Body() dto: StartInterviewDto) {
    return toView(await this.interview.start(user.id, dto.type, dto.roleId));
  }

  @Post(':id/respond')
  async respond(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RespondInterviewDto) {
    return toView(await this.interview.respond(user.id, id, dto.answer));
  }

  @Post(':id/finish')
  async finish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.interview.finish(user.id, id));
  }

  @Get('sessions')
  async sessions(@CurrentUser() user: AuthUser) {
    return (await this.interview.list(user.id)).map(toView);
  }

  @Get('sessions/:id')
  async session(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.interview.get(user.id, id));
  }
}
