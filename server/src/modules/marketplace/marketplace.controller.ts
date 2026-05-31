import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces';
import { MarketplaceService } from './marketplace.service';
import { CreateTemplateDto, ReviewTemplateDto, UpdateTemplateDto } from './dto/marketplace.dto';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly market: MarketplaceService) {}

  @Get('templates')
  list(@Query('type') type?: string, @Query('targetRole') targetRole?: string) {
    return this.market.list({ type, targetRole });
  }

  @Get('templates/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.market.mine(user.id);
  }

  @Get('templates/pending')
  @Roles(Role.Admin)
  pending() {
    return this.market.pending();
  }

  @Get('templates/:id')
  get(@Param('id') id: string) {
    return this.market.get(id);
  }

  @Post('templates')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTemplateDto) {
    const t = await this.market.create(user.id, dto);
    return { id: String(t._id), status: t.status };
  }

  @Patch('templates/:id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    const t = await this.market.update(user.id, id, dto);
    return { id: String(t._id), status: t.status };
  }

  @Post('templates/:id/publish')
  async submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const t = await this.market.submit(user.id, id);
    return { id: String(t._id), status: t.status };
  }

  @Post('templates/:id/review')
  @Roles(Role.Admin)
  async review(@Param('id') id: string, @Body() dto: ReviewTemplateDto) {
    const t = await this.market.review(id, dto);
    return { id: String(t._id), status: t.status };
  }

  @Post('templates/:id/use')
  use(@Param('id') id: string) {
    return this.market.use(id);
  }
}
