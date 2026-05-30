import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiFeedback, AiFeedbackDocument } from './schemas/ai-feedback.schema';

export interface SubmitFeedbackInput {
  messageId?: string;
  rating: 'up' | 'down' | 'too_hard' | 'too_easy' | 'incorrect';
  reason?: string;
}

@Injectable()
export class FeedbackService {
  constructor(@InjectModel(AiFeedback.name) private readonly model: Model<AiFeedbackDocument>) {}

  submit(userId: string, input: SubmitFeedbackInput): Promise<AiFeedbackDocument> {
    return this.model.create({
      user: new Types.ObjectId(userId),
      message: input.messageId ? new Types.ObjectId(input.messageId) : undefined,
      rating: input.rating,
      reason: input.reason ?? '',
    });
  }

  /** Aggregate counts by rating (for admin AI feedback analytics). */
  async summary(): Promise<{ rating: string; count: number }[]> {
    const rows = await this.model.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    return rows.map((r) => ({ rating: r._id, count: r.count }));
  }
}
