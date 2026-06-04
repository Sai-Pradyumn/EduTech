import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { MemoryService } from './memory.service';
import { ConfirmMemoryDto } from './dto/memory.dto';

/** Phase E · learner memory: confirm (save/dismiss) suggestions and list what's saved. */
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.memory.list(user.id);
  }

  @Post('confirm')
  confirm(@CurrentUser() user: AuthUser, @Body() dto: ConfirmMemoryDto) {
    return this.memory.confirm(user.id, user.email, dto);
  }
}
