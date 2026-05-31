import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Difficulty, Role } from '../../common/enums';
import { AgentOrchestratorService } from '../agents/agent-orchestrator.service';
import { MistakesService } from '../mistakes/mistakes.service';
import { FlowsService } from '../flows/flows.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  Simulation,
  SimulationDocument,
  SimulationType,
} from './schemas/simulation.schema';
import { SIM_BLUEPRINTS, scoreSimulation } from './simulation-coach';
import { StartSimulationDto } from './dto/simulation.dto';

@Injectable()
export class SimulationsService {
  constructor(
    @InjectModel(Simulation.name)
    private readonly model: Model<SimulationDocument>,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly mistakes: MistakesService,
    private readonly flows: FlowsService,
    private readonly ledger: LedgerService,
  ) {}

  async start(
    userId: string,
    dto: StartSimulationDto,
  ): Promise<SimulationDocument> {
    const bp = SIM_BLUEPRINTS[dto.type];
    const topic = dto.topic.trim();
    const scenario = bp.scenario(topic);
    return this.model.create({
      user: new Types.ObjectId(userId),
      type: dto.type,
      topic,
      difficulty: dto.difficulty ?? Difficulty.Intermediate,
      role: bp.role,
      scenario,
      rubric: bp.rubric.map((c) => ({ criterion: c, weight: 1, score: 0 })),
      transcript: [{ role: 'coach', text: scenario, at: new Date() }],
      status: 'active',
    });
  }

  list(userId: string): Promise<SimulationDocument[]> {
    return this.model
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async get(userId: string, id: string): Promise<SimulationDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Simulation not found');
    const s = await this.model.findById(id).exec();
    if (!s || s.user.toString() !== userId)
      throw new NotFoundException('Simulation not found');
    return s;
  }

  async respond(
    userId: string,
    role: Role,
    id: string,
    message: string,
  ): Promise<SimulationDocument> {
    const sim = await this.get(userId, id);
    if (sim.status === 'finished')
      throw new NotFoundException('Simulation already finished');
    const bp = SIM_BLUEPRINTS[sim.type];
    sim.transcript.push({ role: 'user', text: message, at: new Date() });
    const result = await this.orchestrator.handle({
      userId,
      role,
      message: bp.frame(sim.topic, message),
      agentType: bp.agent,
      source: 'voice',
    });
    const reply = this.clean(result.response.answer);
    sim.transcript.push({ role: 'coach', text: reply, at: new Date() });
    sim.markModified('transcript');
    return sim.save();
  }

  async finish(userId: string, id: string): Promise<SimulationDocument> {
    const sim = await this.get(userId, id);
    const userTurns = sim.transcript
      .filter((t) => t.role === 'user')
      .map((t) => t.text);
    const { score, perCriterion } = scoreSimulation(userTurns);
    sim.score = score;
    sim.rubric = sim.rubric.map((c) => ({ ...c, score: perCriterion }));
    sim.feedback = this.feedback(sim.type, score, userTurns.length);
    sim.improvementPlan = sim.rubric
      .filter((c) => c.score < 70)
      .map((c) => `Strengthen "${c.criterion}" on ${sim.topic}.`);
    if (!sim.improvementPlan.length)
      sim.improvementPlan = [
        `Try a harder ${sim.type.replace('_', ' ')} on a new topic.`,
      ];
    sim.linkedSkills = [sim.topic];
    sim.status = 'finished';
    sim.markModified('rubric');
    await this.ledger.record(userId, {
      kind: 'simulation_finished',
      title: `Finished ${sim.type.replace('_', ' ')}: ${sim.topic}`,
      detail: `Scored ${score}/100.`,
      score,
      evidenceRef: String(sim._id),
    });

    // Below-bar performance feeds Mistake OS so the gap is tracked + repairable.
    if (score < 60) {
      try {
        const m = await this.mistakes.captureManual(userId, {
          concept: sim.topic,
          severity: 100 - score,
          source: 'manual',
        });
        sim.linkedMistakeIds = [String(m._id)];
      } catch {
        /* best-effort */
      }
    }
    return sim.save();
  }

  async retry(
    userId: string,
    id: string,
    harder?: boolean,
  ): Promise<SimulationDocument> {
    const prev = await this.get(userId, id);
    const order: Difficulty[] = [
      Difficulty.Beginner,
      Difficulty.Intermediate,
      Difficulty.Advanced,
    ];
    const idx = order.indexOf(prev.difficulty);
    const next = harder
      ? order[Math.min(idx + 1, 2)]
      : order[Math.max(idx - 1, 0)];
    return this.start(userId, {
      type: prev.type,
      topic: prev.topic,
      difficulty: next,
    });
  }

  /** Add a repair node for this simulation's topic to the active flow (or note none). */
  async createRepairFlow(
    userId: string,
    id: string,
  ): Promise<{
    simulation: SimulationDocument;
    flowId: string | null;
    nodeId: string | null;
  }> {
    const sim = await this.get(userId, id);
    const active = await this.flows.findActive(userId);
    if (!active) return { simulation: sim, flowId: null, nodeId: null };
    const { flow, nodeId } = await this.flows.addRepairNode(
      userId,
      String(active._id),
      sim.topic,
    );
    sim.linkedFlowId = String(flow._id);
    await sim.save();
    return { simulation: sim, flowId: String(flow._id), nodeId };
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const sim = await this.get(userId, id);
    await sim.deleteOne();
    return { ok: true };
  }

  private feedback(type: SimulationType, score: number, turns: number): string {
    const band = score >= 80 ? 'Strong' : score >= 60 ? 'Solid' : 'Needs work';
    return `${band} performance (${score}/100) across ${turns} response(s) in this ${type.replace('_', ' ')}. ${
      score >= 80
        ? 'Keep this level and raise the difficulty.'
        : score >= 60
          ? 'Tighten the weaker rubric areas and retry.'
          : 'Repair the fundamentals, then retry at an easier level.'
    }`;
  }

  private clean(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, ' (code) ')
      .replace(/[#*_>`~|]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 800);
  }
}
