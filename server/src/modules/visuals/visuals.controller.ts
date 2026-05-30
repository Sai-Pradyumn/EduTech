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
import { VisualsService } from './visuals.service';
import { VisualAssetDocument } from './schemas/visual-asset.schema';
import { FromFlowNodeDto, GenerateVisualDto, UpdateVisualDto } from './dto/visual.dto';

function toView(v: VisualAssetDocument) {
  return {
    id: String(v._id),
    type: v.type,
    title: v.title,
    prompt: v.prompt,
    sourceType: v.sourceType,
    sourceId: v.sourceId ?? null,
    sourceNodeId: v.sourceNodeId ?? null,
    contentFormat: v.contentFormat,
    content: v.content,
    mermaid: v.mermaid,
    thumbnail: v.thumbnail,
    caption: v.caption,
    howToRead: v.howToRead,
    level: v.level,
    status: v.status,
    provider: v.provider,
    metadata: v.metadata ?? {},
    createdAt: (v as VisualAssetDocument & { createdAt?: Date }).createdAt?.toISOString() ?? '',
  };
}

@Controller('visuals')
export class VisualsController {
  constructor(
    private readonly visuals: VisualsService,
    private readonly config: ConfigService,
  ) {}

  private isEnabled(): boolean {
    const flags = this.config.get<{ visualStudio?: boolean }>('flags');
    return flags?.visualStudio !== false;
  }
  private assertEnabled(): void {
    if (!this.isEnabled()) throw new ForbiddenException('Visual Studio is disabled on this deployment.');
  }

  @Get('status')
  status() {
    const flags = this.config.get<{ visualStudio?: boolean; imageGeneration?: boolean }>('flags');
    return { enabled: flags?.visualStudio !== false, imageGeneration: flags?.imageGeneration === true };
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateVisualDto) {
    this.assertEnabled();
    return toView(await this.visuals.generate(user.id, dto));
  }

  @Post('from-flow-node')
  @HttpCode(HttpStatus.CREATED)
  async fromFlowNode(@CurrentUser() user: AuthUser, @Body() dto: FromFlowNodeDto) {
    this.assertEnabled();
    return toView(await this.visuals.fromFlowNode(user.id, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.visuals.list(user.id)).map(toView);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.visuals.get(user.id, id));
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateVisualDto) {
    return toView(await this.visuals.update(user.id, id, dto));
  }

  @Post(':id/regenerate')
  async regenerate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return toView(await this.visuals.regenerate(user.id, id));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.visuals.remove(user.id, id);
  }
}
