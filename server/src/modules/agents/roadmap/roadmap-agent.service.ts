import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { AgentType } from '../../../common/enums';
import { AiService } from '../../ai/ai.service';
import { AIMessage } from '../../ai/interfaces/ai-provider.interface';
import { GeneratedRoadmap } from '../../roadmap/types/generated-roadmap.types';
import {
  buildRoadmapBlueprint,
  RoadmapBlueprintInput,
} from './roadmap-blueprint.generator';

/** JSON schema handed to real providers; the mock uses the local blueprint factory. */
const ROADMAP_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['title', 'goal', 'overview', 'weeklyPlan', 'milestones'],
  properties: {
    title: { type: 'string' },
    goal: { type: 'string' },
    overview: { type: 'string' },
    estimatedDuration: { type: 'string' },
    difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
    weeklyPlan: { type: 'array' },
    milestones: { type: 'array' },
    recommendedProjects: { type: 'array' },
    assessmentPlan: { type: 'array' },
    dailyStudyPlan: { type: 'array' },
    successTips: { type: 'array' },
  },
};

@Injectable()
export class RoadmapAgentService {
  readonly type = AgentType.Roadmap;
  private readonly logger = new Logger(RoadmapAgentService.name);

  constructor(private readonly ai: AiService) {}

  /** Generate a structured, personalized roadmap for a student. */
  async generate(userId: string, input: RoadmapBlueprintInput): Promise<GeneratedRoadmap> {
    const startedAt = Date.now();
    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt() },
      { role: 'user', content: this.userPrompt(input) },
    ];

    let roadmap: GeneratedRoadmap;
    try {
      roadmap = await this.ai.generateStructuredOutput<GeneratedRoadmap>(messages, ROADMAP_SCHEMA, {
        // Mock provider returns this; real providers honor the schema instead.
        mockFactory: () => buildRoadmapBlueprint(input),
      });
    } catch (err) {
      this.logger.error(`Roadmap generation failed: ${(err as Error).message}`);
      // Safe fallback so the flow never dead-ends in dev.
      roadmap = buildRoadmapBlueprint(input);
    }

    if (!this.isValid(roadmap)) {
      this.logger.warn('AI roadmap output failed validation — using local blueprint fallback.');
      roadmap = buildRoadmapBlueprint(input);
      if (!this.isValid(roadmap)) {
        throw new InternalServerErrorException('Could not generate a valid roadmap. Please try again.');
      }
    }

    await this.ai.logUsage({
      userId,
      agentType: this.type,
      operation: 'structured',
      tokensIn: messages.reduce((s, m) => s + m.content.length, 0),
      tokensOut: JSON.stringify(roadmap).length,
      latencyMs: Date.now() - startedAt,
    });

    return roadmap;
  }

  private isValid(r: GeneratedRoadmap | undefined): boolean {
    return Boolean(
      r &&
        typeof r.title === 'string' &&
        r.title.length > 0 &&
        Array.isArray(r.weeklyPlan) &&
        r.weeklyPlan.length > 0 &&
        Array.isArray(r.milestones) &&
        r.milestones.length > 0,
    );
  }

  private systemPrompt(): string {
    return [
      'You are Asta\'s Roadmap Agent. Produce a structured, realistic, week-by-week learning roadmap.',
      'Personalize to the student\'s skill level, weak areas, available time, timeline and career target.',
      'Return strictly the GeneratedRoadmap JSON shape. Be concrete; avoid vague filler.',
    ].join(' ');
  }

  private userPrompt(i: RoadmapBlueprintInput): string {
    return JSON.stringify({
      goal: i.mainGoal,
      skillLevel: i.currentSkillLevel,
      currentSkills: i.currentSkills,
      weakAreas: i.weakAreas,
      timePerDay: i.availableTimePerDay,
      timeline: i.targetTimeline,
      learningStyle: i.preferredLearningStyle,
      careerTarget: i.careerTarget,
    });
  }
}
