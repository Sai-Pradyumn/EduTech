import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { checkUrlShape } from '../../common/security/ssrf-guard';
import { CircuitBreakerRegistry } from '../../common/security/circuit-breaker';
import { GoogleCalendarService } from './google-calendar.service';
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
  /**
   * How the connector is wired:
   *  - `webhook`  — paste an incoming-webhook URL; we POST to it for real.
   *  - `oauth`    — real OAuth flow (active when the provider's keys are configured).
   *  - `manual`   — link/configure by hand (e.g. a repo URL).
   *  - `csv`      — upload a CSV we parse and import.
   *  - `export`   — one-way download (e.g. .ics); no stored connection needed.
   */
  mode: 'webhook' | 'oauth' | 'manual' | 'csv' | 'export';
  description: string;
}

/** Catalog of supported integrations (Phase 10 · M12). Webhook/manual/csv/export connectors
 *  are fully functional with no paid account; OAuth providers activate when their keys are set. */
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
    description: 'Sync study sessions to your Google Calendar.',
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
    mode: 'webhook',
    description: 'Post cohort announcements to a Slack channel.',
  },
  {
    provider: 'discord',
    name: 'Discord',
    category: 'Chat',
    mode: 'webhook',
    description: 'Send community notifications to a Discord channel.',
  },
  {
    provider: 'lms',
    name: 'LMS import',
    category: 'LMS',
    mode: 'csv',
    description: 'Import a roster CSV (name, email, role).',
  },
];

/** Providers that send messages via an incoming webhook URL stored in connection metadata. */
const WEBHOOK_PROVIDERS = new Set(['slack', 'discord']);

/** Read a string value out of free-form metadata without an unsafe-stringify. */
const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectModel(IntegrationConnection.name)
    private readonly connections: Model<IntegrationConnectionDocument>,
    @InjectModel(IntegrationSyncLog.name)
    private readonly syncLogs: Model<IntegrationSyncLogDocument>,
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  /** Whether the Google Calendar OAuth flow is configured (drives the connector's button). */
  get googleCalendarEnabled(): boolean {
    return this.googleCalendar.enabled;
  }

  /** Start the Google Calendar OAuth flow — returns the consent URL to redirect the user to. */
  googleCalendarAuthUrl(userId: string): string {
    return this.googleCalendar.authUrl(userId);
  }

  /** Finish OAuth: store the refresh token on the user's google_calendar connection. */
  async completeGoogleCalendar(code: string, state: string) {
    const { userId, refreshToken } = await this.googleCalendar.exchangeCode(
      code,
      state,
    );
    await this.connections.findOneAndUpdate(
      { user: new Types.ObjectId(userId), provider: 'google_calendar' },
      {
        $set: {
          user: new Types.ObjectId(userId),
          provider: 'google_calendar',
          status: 'connected',
          metadata: { refreshToken },
          lastSyncAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { connected: true };
  }

  /** Build the next few days of study blocks (shared shape with the .ics export). */
  private planEvents(): { title: string; date: string }[] {
    const today = Date.now();
    return [0, 1, 2, 3, 4].map((d) => ({
      title: `Asta study block — day ${d + 1}`,
      date: new Date(today + d * 86400000).toISOString(),
    }));
  }

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
    if (!def) throw new BadRequestException('Unknown integration');

    // Webhook connectors require a valid incoming-webhook URL we can POST to.
    if (WEBHOOK_PROVIDERS.has(provider)) {
      const url = asString(metadata.webhookUrl).trim();
      this.assertWebhookUrl(provider, url);
      metadata = { ...metadata, webhookUrl: url };
    }

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

    // Send a confirmation ping so the user sees it land in their channel immediately.
    if (WEBHOOK_PROVIDERS.has(provider)) {
      await this.postWebhook(
        provider,
        asString(metadata.webhookUrl),
        `✅ Asta connected to ${def.name}. Announcements will arrive here.`,
      ).catch(() => undefined);
    }

    return { connected: true, provider };
  }

  /** Allowed webhook hosts per provider (exact host or subdomain — never a path substring). */
  private static readonly WEBHOOK_HOSTS: Record<string, string[]> = {
    slack: ['hooks.slack.com'],
    discord: ['discord.com', 'discordapp.com'],
  };

  /**
   * Validate an incoming-webhook URL for the given chat provider. Parses the URL and checks
   * the real hostname against an allowlist — not a substring match, which
   * `https://evil.com/hooks.slack.com/` would have slipped past (§4.6 SSRF). Also enforces
   * https and the provider's expected webhook path.
   */
  private assertWebhookUrl(provider: string, url: string): void {
    const allowedHosts = IntegrationsService.WEBHOOK_HOSTS[provider] ?? [];
    const shape = checkUrlShape(url, {
      allowedProtocols: ['https:'],
      allowedHosts,
    });
    if (!shape.ok || !shape.url) {
      throw new BadRequestException(
        `A valid https:// ${provider} incoming-webhook URL is required.`,
      );
    }
    const path = shape.url.pathname;
    const validPath =
      (provider === 'slack' && path.startsWith('/services/')) ||
      (provider === 'discord' && path.startsWith('/api/webhooks/'));
    if (!validPath) {
      throw new BadRequestException(
        `That does not look like a ${provider} incoming-webhook URL.`,
      );
    }
  }

  /** Per-provider circuit breakers: a failing Slack/Discord endpoint fails fast instead of
   *  tying up sockets for the full timeout on every announce (§10 · safe integrations). */
  private readonly webhookBreakers = new CircuitBreakerRegistry({
    failureThreshold: 4,
    cooldownMs: 60_000,
  });

  /** POST a message to a Slack/Discord incoming webhook. Throws on a non-2xx/timeout. */
  private async postWebhook(
    provider: string,
    url: string,
    message: string,
  ): Promise<void> {
    // Re-check at dispatch time too: connections stored before the host-allowlist fix (or
    // edited directly in the DB) must not become an SSRF vector via announce().
    this.assertWebhookUrl(provider, url);
    const body =
      provider === 'slack' ? { text: message } : { content: message };
    await this.webhookBreakers.for(provider).execute(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`webhook responded ${res.status}`);
        }
      } finally {
        clearTimeout(timer);
      }
    });
  }

  /** Post a message to a connected chat webhook (Slack/Discord). */
  async announce(userId: string, provider: string, message: string) {
    if (!WEBHOOK_PROVIDERS.has(provider)) {
      throw new BadRequestException('This provider does not support messages.');
    }
    const text = (message ?? '').trim();
    if (!text) throw new BadRequestException('Message is required.');
    const conn = await this.connections
      .findOne({ user: new Types.ObjectId(userId), provider })
      .exec();
    const url = asString(conn?.metadata?.webhookUrl);
    if (!conn || conn.status !== 'connected' || !url) {
      throw new BadRequestException('Not connected.');
    }
    await this.postWebhook(provider, url, text);
    await this.recordSync(conn._id, 1);
    return { sent: true, provider };
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
    if (!conn) throw new BadRequestException('Not connected');
    const startedAt = new Date();
    conn.lastSyncAt = startedAt;
    await conn.save();

    // Google Calendar: push the upcoming study blocks as real calendar events.
    if (provider === 'google_calendar') {
      const refreshToken = asString(conn.metadata?.refreshToken);
      try {
        const created = await this.googleCalendar.pushEvents(
          refreshToken,
          this.planEvents(),
        );
        await this.recordSync(conn._id, created);
        return {
          synced: true,
          provider,
          at: startedAt.toISOString(),
        };
      } catch (err) {
        conn.status = 'error';
        await conn.save();
        await this.syncLogs.create({
          connection: conn._id,
          status: 'error',
          startedAt,
          endedAt: new Date(),
          recordsProcessed: 0,
          error: err instanceof Error ? err.message : 'calendar sync failed',
        });
        throw new BadRequestException('Calendar sync failed.');
      }
    }

    // Webhook providers: prove the connection by posting a real sync ping.
    if (WEBHOOK_PROVIDERS.has(provider)) {
      const url = asString(conn.metadata?.webhookUrl);
      try {
        await this.postWebhook(
          provider,
          url,
          '🔄 Asta sync ping — still connected.',
        );
        await this.recordSync(conn._id, 1);
      } catch (err) {
        conn.status = 'error';
        await conn.save();
        await this.syncLogs.create({
          connection: conn._id,
          status: 'error',
          startedAt,
          endedAt: new Date(),
          recordsProcessed: 0,
          error: err instanceof Error ? err.message : 'webhook failed',
        });
        throw new BadRequestException('Webhook delivery failed.');
      }
      return { synced: true, provider, at: startedAt.toISOString() };
    }

    await this.recordSync(conn._id, 0);
    return { synced: true, provider, at: startedAt.toISOString() };
  }

  private async recordSync(connectionId: Types.ObjectId, records: number) {
    const now = new Date();
    await this.syncLogs.create({
      connection: connectionId,
      status: 'success',
      startedAt: now,
      endedAt: now,
      recordsProcessed: records,
    });
  }

  /**
   * Import an LMS roster from raw CSV text. Expects a header row with at least
   * `name` and `email` columns (`role` optional). Returns per-row outcomes; the parsed,
   * de-duplicated roster is stored on the connection so cohorts can enroll from it.
   */
  async importLmsCsv(userId: string, csv: string) {
    const rows = this.parseCsv(csv);
    if (rows.length === 0) {
      throw new BadRequestException('CSV is empty or has no data rows.');
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const emailIdx = header.indexOf('email');
    const nameIdx = header.indexOf('name');
    const roleIdx = header.indexOf('role');
    if (emailIdx === -1) {
      throw new BadRequestException('CSV must include an "email" column.');
    }

    const seen = new Set<string>();
    const roster: { name: string; email: string; role: string }[] = [];
    const errors: { row: number; reason: string }[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const email = (cells[emailIdx] ?? '').trim().toLowerCase();
      if (!email) {
        errors.push({ row: i + 1, reason: 'missing email' });
        continue;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errors.push({ row: i + 1, reason: 'invalid email' });
        continue;
      }
      if (seen.has(email)) {
        errors.push({ row: i + 1, reason: 'duplicate email' });
        continue;
      }
      seen.add(email);
      roster.push({
        name:
          (nameIdx > -1 ? cells[nameIdx] : '')?.trim() || email.split('@')[0],
        email,
        role:
          (roleIdx > -1 ? cells[roleIdx] : '')?.trim().toLowerCase() ||
          'student',
      });
    }

    const now = new Date();
    const conn = await this.connections.findOneAndUpdate(
      { user: new Types.ObjectId(userId), provider: 'lms' },
      {
        $set: {
          user: new Types.ObjectId(userId),
          provider: 'lms',
          status: 'connected',
          lastSyncAt: now,
          metadata: {
            roster,
            importedAt: now.toISOString(),
            count: roster.length,
          },
        },
      },
      { upsert: true, new: true },
    );
    await this.recordSync(conn._id, roster.length);

    return {
      imported: roster.length,
      skipped: errors.length,
      errors,
      provider: 'lms',
    };
  }

  /** Minimal RFC-4180-ish CSV parser (quoted fields, escaped quotes, CRLF). Dependency-free. */
  private parseCsv(input: string): string[][] {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    const text = input.replace(/\r\n?/g, '\n');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    // Drop fully-empty trailing rows.
    return rows.filter((r) => r.some((c) => c.trim().length > 0));
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
