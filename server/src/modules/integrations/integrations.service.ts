import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  IntegrationConnection,
  IntegrationConnectionDocument,
  IntegrationSyncLog,
  IntegrationSyncLogDocument,
} from './schemas/integration.schema';

export interface IntegrationDef {
  provider: string;
  name: string;
  category: string;
  /** Mock connectors can be connected locally with no OAuth/keys. */
  mode: 'mock' | 'oauth' | 'manual' | 'export';
  description: string;
}

/** Catalog of supported integrations (Phase 10 · M12). Real OAuth providers are placeholders
 *  until configured; mock/manual/export connectors are fully local-safe. */
export const INTEGRATION_CATALOG: IntegrationDef[] = [
  {
    provider: 'github',
    name: 'GitHub',
    category: 'Code',
    mode: 'manual',
    description: 'Link project repos by URL.',
  },
  {
    provider: 'google_calendar',
    name: 'Google Calendar',
    category: 'Calendar',
    mode: 'oauth',
    description: 'Sync study sessions (OAuth — placeholder).',
  },
  {
    provider: 'calendar_ics',
    name: 'Calendar export (.ics)',
    category: 'Calendar',
    mode: 'export',
    description: 'Export your plan as an .ics file.',
  },
  {
    provider: 'slack',
    name: 'Slack',
    category: 'Chat',
    mode: 'mock',
    description: 'Post cohort announcements (webhook — mock).',
  },
  {
    provider: 'discord',
    name: 'Discord',
    category: 'Chat',
    mode: 'mock',
    description: 'Community notifications (webhook — mock).',
  },
  {
    provider: 'lms',
    name: 'LMS import',
    category: 'LMS',
    mode: 'manual',
    description: 'Import roster/courses (placeholder).',
  },
];

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectModel(IntegrationConnection.name)
    private readonly connections: Model<IntegrationConnectionDocument>,
    @InjectModel(IntegrationSyncLog.name)
    private readonly syncLogs: Model<IntegrationSyncLogDocument>,
  ) {}

  catalog(): IntegrationDef[] {
    return INTEGRATION_CATALOG;
  }

  async listForUser(userId: string) {
    const rows = await this.connections
      .find({ user: new Types.ObjectId(userId) })
      .lean<IntegrationConnectionDocument[]>()
      .exec();
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    return INTEGRATION_CATALOG.map((def) => {
      const conn = byProvider.get(def.provider);
      return {
        ...def,
        connected: conn?.status === 'connected',
        connectionId: conn ? String(conn._id) : null,
        lastSyncAt: conn?.lastSyncAt
          ? new Date(conn.lastSyncAt).toISOString()
          : null,
        metadata: conn?.metadata ?? {},
      };
    });
  }

  async connect(
    userId: string,
    provider: string,
    metadata: Record<string, unknown> = {},
  ) {
    const def = INTEGRATION_CATALOG.find((d) => d.provider === provider);
    if (!def) throw new Error('Unknown integration');
    await this.connections.findOneAndUpdate(
      { user: new Types.ObjectId(userId), provider },
      {
        $set: {
          user: new Types.ObjectId(userId),
          provider,
          status: 'connected',
          metadata,
          lastSyncAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { connected: true, provider };
  }

  async disconnect(userId: string, provider: string) {
    await this.connections
      .updateOne(
        { user: new Types.ObjectId(userId), provider },
        { $set: { status: 'disconnected' } },
      )
      .exec();
    return { disconnected: true, provider };
  }

  async sync(userId: string, provider: string) {
    const conn = await this.connections
      .findOne({ user: new Types.ObjectId(userId), provider })
      .exec();
    if (!conn) throw new Error('Not connected');
    const startedAt = new Date();
    conn.lastSyncAt = startedAt;
    await conn.save();
    await this.syncLogs.create({
      connection: conn._id,
      status: 'success',
      startedAt,
      endedAt: new Date(),
      recordsProcessed: 0,
    });
    return { synced: true, provider, at: startedAt.toISOString() };
  }

  /** Build a minimal valid .ics for a set of plan items (local-safe calendar export). */
  buildIcs(events: { title: string; date: string }[]): string {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Asta//Learning Plan//EN',
      'CALSCALE:GREGORIAN',
    ];
    for (const e of events) {
      const dt = e.date.replace(/[-:]/g, '').slice(0, 15);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${dt}-${Math.random().toString(36).slice(2, 8)}@asta`,
        `DTSTART:${dt}Z`,
        `SUMMARY:${e.title.replace(/[\n,;]/g, ' ')}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}
