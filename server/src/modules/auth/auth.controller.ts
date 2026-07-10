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
import { MfaService } from './mfa.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  LoginDto,
  MfaCodeDto,
  MfaVerifyLoginDto,
  RefreshDto,
  RegisterDto,
  ResendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';

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
    private readonly mfa: MfaService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService,
  ) {}

  /** Step 1 of signup: validates domain, creates an unverified account, emails an OTP. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /** Step 2 of signup: verify the OTP and start a session. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const result = await this.auth.verifyOtp(dto.email, dto.code);
    await this.sessions.record(
      result.user.id,
      req.ip,
      req.header('user-agent'),
    );
    return result;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto.email);
  }

  /** Allowed email domains, surfaced to the signup form. */
  @Public()
  @Get('signup-config')
  signupConfig() {
    return { allowedDomains: this.auth.allowedDomains() };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.auth.login(dto);
    if ('user' in result) {
      await this.sessions.record(
        result.user.id,
        req.ip,
        req.header('user-agent'),
      );
    }
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
    // No session yet when a second factor is still required.
    if ('user' in result) {
      await this.sessions.record(
        result.user.id,
        req.ip,
        req.header('user-agent'),
      );
    }
    return result;
  }

  /** Complete an MFA-gated login (redeems the short-lived mfaToken from login/google). */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('mfa/verify-login')
  async mfaVerifyLogin(@Body() dto: MfaVerifyLoginDto, @Req() req: Request) {
    const result = await this.auth.verifyMfaLogin(dto.mfaToken, dto.code);
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

  /** Log out everywhere: bumps the session generation, revoking all refresh tokens. */
  @HttpCode(HttpStatus.OK)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser) {
    await this.auth.logoutAll(user.id);
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { user: await this.auth.getPublicUser(user.id) };
  }

  /* ── MFA enrollment / management (authenticated) — SECURITY_IMPLEMENTATION.md §6/§17 ── */

  /** Current MFA state for the signed-in user. */
  @Get('mfa/status')
  mfaStatus(@CurrentUser() user: AuthUser) {
    return this.mfa.status(user.id);
  }

  /** Step 1: stage a TOTP secret and return the QR provisioning URI. */
  @HttpCode(HttpStatus.OK)
  @Post('mfa/setup')
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.mfa.beginEnrollment(user.id);
  }

  /** Step 2: verify the first code, enable MFA, and return one-time recovery codes. */
  @HttpCode(HttpStatus.OK)
  @Post('mfa/activate')
  mfaActivate(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.mfa.activate(user.id, dto.code);
  }

  /** Disable MFA (requires a valid authenticator or recovery code). */
  @HttpCode(HttpStatus.OK)
  @Post('mfa/disable')
  mfaDisable(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.mfa.disable(user.id, dto.code);
  }
}
