import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { UsersService } from '../users/users.service';
import { SessionsService } from './sessions.service';

/** Session / device management (Phase 10 · M6). View active devices, revoke one, or sign
 *  out everywhere (which also clears the refresh token). */
@Controller('auth')
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
  ) {}

  @Get('sessions')
  list(@CurrentUser() user: AuthUser) {
    return this.sessions.list(user.id);
  }

  @Delete('sessions/:id')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.revoke(user.id, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser) {
    await this.sessions.revokeAll(user.id);
    await this.users.setRefreshTokenHash(user.id, null);
    return { ok: true };
  }
}
