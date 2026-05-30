import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Difficulty, ItemStatus } from '../../../common/enums';
import { ARCHETYPES, GENERIC, inferStack, matchArchetype } from '../project-bank';

export interface BlueprintTask {
  id: string;
  title: string;
  description: string;
  status: ItemStatus;
  order: number;
  phase: string;
  estimateHours: number;
}
export interface BlueprintMilestone {
  title: string;
  description: string;
  criteria: string[];
  reached: boolean;
}
export interface Blueprint {
  title: string;
  summary: string;
  techStack: string[];
  features: string[];
  learningGoals: string[];
  estimatedWeeks: number;
  tasks: BlueprintTask[];
  milestones: BlueprintMilestone[];
}

const WEEKS: Record<Difficulty, number> = {
  [Difficulty.Beginner]: 2,
  [Difficulty.Intermediate]: 4,
  [Difficulty.Advanced]: 6,
};

/**
 * Builds a full project blueprint (tech stack, features, phased Kanban tasks, milestones,
 * learning goals) deterministically from a goal + the student's skills/difficulty — no AI
 * key needed. Known archetypes (todo / chat / e-commerce / blog / API / dashboard) get
 * tailored cores; anything else uses a solid generic scaffold. Difficulty adds phases
 * (auth, testing, CI/CD).
 */
@Injectable()
export class ProjectBlueprintGenerator {
  generate(goal: string, skills: string[], difficulty: Difficulty): Blueprint {
    const arch = matchArchetype(goal);
    const { stack, language } = inferStack(goal, skills);
    const isKnown = arch !== GENERIC;
    const title = arch.title(goal);

    const phases = this.phases(difficulty);
    const tasks: BlueprintTask[] = [];
    let order = 0;
    const push = (phase: string, title: string, description: string, hours = 3): void => {
      tasks.push({ id: randomUUID(), title, description, status: ItemStatus.Todo, order: order++, phase, estimateHours: hours });
    };

    // Setup phase.
    push('Setup', `Scaffold the ${stack[0]} + ${stack[1]} project`, `Initialize the repo, ${language} tooling, and a running dev server.`, 2);
    push('Setup', 'Define the data model & API contract', 'Sketch entities, routes and the response shape before coding.', 2);

    // Core phase — from the archetype.
    for (const t of arch.coreTasks) push('Core features', t.title, t.description, 4);

    // Conditional phases by difficulty.
    if (phases.includes('Data & state')) {
      push('Data & state', 'Wire persistent storage + loading/error states', `Connect ${stack[2]} and handle async UI states.`, 3);
    }
    if (phases.includes('Auth')) {
      push('Auth', 'Add authentication & protected routes', 'JWT (or session) auth with guards on the API and UI.', 4);
    }
    push('Polish', 'Empty states, validation & responsive layout', 'Make it robust and good on mobile.', 3);
    if (phases.includes('Testing')) {
      push('Testing', 'Write tests for the core flow', 'Unit + a couple of integration tests for the happy path and edge cases.', 3);
    }
    if (phases.includes('CI/CD')) {
      push('CI/CD', 'Set up CI + automated deploy', 'Lint/test on push and deploy on green.', 3);
    }
    push('Deploy', 'Deploy + write the README', 'Ship it publicly and document setup, decisions and a demo link.', 2);

    const milestones = this.milestones(arch.features, difficulty);
    const estimatedWeeks = WEEKS[difficulty];

    return {
      title,
      summary: `A ${difficulty} ${isKnown ? title.toLowerCase() : 'project'} built with ${stack.join(' · ')}. ${
        isKnown ? 'Covers the real-world features an interviewer expects.' : 'Scoped to ship a portfolio-worthy build.'
      } Plan: ~${estimatedWeeks} weeks across ${phases.length} phases.`,
      techStack: stack,
      features: arch.features,
      learningGoals: arch.learningGoals,
      estimatedWeeks,
      tasks,
      milestones,
    };
  }

  private phases(difficulty: Difficulty): string[] {
    if (difficulty === Difficulty.Advanced) {
      return ['Setup', 'Core features', 'Data & state', 'Auth', 'Polish', 'Testing', 'CI/CD', 'Deploy'];
    }
    if (difficulty === Difficulty.Intermediate) {
      return ['Setup', 'Core features', 'Data & state', 'Polish', 'Testing', 'Deploy'];
    }
    return ['Setup', 'Core features', 'Polish', 'Deploy'];
  }

  private milestones(features: string[], difficulty: Difficulty): BlueprintMilestone[] {
    const ms: BlueprintMilestone[] = [
      { title: 'Walking skeleton', description: 'Project runs end-to-end with one feature working.', criteria: ['Dev server runs', 'One core feature works end-to-end'], reached: false },
      { title: 'Feature complete', description: 'All core features built.', criteria: features.slice(0, 3).map((f) => `${f} done`), reached: false },
      { title: 'Shipped', description: 'Deployed, documented and demo-ready.', criteria: ['Deployed publicly', 'README + demo link', difficulty !== Difficulty.Beginner ? 'Tests passing' : 'Manual QA done'], reached: false },
    ];
    return ms;
  }
}
