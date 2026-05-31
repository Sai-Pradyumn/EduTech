import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushService } from '../push/push.service';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

/**
 * In-app notifications (B13). Other modules can inject this to `create(...)` events
 * (cohort announcement, mentor review, quiz graded, limit reached, …).
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly model: Model<NotificationDocument>,
    private readonly push: PushService,
  ) {}

  async create(
    userId: string,
    input: { type?: string; title: string; body?: string; link?: string },
  ): Promise<void> {
    await this.model.create({
      user: new Types.ObjectId(userId),
      type: input.type ?? 'info',
      title: input.title,
      body: input.body ?? '',
      link: input.link ?? '',
    });
    // Also fire a Web Push (no-op unless VAPID is configured + the user subscribed).
    void this.push.notify(userId, {
      title: input.title,
      body: input.body ?? '',
      url: input.link || '/app/dashboard',
    });
  }

  /** Phase 9 · Nudge-safe create — skips if an identical unread nudge already exists (no spam). */
  async createUnique(
    userId: string,
    input: { type?: string; title: string; body?: string; link?: string },
  ): Promise<void> {
    const exists = await this.model
      .exists({
        user: new Types.ObjectId(userId),
        title: input.title,
        read: false,
      })
      .exec();
    if (exists) return;
    await this.create(userId, input);
  }

  /** Fan-out the same notification to many users (e.g. a cohort announcement). */
  async createMany(
    userIds: string[],
    input: { type?: string; title: string; body?: string; link?: string },
  ): Promise<void> {
    if (userIds.length === 0) return;
    await this.model.insertMany(
      userIds.map((id) => ({
        user: new Types.ObjectId(id),
        type: input.type ?? 'info',
        title: input.title,
        body: input.body ?? '',
        link: input.link ?? '',
        read: false,
      })),
    );
  }

  async list(
    userId: string,
    limit = 30,
  ): Promise<{ items: NotificationView[]; unread: number }> {
    const items = await this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<NotificationDocument[]>()
      .exec();
    const unread = await this.model
      .countDocuments({ user: new Types.ObjectId(userId), read: false })
      .exec();
    return {
      items: items.map((n) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.read,
        createdAt: (n as { createdAt?: Date }).createdAt?.toISOString() ?? '',
      })),
      unread,
    };
  }

  async markRead(userId: string, id: string): Promise<{ ok: true }> {
    await this.model
      .updateOne(
        { _id: id, user: new Types.ObjectId(userId) },
        { $set: { read: true } },
      )
      .exec();
    return { ok: true };
  }

  async markAllRead(userId: string): Promise<{ ok: true }> {
    await this.model
      .updateMany(
        { user: new Types.ObjectId(userId), read: false },
        { $set: { read: true } },
      )
      .exec();
    return { ok: true };
  }
}
