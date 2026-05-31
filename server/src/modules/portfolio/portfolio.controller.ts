import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/interfaces';
import { PortfolioService } from './portfolio.service';
import { PortfolioDocument } from './schemas/portfolio.schema';
import { UpdatePortfolioDto } from './dto/portfolio.dto';

function toView(p: PortfolioDocument) {
  return {
    username: p.username,
    title: p.title,
    tagline: p.tagline,
    about: p.about,
    targetRole: p.targetRole,
    skills: p.skills,
    projects: p.projects,
    links: p.links,
    theme: p.theme,
    status: p.status,
    publicSettings: p.publicSettings,
    generatedAt: p.generatedAt?.toISOString() ?? null,
  };
}

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return toView(await this.portfolio.getMe(user.id));
  }

  @Patch('me')
  async patch(@CurrentUser() user: AuthUser, @Body() dto: UpdatePortfolioDto) {
    return toView(await this.portfolio.patchMe(user.id, dto));
  }

  @Post('generate')
  async generate(@CurrentUser() user: AuthUser) {
    return toView(await this.portfolio.generate(user.id));
  }

  @Post('add-project/:projectId')
  async addProject(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return toView(await this.portfolio.addProject(user.id, projectId));
  }

  @Post('publish')
  async publish(@CurrentUser() user: AuthUser) {
    return toView(await this.portfolio.setStatus(user.id, 'published'));
  }

  @Post('unpublish')
  async unpublish(@CurrentUser() user: AuthUser) {
    return toView(await this.portfolio.setStatus(user.id, 'draft'));
  }

  @Public()
  @Get('public/:username')
  publicPortfolio(@Param('username') username: string) {
    return this.portfolio.getPublic(username);
  }
}
