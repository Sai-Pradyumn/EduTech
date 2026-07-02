import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { StudentProfileDocument } from '../../student-profile/schemas/student-profile.schema';
import { ContextEngineService, ContextFact } from './context-engine.service';
import { MemoryItem, RoadmapContext } from './agent.interface';

export interface LoadedContext {
  profile: StudentProfileDocument | null;
  roadmap: RoadmapContext | null;
  memories: MemoryItem[];
  /** Query-relevant learner facts (mistakes, mastery, plan, courses, memories). */
  facts: ContextFact[];
}

/**
 * Assembles the personalization context for an agent run. Thin façade over the
 * ContextEngine (cached aggregation + per-query relevance selection) so existing
 * callers keep their `load(userId, query)` contract.
 */
@Injectable()
export class AgentContextService {
  constructor(private readonly engine: ContextEngineService) {}

  async load(
    userId: string,
    query?: string,
    agentType?: AgentType,
  ): Promise<LoadedContext> {
    return this.engine.load(userId, query, agentType);
  }
}
