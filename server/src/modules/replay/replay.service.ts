import { Injectable } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { SkillTwinService } from '../skill-twin/skill-twin.service';

export interface LearningReplay {
  generatedAt: string;
  windowDays: number;
  readinessScore: number;
  pace: string;
  modality: { modality: string; reason: string };
  did: { kind: string; title: string; detail: string; at: string }[];
  struggled: { concept: string; severity: number }[];
  nextActions: { label: string; reason: string; route: string }[];
  recapScript: string;
}

/**
 * Learning Replay — a post-activity recap. Reuses the Proof-of-Learning Ledger ("what you did") and the
 * Skill Twin ("where you are / where you struggled / what's next") to produce a short narrated recap.
 */
@Injectable()
export class ReplayService {
  private readonly WINDOW_DAYS = 14;

  constructor(
    private readonly ledger: LedgerService,
    private readonly twin: SkillTwinService,
  ) {}

  async generate(userId: string): Promise<LearningReplay> {
    const [recent, twin] = await Promise.all([
      this.ledger.recent(userId, this.WINDOW_DAYS * 24 * 60 * 60 * 1000, 12),
      this.twin.compute(userId),
    ]);

    const did = recent.map((e) => ({
      kind: e.kind,
      title: e.title,
      detail: e.detail,
      at: e.at.toISOString(),
    }));
    const struggled = twin.weaknessRoots
      .slice(0, 3)
      .map((w) => ({ concept: w.concept, severity: w.severity }));
    const nextActions = twin.nextBestActions
      .slice(0, 3)
      .map((a) => ({ label: a.label, reason: a.reason, route: a.route }));

    return {
      generatedAt: new Date().toISOString(),
      windowDays: this.WINDOW_DAYS,
      readinessScore: twin.readinessScore,
      pace: twin.pace,
      modality: twin.modality,
      did,
      struggled,
      nextActions,
      recapScript: this.script(
        did,
        struggled,
        twin.readinessScore,
        twin.pace,
        nextActions,
        twin.modality.modality,
      ),
    };
  }

  private script(
    did: { title: string }[],
    struggled: { concept: string }[],
    readiness: number,
    pace: string,
    next: { label: string }[],
    modality: string,
  ): string {
    const didLine = did.length
      ? `Here's your recap. Recently you ${did
          .slice(0, 4)
          .map((d) => d.title.toLowerCase())
          .join(', ')}.`
      : `Here's your recap. It's been quiet lately — a good moment to restart.`;
    const struggleLine = struggled.length
      ? ` You're still wrestling with ${struggled.map((s) => s.concept).join(' and ')}.`
      : ` No major sticking points right now — nice.`;
    const stateLine = ` Your readiness is ${readiness} out of 100 and you're on a ${pace} pace.`;
    const nextLine = next[0]
      ? ` Best next move: ${next[0].label.toLowerCase()}. Asta suggests learning by ${modality} right now.`
      : '';
    return `${didLine}${struggleLine}${stateLine}${nextLine} That's your three-minute recap — keep going.`;
  }
}
