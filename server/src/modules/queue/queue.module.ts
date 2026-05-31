import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ASTA_QUEUE, JobQueueService } from './job-queue.service';
import { JobsProcessor } from './jobs.processor';

/**
 * Queue module (Phase 10). Global so any module can inject JobQueueService. BullMQ + the
 * worker are wired ONLY when ENABLE_BULLMQ=true (and Redis is reachable). Disabled by
 * default so local/CI never attempt a Redis connection — jobs run inline + are still
 * recorded in the Ops ledger.
 */
@Global()
@Module({})
export class QueueModule {
  static register(): DynamicModule {
    const enabled = process.env.ENABLE_BULLMQ === 'true';
    if (!enabled) {
      return {
        module: QueueModule,
        providers: [JobQueueService],
        exports: [JobQueueService],
      };
    }
    return {
      module: QueueModule,
      imports: [
        BullModule.forRoot({
          connection: {
            host: process.env.REDIS_HOST ?? 'localhost',
            port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          },
        }),
        BullModule.registerQueue({ name: ASTA_QUEUE }),
      ],
      providers: [JobQueueService, JobsProcessor],
      exports: [JobQueueService],
    };
  }
}
