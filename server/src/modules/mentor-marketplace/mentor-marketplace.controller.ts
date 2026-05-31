import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { MentorMarketplaceService } from './mentor-marketplace.service';
import { RequestSessionDto, SessionNotesDto, UpdateSessionStatusDto, UpsertMentorProfileDto } from './dto/mentor-marketplace.dto';

@Controller('mentors')
export class MentorsController {
  constructor(private readonly market: MentorMarketplaceService) {}

  @Get()
  list() {
    return this.market.listMentors();
  }

  @Get('profile/me')
  async myProfile(@CurrentUser() user: AuthUser) {
    const p = await this.market.myProfile(user.id);
    return p
      ? { headline: p.headline, expertise: p.expertise, bio: p.bio, availability: p.availability, pricingMode: p.pricingMode, priceNote: p.priceNote, visibility: p.visibility }
      : null;
  }

  @Post('profile')
  async upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertMentorProfileDto) {
    const p = await this.market.upsertProfile(user.id, dto);
    return { headline: p.headline, expertise: p.expertise, bio: p.bio, availability: p.availability, pricingMode: p.pricingMode, priceNote: p.priceNote, visibility: p.visibility };
  }

  @Patch('profile')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpsertMentorProfileDto) {
    return this.upsert(user, dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.market.getMentor(id);
  }
}

@Controller('mentor-sessions')
export class MentorSessionsController {
  constructor(private readonly market: MentorMarketplaceService) {}

  @Post()
  async request(@CurrentUser() user: AuthUser, @Body() dto: RequestSessionDto) {
    const s = await this.market.requestSession(user.id, dto);
    return { id: String(s._id), status: s.status };
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.market.listSessions(user.id);
  }

  @Patch(':id/status')
  async status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSessionStatusDto) {
    const s = await this.market.updateStatus(user.id, id, dto.status);
    return { id: String(s._id), status: s.status };
  }

  @Post(':id/notes')
  async notes(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SessionNotesDto) {
    const s = await this.market.addNotes(user.id, id, dto.notes);
    return { id: String(s._id), notes: s.notes };
  }
}
