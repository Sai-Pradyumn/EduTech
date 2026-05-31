import { Difficulty } from '../../common/enums';
import { CourseModule, CourseProject } from './schemas/course.schema';

/** Curated module backbones for common goals (keeps deterministic courses intelligent). */
const TRACKS: { match: RegExp; modules: string[]; project: string }[] = [
  {
    match: /mern|full[\s-]?stack|react|node/i,
    modules: [
      'JavaScript foundations',
      'React fundamentals',
      'State & data fetching',
      'Node & Express APIs',
      'MongoDB & Mongoose',
      'Auth, testing & deploy',
    ],
    project: 'Build a full-stack MERN app with auth and deployment.',
  },
  {
    match: /dsa|algorithm|interview/i,
    modules: [
      'Complexity & arrays',
      'Hashing & two pointers',
      'Recursion & trees',
      'Graphs',
      'Dynamic programming',
      'Mock interviews',
    ],
    project: 'Complete a timed mock-interview problem set.',
  },
  {
    match: /system design|architecture/i,
    modules: [
      'Fundamentals',
      'Caching & load balancing',
      'Databases & sharding',
      'Queues & async',
      'Designing for scale',
      'Design reviews',
    ],
    project: 'Design and document a scalable system end-to-end.',
  },
  {
    match: /python|data science|ml|machine learning/i,
    modules: [
      'Python essentials',
      'Data wrangling',
      'Visualization',
      'Core ML models',
      'Evaluation',
      'A capstone notebook',
    ],
    project: 'Ship a notebook that trains and evaluates a model.',
  },
];

function genericModules(subject: string): string[] {
  return [
    `Foundations of ${subject}`,
    `Core concepts`,
    `Hands-on practice`,
    `Advanced ${subject}`,
    `Real-world application`,
  ];
}

/** Build modules + lessons + a project + certificate criteria from a goal (offline-safe). */
export function buildCourseBlueprint(
  goal: string,
  level: Difficulty,
  outline?: string,
): {
  title: string;
  description: string;
  modules: CourseModule[];
  project: CourseProject;
  certificateCriteria: string[];
} {
  const subject =
    goal.replace(/^(learn|master|teach|build|create)\s+/i, '').trim() ||
    'the subject';
  const track = TRACKS.find((t) => t.match.test(goal));
  const titles = outline
    ? outline
        .split(/\n|,|;/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10)
    : track
      ? track.modules
      : genericModules(subject);

  const modules: CourseModule[] = titles.map((title, i) => {
    const id = `m_${i}`;
    const lessons = [
      {
        id: `${id}_l0`,
        title: `${title}: concepts`,
        content: `Introduce ${title.toLowerCase()} with definitions and a worked example.`,
        estimateMinutes: 25,
      },
      {
        id: `${id}_l1`,
        title: `${title}: practice`,
        content: `Guided practice applying ${title.toLowerCase()}.`,
        estimateMinutes: 30,
      },
      {
        id: `${id}_l2`,
        title: `${title}: pitfalls & recap`,
        content: `Common mistakes in ${title.toLowerCase()} and a quick recap.`,
        estimateMinutes: 15,
      },
    ];
    return {
      id,
      title,
      summary: `Understand and apply ${title.toLowerCase()}.`,
      lessons,
      voiceScript: `In this module we cover ${title.toLowerCase()}. We start with the core idea, work an example, then practice and review the common pitfalls.`,
    };
  });

  return {
    title: titleCase(subject),
    description: `A ${level} course on ${subject}: ${titles.length} modules from foundations to a capstone project, with quizzes, visuals and a voice overview per module.`,
    modules,
    project: {
      title: `Capstone: apply ${subject}`,
      brief: track
        ? track.project
        : `Build a project that demonstrates ${subject} end-to-end.`,
    },
    certificateCriteria: [
      'Complete every module',
      'Pass each module quiz (70%+)',
      'Submit the capstone project',
    ],
  };
}

function titleCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
