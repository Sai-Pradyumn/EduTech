import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { ResumeService } from './resume.service';
import { ApplicationService } from './application.service';
import { ResumeDocument } from './schemas/resume.schema';
import { ApplicationDocument } from './schemas/application.schema';
import {
  AnalyzeJdDto,
  CreateApplicationDto,
  UpdateApplicationDto,
  UpdateResumeDto,
} from './dto/resume.dto';

function resumeView(r: ResumeDocument) {
  return {
    headline: r.headline,
    summary: r.summary,
    skills: r.skills,
    highlights: r.highlights,
    projects: r.projects.map((p) => ({ title: p.title, bullets: p.bullets })),
    generatedAt: r.generatedAt?.toISOString() ?? null,
  };
}

function appView(a: ApplicationDocument) {
  return {
    id: String(a._id),
    company: a.company,
    role: a.role,
    matchScore: a.matchScore,
    matchedSkills: a.matchedSkills,
    missingSkills: a.missingSkills,
    tailoredSummary: a.tailoredSummary,
    tailoredBullets: a.tailoredBullets,
    coverLetter: a.coverLetter,
    prepPlan: a.prepPlan,
    status: a.status,
    notes: a.notes,
    createdAt:
      (
        a as ApplicationDocument & { createdAt?: Date }
      ).createdAt?.toISOString() ?? '',
  };
}

@Controller('resume')
export class ResumeController {
  constructor(private readonly resume: ResumeService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return resumeView(await this.resume.getMe(user.id));
  }

  @Patch('me')
  async patch(@CurrentUser() user: AuthUser, @Body() dto: UpdateResumeDto) {
    return resumeView(await this.resume.patchMe(user.id, dto));
  }

  @Post('generate')
  async generate(@CurrentUser() user: AuthUser) {
    return resumeView(await this.resume.generate(user.id));
  }
}

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationService) {}

  @Post('analyze-jd')
  analyze(@CurrentUser() user: AuthUser, @Body() dto: AnalyzeJdDto) {
    return this.applications.analyzeJd(user.id, dto);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return appView(await this.applications.create(user.id, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.applications.list(user.id)).map(appView);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return appView(await this.applications.update(user.id, id, dto));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.applications.remove(user.id, id);
  }
}
