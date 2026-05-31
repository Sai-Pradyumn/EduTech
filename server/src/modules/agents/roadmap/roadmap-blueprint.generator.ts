import {
  CareerTarget,
  Difficulty,
  LearningStyle,
  SkillLevel,
  TargetTimeline,
  TimePerDay,
} from '../../../common/enums';
import {
  GeneratedRoadmap,
  RoadmapAssessment,
  RoadmapMilestone,
  RoadmapWeek,
} from '../../roadmap/types/generated-roadmap.types';
import { matchTrack, Track } from './roadmap-tracks';

export interface RoadmapBlueprintInput {
  fullName: string;
  mainGoal: string;
  currentSkillLevel: SkillLevel;
  currentSkills: string[];
  weakAreas: string[];
  availableTimePerDay: TimePerDay;
  targetTimeline: TargetTimeline;
  preferredLearningStyle: LearningStyle;
  careerTarget: CareerTarget;
}

const WEEKS_BY_TIMELINE: Record<TargetTimeline, number> = {
  [TargetTimeline.OneMonth]: 4,
  [TargetTimeline.ThreeMonths]: 12,
  [TargetTimeline.SixMonths]: 18,
  [TargetTimeline.TwelveMonths]: 24,
};

const DURATION_LABEL: Record<TargetTimeline, string> = {
  [TargetTimeline.OneMonth]: '1 month',
  [TargetTimeline.ThreeMonths]: '3 months',
  [TargetTimeline.SixMonths]: '6 months',
  [TargetTimeline.TwelveMonths]: '12 months',
};

const TIME_LABEL: Record<TimePerDay, string> = {
  [TimePerDay.HalfHour]: '~30 min/day',
  [TimePerDay.OneHour]: '~1 hour/day',
  [TimePerDay.TwoHours]: '~2 hours/day',
  [TimePerDay.ThreePlusHours]: '3+ hours/day',
};

const DIFFICULTY_BY_SKILL: Record<SkillLevel, `${Difficulty}`> = {
  [SkillLevel.Beginner]: 'beginner',
  [SkillLevel.Intermediate]: 'intermediate',
  [SkillLevel.Advanced]: 'advanced',
};

/** Maps a weak-area keyword to a concrete reinforcement task injected into a week. */
const WEAK_AREA_TASKS: { match: string[]; task: string; practice: string }[] = [
  {
    match: ['dsa', 'data structure', 'algorithm'],
    task: 'Reinforce DSA: solve 5 targeted problems on this week’s topic',
    practice: 'Revisit one previously-failed DSA problem',
  },
  {
    match: ['system design', 'system-design', 'scal'],
    task: 'Sketch a small system design relevant to this week’s topic',
    practice: 'Read one system-design case study',
  },
  {
    match: ['backend', 'api', 'database'],
    task: 'Reinforce backend: add an API/DB feature for this week’s topic',
    practice: 'Refactor one endpoint for clarity',
  },
  {
    match: ['frontend', 'css', 'ui', 'react', 'angular'],
    task: 'Reinforce frontend: rebuild one UI piece for this week’s topic',
    practice: 'Improve responsiveness/accessibility of a component',
  },
  {
    match: ['communication', 'soft skill', 'speaking'],
    task: 'Explain this week’s topic out loud / write a short blog post',
    practice: 'Record a 2-min explanation and review it',
  },
  {
    match: ['deploy', 'devops', 'ci', 'docker'],
    task: 'Reinforce deployment: containerize/deploy this week’s work',
    practice: 'Add one CI/CD improvement',
  },
  {
    match: ['test', 'testing', 'qa'],
    task: 'Write tests covering this week’s code',
    practice: 'Add edge-case tests for one module',
  },
];

function clampPhasesForSkill(track: Track, skill: SkillLevel) {
  // Advanced learners skip pure-fundamentals phase; beginners keep everything.
  if (skill === SkillLevel.Advanced && track.phases.length > 4) {
    return track.phases.slice(1);
  }
  return track.phases;
}

function buildWeeks(
  phases: Track['phases'],
  weekCount: number,
  weakAreas: string[],
): RoadmapWeek[] {
  const weeks: RoadmapWeek[] = [];
  const weakTaskPool = weakAreas
    .map((wa) =>
      WEAK_AREA_TASKS.find((w) =>
        w.match.some((m) => wa.toLowerCase().includes(m)),
      ),
    )
    .filter((w): w is (typeof WEAK_AREA_TASKS)[number] => Boolean(w));
  // Distribute weak-area reinforcement across spaced weeks.
  const weakWeeks = new Set<number>();
  weakTaskPool.forEach((_, i) =>
    weakWeeks.add(Math.min(weekCount - 1, 1 + i * 2)),
  );

  for (let i = 0; i < weekCount; i++) {
    const phaseIndex = Math.min(
      phases.length - 1,
      Math.floor((i * phases.length) / weekCount),
    );
    const phase = phases[phaseIndex];
    // Rotate the topic window so consecutive weeks in the same phase differ.
    const rot = i % phase.topics.length;
    const topics = [
      ...phase.topics.slice(rot),
      ...phase.topics.slice(0, rot),
    ].slice(0, 3);
    const tasks = [...phase.tasks];
    const practiceItems = [...phase.practice];

    if (weakWeeks.has(i)) {
      const wt = weakTaskPool[[...weakWeeks].indexOf(i)] ?? weakTaskPool[0];
      if (wt) {
        tasks.push(wt.task);
        practiceItems.push(wt.practice);
      }
    }

    weeks.push({
      weekNumber: i + 1,
      title: `Week ${i + 1}: ${phase.focus}`,
      focus: phase.focus,
      topics,
      tasks,
      practiceItems,
      expectedOutcome: phase.outcome,
    });
  }
  return weeks;
}

function buildMilestones(
  weeks: RoadmapWeek[],
  track: Track,
): RoadmapMilestone[] {
  const n = weeks.length;
  const at = (frac: number) => Math.max(1, Math.round(n * frac));
  const focusAt = (week: number) =>
    weeks[Math.min(n, week) - 1]?.focus ?? track.label;
  return [
    {
      title: 'Foundations locked in',
      description: `Complete the early phases up to "${focusAt(at(0.25))}".`,
      targetWeek: at(0.25),
      completionCriteria: [
        'Finish all weekly tasks so far',
        'Pass the first checkpoint quiz',
      ],
    },
    {
      title: 'Core competency',
      description: `Reach working competency around "${focusAt(at(0.5))}".`,
      targetWeek: at(0.5),
      completionCriteria: [
        'Ship the mid-track project',
        'Score 70%+ on the mid assessment',
      ],
    },
    {
      title: 'Advanced & applied',
      description: `Handle advanced topics up to "${focusAt(at(0.75))}".`,
      targetWeek: at(0.75),
      completionCriteria: [
        'Complete advanced weekly tasks',
        'Extend your project with an advanced feature',
      ],
    },
    {
      title: 'Job/goal ready',
      description: `Finish the track and a capstone for "${track.label}".`,
      targetWeek: n,
      completionCriteria: [
        'Ship the capstone project',
        'Pass the final assessment / mock interview',
      ],
    },
  ];
}

function buildAssessments(
  weekCount: number,
  career: CareerTarget,
): RoadmapAssessment[] {
  const out: RoadmapAssessment[] = [];
  const step = weekCount <= 6 ? 2 : weekCount <= 12 ? 3 : 4;
  for (let w = step; w < weekCount; w += step) {
    out.push({
      title: `Checkpoint Quiz — Week ${w}`,
      week: w,
      type: 'quiz',
      description:
        'A short quiz on the topics covered since the last checkpoint.',
    });
  }
  out.push({
    title: 'Mid-track Project Review',
    week: Math.max(2, Math.round(weekCount / 2)),
    type: 'project',
    description: 'Submit and review your mid-track project.',
  });
  const interviewCareers: CareerTarget[] = [
    CareerTarget.Internship,
    CareerTarget.FullTime,
  ];
  out.push({
    title: interviewCareers.includes(career)
      ? 'Mock Interview'
      : 'Final Assignment',
    week: weekCount,
    type: interviewCareers.includes(career) ? 'interview' : 'assignment',
    description: interviewCareers.includes(career)
      ? 'A mock interview covering technical and behavioral rounds.'
      : 'A capstone assignment consolidating the whole track.',
  });
  return out.sort((a, b) => a.week - b.week);
}

function buildDailyPlan(track: Track, time: TimePerDay): string[] {
  const plan = [...track.dailyPlan];
  if (time === TimePerDay.HalfHour)
    return ['Focus on one concept (15 min)', 'One hands-on exercise (15 min)'];
  if (time === TimePerDay.ThreePlusHours)
    plan.push(
      'Extra: build/extend your project (45 min)',
      'Optional: read docs or solve a bonus problem',
    );
  return plan;
}

function buildTips(track: Track, input: RoadmapBlueprintInput): string[] {
  const tips = [...track.tips];
  const styleTip: Record<LearningStyle, string> = {
    [LearningStyle.Video]:
      'Pair each video with immediately building the thing you watched.',
    [LearningStyle.Reading]:
      'Turn what you read into a tiny code experiment the same day.',
    [LearningStyle.Project]:
      'Keep one project growing — fold every new topic into it.',
    [LearningStyle.Practice]:
      'Bias toward problems and reps; theory follows practice.',
    [LearningStyle.Mixed]:
      'Alternate watch/read with build/practice to stay engaged.',
  };
  tips.push(styleTip[input.preferredLearningStyle]);
  if (input.weakAreas.length) {
    tips.push(
      `Give extra reps to your weak areas: ${input.weakAreas.slice(0, 3).join(', ')}.`,
    );
  }
  return tips;
}

/**
 * Pure, deterministic roadmap generator. Output varies by goal, skill level,
 * weak areas, timeline, time/day, learning style and career target.
 * Reused by the Roadmap Agent (runtime) and the seed script.
 */
export function buildRoadmapBlueprint(
  input: RoadmapBlueprintInput,
): GeneratedRoadmap {
  const track = matchTrack(input.mainGoal);
  const weekCount = WEEKS_BY_TIMELINE[input.targetTimeline];
  const phases = clampPhasesForSkill(track, input.currentSkillLevel);
  const weeks = buildWeeks(phases, weekCount, input.weakAreas);
  const difficulty = DIFFICULTY_BY_SKILL[input.currentSkillLevel];

  const skillsNote = input.currentSkills.length
    ? ` You already know ${input.currentSkills.slice(0, 4).join(', ')}, so early weeks move briskly.`
    : '';

  return {
    title: `${track.label} — ${DURATION_LABEL[input.targetTimeline]} Roadmap`,
    goal: input.mainGoal,
    overview: `${track.overview} Tailored for a ${difficulty} learner at ${TIME_LABEL[input.availableTimePerDay]} over ${DURATION_LABEL[input.targetTimeline]}.${skillsNote}`,
    estimatedDuration: `${DURATION_LABEL[input.targetTimeline]} · ${TIME_LABEL[input.availableTimePerDay]}`,
    difficulty,
    weeklyPlan: weeks,
    milestones: buildMilestones(weeks, track),
    recommendedProjects: track.projects,
    assessmentPlan: buildAssessments(weekCount, input.careerTarget),
    dailyStudyPlan: buildDailyPlan(track, input.availableTimePerDay),
    successTips: buildTips(track, input),
  };
}
