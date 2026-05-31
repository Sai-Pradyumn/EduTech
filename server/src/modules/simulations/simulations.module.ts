import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { MistakesModule } from '../mistakes/mistakes.module';
import { FlowsModule } from '../flows/flows.module';
import { LedgerModule } from '../ledger/ledger.module';
import { Simulation, SimulationSchema } from './schemas/simulation.schema';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';

/**
 * Phase 8 · Simulation Labs — rubric-scored practice (interview / viva / debugging / system-design /
 * teaching-back / …). Each round runs through the Agent OS; finishing scores against a rubric, writes
 * an improvement plan, and (when below bar) feeds Mistake OS + can add a repair node to the active flow.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Simulation.name, schema: SimulationSchema }]),
    AgentsModule,
    MistakesModule,
    FlowsModule,
    LedgerModule,
  ],
  controllers: [SimulationsController],
  providers: [SimulationsService],
  exports: [SimulationsService],
})
export class SimulationsModule {}
