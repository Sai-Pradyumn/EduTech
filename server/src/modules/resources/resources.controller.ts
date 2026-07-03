import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces';
import {
  ListResourcesQueryDto,
  SetProgressDto,
  SuggestResourceDto,
} from './dto/resource.dto';
import { ResourcesService } from './resources.service';

/** Curated learning resources: browse, personalized "for you", and a personal library. */
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListResourcesQueryDto) {
    return this.resources.list(user.id, query);
  }

  @Get('for-you')
  forYou(@CurrentUser() user: AuthUser) {
    return this.resources.forYou(user.id);
  }

  @Get('library')
  library(@CurrentUser() user: AuthUser) {
    return this.resources.library(user.id);
  }

  /** Community submission — lands as 'pending' until an admin approves. */
  @Post('suggest')
  @HttpCode(HttpStatus.CREATED)
  suggest(@CurrentUser() user: AuthUser, @Body() dto: SuggestResourceDto) {
    return this.resources.suggest(user.id, dto);
  }

  @Post(':id/upvote')
  upvote(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.resources.toggleUpvote(user.id, id);
  }

  /** Admin review queue for community submissions. */
  @Get('pending')
  @Roles(Role.Admin)
  pending(@CurrentUser() user: AuthUser) {
    return this.resources.pending(user.id);
  }

  @Post(':id/approve')
  @Roles(Role.Admin)
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.resources.approve(user.id, id);
  }

  /** Reject (delete) a pending submission. */
  @Delete(':id/pending')
  @Roles(Role.Admin)
  reject(@Param('id') id: string) {
    return this.resources.reject(id);
  }

  @Put(':id/progress')
  setProgress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetProgressDto,
  ) {
    return this.resources.setProgress(user.id, id, dto.status);
  }

  @Delete(':id/progress')
  async clearProgress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.resources.clearProgress(user.id, id);
    return { removed: true };
  }
}
