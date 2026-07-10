import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import {
  assertPublicUrl,
  checkUrlShape,
} from '../../common/security/ssrf-guard';
import { ApiKey, ApiKeyDocument } from './schemas/api-key.schema';
import {
  WebhookDelivery,
  WebhookDeliveryDocument,
  WebhookEndpoint,
  WebhookEndpointDocument,
} from './schemas/webhook.schema';

/** Webhook event catalog — what an org can subscribe to. */
export const WEBHOOK_EVENTS = [
  'certificate.issued',
  'project.submitted',
  'roadmap.completed',
  'member.joined',
  'subscription.changed',
];

@Injectable()
export class DeveloperService {
  private readonly logger = new Logger(DeveloperService.name);

  constructor(
    @InjectModel(ApiKey.name) private readonly keys: Model<ApiKeyDocument>,
    @InjectModel(WebhookEndpoint.name)
    private readonly endpoints: Model<WebhookEndpointDocument>,
    @InjectModel(WebhookDelivery.name)
    private readonly deliveries: Model<WebhookDeliveryDocument>,
  ) {}

  // ── API keys ──
  /** Create a key. Returns the plaintext ONCE — never stored. */
  async createKey(
    orgId: string,
    name: string,
    scopes: string[],
    userId: string,
  ) {
    const secret = randomBytes(24).toString('hex');
    const plaintext = `ak_live_${secret}`;
    const prefix = plaintext.slice(0, 12);
    const keyHash = this.hashKey(plaintext);
    const doc = await this.keys.create({
      org: new Types.ObjectId(orgId),
      name,
      keyHash,
      prefix,
      scopes,
      createdBy: userId,
    });
    return { id: String(doc._id), name, prefix, scopes, key: plaintext };
  }

  async listKeys(orgId: string) {
    const rows = await this.keys
      .find({ org: new Types.ObjectId(orgId), revokedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .lean<ApiKeyDocument[]>()
      .exec();
    return rows.map((k) => ({
      id: String(k._id),
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : null,
      createdAt: (k as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    }));
  }

  async revokeKey(orgId: string, id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid API key id');
    await this.keys
      .updateOne(
        { _id: new Types.ObjectId(id), org: new Types.ObjectId(orgId) },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
    return { revoked: true };
  }

  /** Resolve an org from a presented key (for future API auth). */
  async resolveKey(plaintext: string): Promise<string | null> {
    const doc = await this.keys
      .findOne({
        keyHash: this.hashKey(plaintext),
        revokedAt: { $exists: false },
      })
      .lean<ApiKeyDocument>()
      .exec();
    if (!doc) return null;
    void this.keys
      .updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } })
      .exec();
    return String(doc.org);
  }

  private hashKey(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }

  // ── webhooks ──

  /** Reject webhook targets that aren't public https URLs (SSRF · §4.6). Fast, DNS-free
   *  rejection of localhost/private/metadata/non-https at registration time. */
  private assertRegistrableWebhookUrl(url: string): void {
    const shape = checkUrlShape(url, { allowedProtocols: ['https:'] });
    if (!shape.ok)
      throw new BadRequestException(
        `Invalid webhook URL: ${shape.reason ?? 'must be a public https:// address'}`,
      );
  }

  async createWebhook(orgId: string, url: string, events: string[]) {
    this.assertRegistrableWebhookUrl(url);
    const secret = `whsec_${randomUUID().replace(/-/g, '')}`;
    const doc = await this.endpoints.create({
      org: new Types.ObjectId(orgId),
      url,
      events,
      secret,
    });
    return this.endpointView(doc, true);
  }

  async listWebhooks(orgId: string) {
    const rows = await this.endpoints
      .find({ org: new Types.ObjectId(orgId) })
      .sort({ createdAt: -1 })
      .lean<WebhookEndpointDocument[]>()
      .exec();
    return rows.map((e) => this.endpointView(e, false));
  }

  async updateWebhook(
    orgId: string,
    id: string,
    patch: { url?: string; events?: string[]; active?: boolean },
  ) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid webhook id');
    if (patch.url !== undefined) this.assertRegistrableWebhookUrl(patch.url);
    const doc = await this.endpoints
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), org: new Types.ObjectId(orgId) },
        { $set: patch },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Webhook not found');
    return this.endpointView(doc, false);
  }

  async deleteWebhook(orgId: string, id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid webhook id');
    await this.endpoints
      .deleteOne({
        _id: new Types.ObjectId(id),
        org: new Types.ObjectId(orgId),
      })
      .exec();
    return { deleted: true };
  }

  /** Fire a test event to an endpoint and record the delivery. */
  async testWebhook(orgId: string, id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid webhook id');
    const ep = await this.endpoints
      .findOne({ _id: new Types.ObjectId(id), org: new Types.ObjectId(orgId) })
      .exec();
    if (!ep) throw new NotFoundException('Webhook not found');
    const payload = { event: 'ping', sentAt: new Date().toISOString() };
    return this.deliver(ep, 'ping', payload);
  }

  async listDeliveries(orgId: string) {
    const eps = await this.endpoints
      .find({ org: new Types.ObjectId(orgId) })
      .distinct('_id')
      .exec();
    const rows = await this.deliveries
      .find({ endpoint: { $in: eps } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<WebhookDeliveryDocument[]>()
      .exec();
    return rows.map((d) => ({
      id: String(d._id),
      endpointId: String(d.endpoint),
      event: d.event,
      status: d.status,
      responseCode: d.responseCode ?? null,
      error: d.error ?? null,
      attempts: d.attempts,
      createdAt: (d as { createdAt?: Date }).createdAt?.toISOString() ?? '',
    }));
  }

  /** Deliver an event with an HMAC signature; record success/failure. Never throws. */
  private async deliver(
    ep: WebhookEndpointDocument,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', ep.secret)
      .update(body)
      .digest('hex');
    let status: 'success' | 'failed' = 'failed';
    let responseCode: number | undefined;
    let error: string | undefined;
    try {
      // Resolve-and-verify at send time: blocks a target whose DNS now points at a private
      // address (rebinding) or a URL stored before the registration check existed (§4.6).
      await assertPublicUrl(ep.url, { allowedProtocols: ['https:'] });
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Asta-Event': event,
          'X-Asta-Signature': signature,
        },
        body,
      });
      responseCode = res.status;
      status = res.ok ? 'success' : 'failed';
    } catch (err) {
      error = (err as Error).message;
    }
    const delivery = await this.deliveries.create({
      endpoint: ep._id,
      event,
      payload,
      status,
      responseCode,
      error,
    });
    return {
      id: String(delivery._id),
      status,
      responseCode: responseCode ?? null,
      error: error ?? null,
    };
  }

  private endpointView(
    e: WebhookEndpointDocument | (WebhookEndpoint & { _id: unknown }),
    withSecret: boolean,
  ) {
    return {
      id: String((e as { _id: unknown })._id),
      url: e.url,
      events: e.events,
      active: e.active,
      secret: withSecret ? e.secret : undefined,
    };
  }
}
