import { Inject, Injectable, Optional } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { OpsService } from '../ops/ops.service';

export const ASTA_QUEUE = 'asta-jobs';

/**
 * Background-job producer (Phase 10). When ENABLE_BULLMQ=true + Redis is reachable, jobs go
 * to a real BullMQ queue processed by JobsProcessor; otherwise they run inline and are still
 * recorded in the Ops job ledger — so the product never blocks on Redis in local/CI.
 */
@Injectable()
export class JobQueueService {
  constructor(
    @Optional()
    @Inject(getQueueToken(ASTA_QUEUE))
    private readonly queue: Queue | undefined,
    private readonly ops: OpsService,
  ) {}

  get enabled(): boolean {
    return !!this.queue;
  }

  /** Enqueue a job (BullMQ when enabled) or run inline + record it in the Ops ledger. */
  async enqueue(
    name: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    if (this.queue) {
      await this.queue.add(name, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    } else {
      await this.ops.recordJob('inline', name, data, 'completed');
    }
  }
}
