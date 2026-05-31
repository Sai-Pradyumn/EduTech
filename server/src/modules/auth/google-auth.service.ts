import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleProfile } from '../users/users.service';

/**
 * Google OAuth verifier (Phase 10). Verifies a Google ID token (credential from Google
 * Identity Services on the client) and returns a normalized profile. Active only when
 * GOOGLE_CLIENT_ID is configured; otherwise login attempts fail clearly and the client
 * hides the button.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly clientId: string;
  private readonly client?: OAuth2Client;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    if (this.clientId) this.client = new OAuth2Client(this.clientId);
  }

  get enabled(): boolean {
    return !!this.client;
  }

  /** Verify a Google ID token; throws Unauthorized on any failure. */
  async verify(idToken: string): Promise<GoogleProfile> {
    if (!this.client)
      throw new UnauthorizedException('Google sign-in is not configured');
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified)
        throw new UnauthorizedException('Google account email not verified');
      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email.split('@')[0],
        avatarUrl: payload.picture,
      };
    } catch (err) {
      this.logger.warn(`Google verify failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Google credential');
    }
  }
}
