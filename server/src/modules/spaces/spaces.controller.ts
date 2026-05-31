import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { SpacesService } from './spaces.service';
import { StudySpaceDocument } from './schemas/study-space.schema';
import {
  AddSourceDto,
  AskSpaceDto,
  CreateSpaceDto,
  UpdateSpaceDto,
} from './dto/space.dto';

function toView(s: StudySpaceDocument) {
  return {
    id: String(s._id),
    title: s.title,
    description: s.description,
    sources: s.sources.map((src) => ({
      id: src.id,
      type: src.type,
      title: src.title,
      text: src.text,
      url: src.url ?? null,
      ref: src.ref ?? null,
      addedAt: src.addedAt?.toISOString() ?? '',
    })),
    artifacts: s.artifacts.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      content: a.content,
      createdAt: a.createdAt?.toISOString() ?? '',
    })),
    linkedFlowIds: s.linkedFlowIds,
    linkedVisualIds: s.linkedVisualIds,
    linkedQuizIds: s.linkedQuizIds,
    linkedVoiceSessionIds: s.linkedVoiceSessionIds,
    createdAt:
      (
        s as StudySpaceDocument & { createdAt?: Date }
      ).createdAt?.toISOString() ?? '',
  };
}

@Controller('spaces')
export class SpacesController {
  constructor(
    private readonly spaces: SpacesService,
    private readonly config: ConfigService,
  ) {}

  private assertEnabled(): void {
    if (
      this.config.get<{ studySpaces?: boolean }>('flags')?.studySpaces === false
    ) {
      throw new ForbiddenException(
        'Study Spaces is disabled on this deployment.',
      );
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateSpaceDto) {
    this.assertEnabled();
    return toView(await this.spaces.create(user.id, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.spaces.list(user.id)).map(toView);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.spaces.get(user.id, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return toView(await this.spaces.update(user.id, id, dto));
  }

  @Post(':id/sources')
  async addSource(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddSourceDto,
  ) {
    return toView(await this.spaces.addSource(user.id, id, dto));
  }

  @Delete(':id/sources/:sourceId')
  async removeSource(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('sourceId') sourceId: string,
  ) {
    return toView(await this.spaces.removeSource(user.id, id, sourceId));
  }

  @Post(':id/ask')
  ask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AskSpaceDto,
  ) {
    return this.spaces.ask(user.id, id, dto.question);
  }

  @Post(':id/summary')
  async summary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.spaces.summary(user.id, id));
  }

  @Post(':id/flashcards')
  async flashcards(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.spaces.flashcards(user.id, id));
  }

  @Post(':id/audio-overview')
  async audio(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { space, script } = await this.spaces.audioOverview(user.id, id);
    return { space: toView(space), script };
  }

  @Post(':id/flow')
  async flow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { space, flowId } = await this.spaces.createFlow(user.id, id);
    return { space: toView(space), flowId };
  }

  @Post(':id/quiz')
  async quiz(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { space, quizId } = await this.spaces.createQuiz(user.id, id);
    return { space: toView(space), quizId };
  }

  @Post(':id/visuals')
  async visuals(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { space, visualId } = await this.spaces.createVisual(user.id, id);
    return { space: toView(space), visualId };
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spaces.remove(user.id, id);
  }
}
