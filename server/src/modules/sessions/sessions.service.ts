import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';

/** Parse a coarse device label from a UA string (no external dep). */
function deviceFromUA(ua?: string): string {
  if (!ua) return 'Unknown device';
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Macintosh|Mac OS/i.test(ua)
      ? 'macOS'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad|iOS/i.test(ua)
          ? 'iOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Unknown OS';
  const browser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
      ? 'Chrome'
      : /Firefox/i.test(ua)
        ? 'Firefox'
        : /Safari/i.test(ua)
          ? 'Safari'
          : 'Browser';
  return `${browser} · ${os}`;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectModel(Session.name)
    private readonly sessions: Model<SessionDocument>,
  ) {}

  /** Record a new session on login/register. Never throws into the auth flow. */
  async record(userId: string, ip?: string, userAgent?: string): Promise<void> {
    try {
      await this.sessions.create({
        user: new Types.ObjectId(userId),
        device: deviceFromUA(userAgent),
        ip,
        userAgent,
        lastSeenAt: new Date(),
      });
    } catch (err) {
      this.logger.warn(`Failed to record session: ${(err as Error).message}`);
    }
  }

  async list(userId: string) {
    const rows = await this.sessions
      .find({ user: new Types.ObjectId(userId), revokedAt: { $exists: false } })
      .sort({ lastSeenAt: -1 })
      .lean<SessionDocument[]>()
      .exec();
    return rows.map((s, i) => ({
      id: String(s._id),
      device: s.device ?? 'Unknown device',
      ip: s.ip ?? null,
      lastSeenAt: (s.lastSeenAt ?? new Date()).toISOString(),
      current: i === 0, // most-recent is treated as the current device
    }));
  }

  async revoke(userId: string, sessionId: string) {
    await this.sessions
      .updateOne(
        {
          _id: new Types.ObjectId(sessionId),
          user: new Types.ObjectId(userId),
        },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
    return { revoked: true };
  }

  async revokeAll(userId: string) {
    await this.sessions
      .updateMany(
        { user: new Types.ObjectId(userId), revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
    return { revoked: true };
  }
}
