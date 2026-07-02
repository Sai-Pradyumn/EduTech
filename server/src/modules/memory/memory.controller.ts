import {
  Controller,
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { MemoryService } from './memory.service';
import { ConfirmMemoryDto } from './dto/memory.dto';

/**
 * Phase E · learner memory: confirm (save/dismiss) suggestions, list what's
 * saved, and — the memory manager — see and delete EVERYTHING Asta knows
 * (confirmed facts + what agents observed from activity).
 */
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.memory.list(user.id);
  }

  /** Everything Asta remembers, across both stores — the memory manager. */
  @Get('all')
  listAll(@CurrentUser() user: AuthUser) {
    return this.memory.listAll(user.id);
  }

  @Post('confirm')
  confirm(@CurrentUser() user: AuthUser, @Body() dto: ConfirmMemoryDto) {
    return this.memory.confirm(user.id, user.email, dto);
  }

  @Delete('observed/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeObserved(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.memory.removeObserved(user.id, user.email, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.memory.removeConfirmed(user.id, user.email, id);
  }
}
