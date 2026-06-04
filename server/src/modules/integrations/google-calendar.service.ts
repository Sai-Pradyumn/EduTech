import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

/**
 * Google Calendar OAuth + event push (Phase 10 · M12). Code-complete and gated: activates only
 * when GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_OAUTH_REDIRECT_URI are configured. Uses
 * an authorization-code flow with offline access to obtain a refresh token, then creates events
 * via the Calendar REST API. When unconfigured, `enabled` is false and the connector reports an
 * honest "configure Google credentials" state — the .ics export stays the always-on fallback.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly log = new Logger(GoogleCalendarService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly stateSecret: string;
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
  ];

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.redirectUri = config.get<string>('GOOGLE_OAUTH_REDIRECT_URI') ?? '';
    this.stateSecret =
      config.get<string>('jwt.secret') ??
      config.get<string>('JWT_SECRET') ??
      'asta-dev';
  }

  get enabled(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }

  private oauthClient(): OAuth2Client {
    return new OAuth2Client(this.clientId, this.clientSecret, this.redirectUri);
  }

  /** Build the Google consent URL; `state` is a short-lived signed token carrying the user id. */
  authUrl(userId: string): string {
    if (!this.enabled) {
      throw new BadRequestException('Google Calendar is not configured.');
    }
    return this.oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GoogleCalendarService.SCOPES,
      state: this.signState(userId),
    });
  }

  /** Exchange the auth code for a refresh token. Verifies the signed state → user id. */
  async exchangeCode(
    code: string,
    state: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    const userId = this.verifyState(state);
    if (!userId) throw new BadRequestException('Invalid or expired state.');
    const { tokens } = await this.oauthClient().getToken(code);
    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return a refresh token — revoke prior access and retry.',
      );
    }
    return { userId, refreshToken: tokens.refresh_token };
  }

  /** Create events on the user's primary calendar using their stored refresh token. */
  async pushEvents(
    refreshToken: string,
    events: { title: string; date: string }[],
  ): Promise<number> {
    if (!this.enabled || !refreshToken) return 0;
    const client = this.oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { token } = await client.getAccessToken();
    if (!token)
      throw new BadRequestException('Could not refresh Google access.');

    let created = 0;
    for (const e of events) {
      const start = new Date(e.date);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: e.title,
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
          }),
        },
      );
      if (res.ok) created++;
      else this.log.warn(`Calendar event failed: ${res.status}`);
    }
    return created;
  }

  private signState(userId: string): string {
    const payload = `${userId}.${Date.now()}`;
    const sig = createHmac('sha256', this.stateSecret)
      .update(payload)
      .digest('hex')
      .slice(0, 32);
    return Buffer.from(`${payload}.${sig}`).toString('base64url');
  }

  private verifyState(state: string): string | null {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const [userId, ts, sig] = decoded.split('.');
      if (!userId || !ts || !sig) return null;
      const expected = createHmac('sha256', this.stateSecret)
        .update(`${userId}.${ts}`)
        .digest('hex')
        .slice(0, 32);
      if (expected !== sig) return null;
      // 10-minute validity window.
      if (Date.now() - Number(ts) > 10 * 60 * 1000) return null;
      return userId;
    } catch {
      return null;
    }
  }
}
