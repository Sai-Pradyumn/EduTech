import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';

/**
 * Per-user sliding-window rate limit for AI turns. Protects the single shared API key
 * from runaway loops / abuse and keeps cost bounded. In-memory (per instance) — swap to
 * Redis for multi-instance. Tunable via AI_USER_RATE_PER_MIN.
 */
@Injectable()
export class AiRateLimitService {
  private readonly windowMs = 60_000;
  private readonly max: number;
  private readonly hits = new Map<string, number[]>();

  constructor(config: ConfigService<AppConfig, true>) {
    this.max = config.get('ai', { infer: true }).userRatePerMin;
  }

  /** Records a turn for the user; throws 429 when over the per-minute budget. */
  enforce(userId: string): void {
    const now = Date.now();
    const recent = (this.hits.get(userId) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      throw new HttpException(
        `You're sending AI requests too fast. Please wait a moment (limit ${this.max}/min).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(userId, recent);
  }
}
