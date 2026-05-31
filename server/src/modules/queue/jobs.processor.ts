import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { OpsService } from '../ops/ops.service';
import { ASTA_QUEUE } from './job-queue.service';

/**
 * BullMQ worker (Phase 10). Only instantiated when ENABLE_BULLMQ=true. Each processed job is
 * recorded in the Ops job ledger (active → completed/failed) so /admin/ops shows real queue
 * activity. Add real work per job name here (e.g. data.export → build + upload the archive).
 */
@Processor(ASTA_QUEUE)
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(private readonly ops: OpsService) {
    super();
  }

  async process(job: Job): Promise<{ ok: boolean }> {
    try {
      // Placeholder work — real handlers slot in by job.name.
      this.logger.debug(`processing ${job.name} (${job.id})`);
      await this.ops.recordJob(ASTA_QUEUE, job.name, job.data, 'completed');
      return { ok: true };
    } catch (err) {
      await this.ops.recordJob(
        ASTA_QUEUE,
        job.name,
        job.data,
        'failed',
        (err as Error).message,
      );
      throw err;
    }
  }
}
