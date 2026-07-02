import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { ListResourcesQueryDto, SetProgressDto } from './dto/resource.dto';
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
