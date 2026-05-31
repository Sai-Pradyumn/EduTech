import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { IsString, MinLength } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { SessionsService } from '../sessions/sessions.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

class GoogleLoginDto {
  @IsString()
  @MinLength(10)
  credential!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleAuthService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.auth.register(dto);
    await this.sessions.record(
      result.user.id,
      req.ip,
      req.header('user-agent'),
    );
    return result;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.auth.login(dto);
    await this.sessions.record(
      result.user.id,
      req.ip,
      req.header('user-agent'),
    );
    return result;
  }

  /** Client config for the Google sign-in button (clientId + whether it's enabled). */
  @Public()
  @Get('google/config')
  googleConfig() {
    return {
      enabled: this.google.enabled,
      clientId: this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('google')
  async googleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    const profile = await this.google.verify(dto.credential);
    const result = await this.auth.googleLogin(profile);
    await this.sessions.record(
      result.user.id,
      req.ip,
      req.header('user-agent'),
    );
    return result;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.id);
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { user: await this.auth.getPublicUser(user.id) };
  }
}
