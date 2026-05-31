import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { CourseBuilderService } from './course-builder.service';
import { CourseDocument } from './schemas/course.schema';
import { GenerateCourseDto, PublishCourseDto, UpdateCourseDto } from './dto/course.dto';

function toView(c: CourseDocument) {
  return {
    id: String(c._id),
    title: c.title,
    goal: c.goal,
    description: c.description,
    audience: c.audience,
    level: c.level,
    source: c.source,
    status: c.status,
    visibility: c.visibility,
    modules: c.modules.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, content: l.content, estimateMinutes: l.estimateMinutes })),
      linkedQuizId: m.linkedQuizId ?? null,
      linkedVisualId: m.linkedVisualId ?? null,
      voiceScript: m.voiceScript,
    })),
    project: { title: c.project?.title ?? '', brief: c.project?.brief ?? '', linkedProjectId: c.project?.linkedProjectId ?? null },
    certificateCriteria: c.certificateCriteria,
    linkedFlowId: c.linkedFlowId ?? null,
    publishedAt: c.publishedAt?.toISOString() ?? null,
    createdAt: (c as CourseDocument & { createdAt?: Date }).createdAt?.toISOString() ?? '',
  };
}

@Controller('courses')
export class CourseBuilderController {
  constructor(
    private readonly courses: CourseBuilderService,
    private readonly config: ConfigService,
  ) {}

  private assertEnabled(): void {
    if (this.config.get<{ courseBuilder?: boolean }>('flags')?.courseBuilder === false) {
      throw new ForbiddenException('Course Builder is disabled on this deployment.');
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateCourseDto) {
    this.assertEnabled();
    return toView(await this.courses.generate(user.id, dto));
  }

  @Post('from-roadmap/:roadmapId')
  @HttpCode(HttpStatus.CREATED)
  async fromRoadmap(@CurrentUser() user: AuthUser, @Param('roadmapId') roadmapId: string) {
    this.assertEnabled();
    return toView(await this.courses.fromRoadmap(user.id, roadmapId));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.courses.list(user.id)).map(toView);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.courses.get(user.id, id));
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return toView(await this.courses.update(user.id, id, dto));
  }

  @Post(':id/modules/:moduleId/quiz')
  async quiz(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('moduleId') moduleId: string) {
    return toView(await this.courses.generateQuiz(user.id, id, moduleId));
  }

  @Post(':id/modules/:moduleId/visual')
  async visual(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('moduleId') moduleId: string) {
    return toView(await this.courses.generateVisual(user.id, id, moduleId));
  }

  @Post(':id/project')
  async project(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.courses.generateProject(user.id, id));
  }

  @Post(':id/flow')
  async flow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { course, flowId } = await this.courses.generateFlow(user.id, id);
    return { course: toView(course), flowId };
  }

  @Post(':id/publish')
  async publish(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PublishCourseDto) {
    return toView(await this.courses.publish(user.id, user.role, id, dto.visibility));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.courses.remove(user.id, id);
  }
}
