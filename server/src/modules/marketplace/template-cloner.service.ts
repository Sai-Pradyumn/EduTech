import { Injectable, Logger } from '@nestjs/common';
import { Difficulty } from '../../common/enums';
import { FlowsService } from '../flows/flows.service';
import { RoadmapService } from '../roadmap/roadmap.service';
import { AssessmentService } from '../assessment/services/assessment.service';
import { ProjectsService } from '../projects/services/projects.service';
import { VisualsService } from '../visuals/visuals.service';
import { CourseBuilderService } from '../course-builder/course-builder.service';
import {
  VISUAL_TYPES,
  VisualType,
} from '../visuals/schemas/visual-asset.schema';
import { MarketplaceTemplateDocument } from './schemas/marketplace-template.schema';

export interface CloneResult {
  /** A real personal asset was generated (vs. seeding a create screen). */
  created: boolean;
  assetId: string | null;
  /** Deep link to open the result. */
  route: string;
  /** Prefill for live-session types that have no one-shot generator. */
  queryParams?: Record<string, string>;
}

/**
 * Turns a published marketplace template into a REAL personal asset for the
 * consumer — it runs the same generation pipeline that asset's own screen uses,
 * seeded from the template's goal/topic/concept. Live-session types
 * (simulation/interview/study_space) have no one-shot generator, so they route
 * to their create screen with the goal pre-filled — an honest "start from this
 * template", never the old silent no-op that only bumped a usage counter.
 */
@Injectable()
export class TemplateClonerService {
  private readonly logger = new Logger(TemplateClonerService.name);

  constructor(
    private readonly flows: FlowsService,
    private readonly roadmaps: RoadmapService,
    private readonly assessment: AssessmentService,
    private readonly projects: ProjectsService,
    private readonly visuals: VisualsService,
    private readonly courses: CourseBuilderService,
  ) {}

  async clone(
    userId: string,
    t: MarketplaceTemplateDocument,
  ): Promise<CloneResult> {
    const seed = (k: string): string => {
      const v = (t.content ?? {})[k];
      return typeof v === 'string' ? v.trim() : '';
    };
    const goal = seed('goal') || t.title;

    switch (t.type) {
      case 'flow': {
        const f = await this.flows.generate(userId, { goal });
        return this.opened(String(f._id), '/app/flows');
      }
      case 'roadmap': {
        const r = await this.roadmaps.generate(userId, { goal });
        // The active-roadmap view always shows the newest (generate makes it active).
        return { created: true, assetId: String(r._id), route: '/app/roadmap' };
      }
      case 'quiz': {
        const q = await this.assessment.generate(userId, {
          source: 'topic',
          topic: (seed('topic') || t.title).slice(0, 110),
          difficulty: this.difficulty(t.level),
        });
        return { created: true, assetId: String(q._id), route: '/app/quizzes' };
      }
      case 'project': {
        const p = await this.projects.generate(userId, {
          goal: goal.slice(0, 160),
          difficulty: this.difficulty(t.level),
        });
        return {
          created: true,
          assetId: String(p._id),
          route: '/app/projects',
        };
      }
      case 'visual': {
        const v = await this.visuals.generate(userId, {
          concept: (seed('concept') || t.title).slice(0, 200),
          type: this.visualType(seed('visualType')),
          level: this.levelWord(t.level),
        });
        return this.opened(String(v._id), '/app/visuals');
      }
      case 'course': {
        const c = await this.courses.generate(userId, {
          goal: goal.slice(0, 160),
          level: this.difficulty(t.level),
          audience: seed('audience') || undefined,
        });
        return this.opened(String(c._id), '/app/course-builder');
      }
      // Live-session types: no one-shot asset generator — seed the create screen.
      case 'simulation':
        return this.prefill('/app/simulations', goal);
      case 'interview':
        return this.prefill('/app/interview', goal);
      case 'study_space':
        return this.prefill('/app/spaces', goal);
      default:
        return { created: false, assetId: null, route: '/app/dashboard' };
    }
  }

  private opened(id: string, base: string): CloneResult {
    return { created: true, assetId: id, route: `${base}/${id}` };
  }

  private prefill(route: string, goal: string): CloneResult {
    return {
      created: false,
      assetId: null,
      route,
      queryParams: { from: 'template', goal: goal.slice(0, 160) },
    };
  }

  private difficulty(level: string): Difficulty {
    return level === 'advanced'
      ? Difficulty.Advanced
      : level === 'intermediate'
        ? Difficulty.Intermediate
        : Difficulty.Beginner;
  }

  private levelWord(level: string): 'beginner' | 'intermediate' | 'advanced' {
    return level === 'advanced'
      ? 'advanced'
      : level === 'intermediate'
        ? 'intermediate'
        : 'beginner';
  }

  private visualType(v: string): VisualType {
    return (VISUAL_TYPES as readonly string[]).includes(v)
      ? (v as VisualType)
      : 'mind_map';
  }
}
