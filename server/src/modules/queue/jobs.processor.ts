import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { OpsService } from '../ops/ops.service';
import { DataGovernanceService } from '../data-governance/data-governance.service';
import { ASTA_QUEUE } from './job-queue.service';

/**
 * BullMQ worker (Phase 10). Only instantiated when ENABLE_BULLMQ=true. Each processed job is
 * recorded in the Ops job ledger (active → completed/failed) so /admin/ops shows real queue
 * activity. Real work is dispatched by job.name; unknown names degrade to a logged no-op.
 */
@Processor(ASTA_QUEUE)
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private readonly ops: OpsService,
    private readonly dataGovernance: DataGovernanceService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ ok: boolean }> {
    try {
      this.logger.debug(`processing ${job.name} (${job.id})`);
      switch (job.name) {
        case 'data.export': {
          const jobId = (job.data as { jobId?: string }).jobId;
          if (jobId) await this.dataGovernance.processExport(jobId);
          break;
        }
        default:
          // Unknown job — record it and move on rather than failing the queue.
          this.logger.warn(
            `no handler for job "${job.name}" — recording as completed`,
          );
      }
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
