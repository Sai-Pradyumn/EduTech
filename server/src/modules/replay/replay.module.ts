import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { SkillTwinModule } from '../skill-twin/skill-twin.module';
import { ReplayController } from './replay.controller';
import { ReplayService } from './replay.service';

/**
 * Phase 8 · Learning Replay — a narrated post-activity recap built from the Proof-of-Learning Ledger
 * (what you did) and the Skill Twin (where you are, what you struggled with, what's next). Read-only.
 */
@Module({
  imports: [LedgerModule, SkillTwinModule],
  controllers: [ReplayController],
  providers: [ReplayService],
  exports: [ReplayService],
})
export class ReplayModule {}
