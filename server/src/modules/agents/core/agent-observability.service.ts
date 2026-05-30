import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AgentType } from '../../../common/enums';
import {
  AgentWorkflowLog,
  AgentWorkflowLogDocument,
  WorkflowStep,
} from '../schemas/agent-workflow-log.schema';

/** Records each agent run's workflow steps so the UI can show transparency and admin can analyze usage. */
@Injectable()
export class AgentObservabilityService {
  private readonly logger = new Logger(AgentObservabilityService.name);

  constructor(
    @InjectModel(AgentWorkflowLog.name) private readonly model: Model<AgentWorkflowLogDocument>,
  ) {}

  start(): WorkflowTrace {
    return new WorkflowTrace();
  }

  async persist(
    userId: string,
    agentType: AgentType,
    trace: WorkflowTrace,
    opts: { sessionId?: string; success: boolean; error?: string },
  ): Promise<void> {
    try {
      await this.model.create({
        user: new Types.ObjectId(userId),
        session: opts.sessionId ? new Types.ObjectId(opts.sessionId) : undefined,
        agentType,
        steps: trace.steps,
        latencyMs: trace.elapsed(),
        success: opts.success,
        error: opts.error,
      });
    } catch (err) {
      this.logger.warn(`Failed to persist workflow log: ${(err as Error).message}`);
    }
  }
}

/** Accumulates ordered workflow steps with relative timings. Date-free (uses perf-style counter via Date is fine here at runtime). */
export class WorkflowTrace {
  readonly steps: WorkflowStep[] = [];
  private readonly startedAt = Date.now();

  step(type: string, label: string): void {
    this.steps.push({ type, label, atMs: Date.now() - this.startedAt });
  }

  elapsed(): number {
    return Date.now() - this.startedAt;
  }
}
