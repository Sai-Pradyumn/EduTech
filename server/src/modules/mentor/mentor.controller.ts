import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { Permission } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/interfaces';
import { MentorService } from './services/mentor.service';
import { AddNoteDto, ReviewProjectDto, UpdateMentorProfileDto } from './dto/mentor.dto';

/** Mentor surface — org-scoped via B1 memberships; gated by StudentView / ProjectReview. */
@Controller('mentor')
export class MentorController {
  constructor(private readonly mentor: MentorService) {}

  @Get('dashboard')
  @Permissions(Permission.StudentView)
  dashboard(@CurrentUser() user: AuthUser) {
    return this.mentor.dashboard(user.id);
  }

  @Get('students/:id')
  @Permissions(Permission.StudentView)
  studentDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mentor.studentDetail(user.id, id);
  }

  @Get('students/:id/notes')
  @Permissions(Permission.StudentView)
  notes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mentor.listNotes(user.id, id);
  }

  @Post('students/:id/notes')
  @Permissions(Permission.StudentView)
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.mentor.addNote(user.id, id, dto.content);
  }

  @Post('projects/:id/review')
  @Permissions(Permission.ProjectReview)
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewProjectDto) {
    return this.mentor.reviewProject(user.id, id, dto.decision, dto.feedback, dto.score);
  }

  @Get('profile')
  async profile(@CurrentUser() user: AuthUser) {
    return (await this.mentor.getProfile(user.id)) ?? null;
  }

  @Put('profile')
  upsertProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateMentorProfileDto) {
    return this.mentor.upsertProfile(user.id, dto);
  }
}
