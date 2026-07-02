import { ResourceKind, ResourceLevel } from './schemas/resource.schema';

export interface CatalogEntry {
  title: string;
  url: string;
  provider: string;
  kind: ResourceKind;
  topics: string[];
  level: ResourceLevel;
  minutes: number;
  free: boolean;
  description: string;
  quality: number;
}

/**
 * The shipped resource catalog — real, reputable, overwhelmingly free resources
 * with honest metadata. Seeded idempotently when the collection is empty;
 * admins can extend/curate it in the DB afterwards.
 */
export const RESOURCE_CATALOG: CatalogEntry[] = [
  // ── Web fundamentals ──────────────────────────────────────────────
  {
    title: 'MDN Web Docs — Learn web development',
    url: 'https://developer.mozilla.org/en-US/docs/Learn',
    provider: 'MDN',
    kind: 'docs',
    topics: ['html', 'css', 'javascript', 'web', 'frontend'],
    level: 'beginner',
    minutes: 0,
    free: true,
    description:
      'The reference for HTML, CSS and JavaScript — structured learning paths straight from Mozilla.',
    quality: 95,
  },
  {
    title: 'The Odin Project — Full Stack JavaScript',
    url: 'https://www.theodinproject.com/paths/full-stack-javascript',
    provider: 'The Odin Project',
    kind: 'course',
    topics: ['javascript', 'node', 'fullstack', 'web', 'projects'],
    level: 'beginner',
    minutes: 6000,
    free: true,
    description:
      'A project-driven full-stack curriculum: you build real apps, not toy exercises.',
    quality: 92,
  },
  {
    title: 'freeCodeCamp — Responsive Web Design',
    url: 'https://www.freecodecamp.org/learn/2022/responsive-web-design/',
    provider: 'freeCodeCamp',
    kind: 'course',
    topics: ['html', 'css', 'frontend', 'responsive'],
    level: 'beginner',
    minutes: 3000,
    free: true,
    description:
      'Certification course: build responsive layouts with hands-on browser exercises.',
    quality: 90,
  },
  {
    title: 'CSS Flexbox Froggy',
    url: 'https://flexboxfroggy.com/',
    provider: 'Codepip',
    kind: 'practice',
    topics: ['css', 'flexbox', 'frontend'],
    level: 'beginner',
    minutes: 45,
    free: true,
    description:
      'Learn flexbox by moving frogs — the fastest way to stop guessing alignment.',
    quality: 85,
  },
  {
    title: 'javascript.info — The Modern JavaScript Tutorial',
    url: 'https://javascript.info/',
    provider: 'javascript.info',
    kind: 'course',
    topics: ['javascript', 'frontend', 'fundamentals'],
    level: 'intermediate',
    minutes: 4000,
    free: true,
    description:
      'Deep, precise JavaScript from basics to advanced (closures, event loop, prototypes).',
    quality: 93,
  },
  // ── Frameworks ────────────────────────────────────────────────────
  {
    title: 'React — Official Learn React',
    url: 'https://react.dev/learn',
    provider: 'React',
    kind: 'docs',
    topics: ['react', 'frontend', 'javascript', 'mern'],
    level: 'beginner',
    minutes: 900,
    free: true,
    description:
      'The official interactive React course: thinking in components, state, effects.',
    quality: 94,
  },
  {
    title: 'Angular — Official Tutorials',
    url: 'https://angular.dev/tutorials',
    provider: 'Angular',
    kind: 'docs',
    topics: ['angular', 'typescript', 'frontend'],
    level: 'beginner',
    minutes: 600,
    free: true,
    description:
      'First-party Angular tutorials on standalone components, signals and routing.',
    quality: 90,
  },
  {
    title: 'TypeScript Handbook',
    url: 'https://www.typescriptlang.org/docs/handbook/intro.html',
    provider: 'TypeScript',
    kind: 'docs',
    topics: ['typescript', 'javascript', 'types'],
    level: 'intermediate',
    minutes: 480,
    free: true,
    description:
      'The canonical guide to the type system — read before you fight the compiler.',
    quality: 92,
  },
  // ── Backend ───────────────────────────────────────────────────────
  {
    title: 'Node.js — Official Learn',
    url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs',
    provider: 'Node.js',
    kind: 'docs',
    topics: ['node', 'backend', 'javascript', 'mern'],
    level: 'beginner',
    minutes: 300,
    free: true,
    description:
      'First-party Node guides: event loop, streams, modules, debugging.',
    quality: 88,
  },
  {
    title: 'Express in Practice (MDN server-side)',
    url: 'https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs',
    provider: 'MDN',
    kind: 'course',
    topics: ['express', 'node', 'backend', 'mern', 'api'],
    level: 'intermediate',
    minutes: 900,
    free: true,
    description:
      'Build a real Express app with routing, middleware, templates and MongoDB.',
    quality: 88,
  },
  {
    title: 'MongoDB University — Intro to MongoDB',
    url: 'https://learn.mongodb.com/learning-paths/introduction-to-mongodb',
    provider: 'MongoDB University',
    kind: 'course',
    topics: ['mongodb', 'database', 'backend', 'mern'],
    level: 'beginner',
    minutes: 600,
    free: true,
    description:
      'Official course: documents, CRUD, indexes, aggregation — with labs.',
    quality: 89,
  },
  {
    title: 'SQLBolt — Interactive SQL lessons',
    url: 'https://sqlbolt.com/',
    provider: 'SQLBolt',
    kind: 'practice',
    topics: ['sql', 'database', 'backend'],
    level: 'beginner',
    minutes: 240,
    free: true,
    description:
      'Learn SQL by writing queries against live tables, one concept at a time.',
    quality: 87,
  },
  {
    title: 'NestJS — Official Documentation',
    url: 'https://docs.nestjs.com/',
    provider: 'NestJS',
    kind: 'docs',
    topics: ['nestjs', 'node', 'typescript', 'backend', 'api'],
    level: 'intermediate',
    minutes: 0,
    free: true,
    description:
      'Modules, DI, guards, pipes — the architecture patterns behind serious Node APIs.',
    quality: 88,
  },
  // ── CS / DSA / interviews ─────────────────────────────────────────
  {
    title: 'CS50x — Introduction to Computer Science',
    url: 'https://cs50.harvard.edu/x/',
    provider: 'Harvard',
    kind: 'course',
    topics: ['computer-science', 'c', 'python', 'fundamentals', 'algorithms'],
    level: 'beginner',
    minutes: 6000,
    free: true,
    description:
      "Harvard's legendary intro: memory, data structures, web — with graded psets.",
    quality: 96,
  },
  {
    title: 'NeetCode 150',
    url: 'https://neetcode.io/practice',
    provider: 'NeetCode',
    kind: 'practice',
    topics: ['dsa', 'algorithms', 'interview', 'leetcode'],
    level: 'intermediate',
    minutes: 4500,
    free: true,
    description:
      'The curated 150 LeetCode problems that cover every interview pattern, with video solutions.',
    quality: 93,
  },
  {
    title: 'LeetCode — Top Interview 150',
    url: 'https://leetcode.com/studyplan/top-interview-150/',
    provider: 'LeetCode',
    kind: 'practice',
    topics: ['dsa', 'algorithms', 'interview'],
    level: 'intermediate',
    minutes: 6000,
    free: true,
    description:
      'The classic interview problem set, organized as a study plan with progress tracking.',
    quality: 90,
  },
  {
    title: 'Grokking behavioral interviews (STAR method guide)',
    url: 'https://www.themuse.com/advice/star-interview-method',
    provider: 'The Muse',
    kind: 'article',
    topics: ['interview', 'behavioral', 'career', 'communication'],
    level: 'beginner',
    minutes: 20,
    free: true,
    description:
      'The STAR structure for behavioral answers — situation, task, action, result.',
    quality: 80,
  },
  {
    title: 'System Design Primer',
    url: 'https://github.com/donnemartin/system-design-primer',
    provider: 'GitHub',
    kind: 'book',
    topics: ['system-design', 'architecture', 'interview', 'scalability'],
    level: 'advanced',
    minutes: 2400,
    free: true,
    description:
      'The most-starred system design study guide: caching, sharding, queues, real designs.',
    quality: 94,
  },
  {
    title: 'Tech Interview Handbook',
    url: 'https://www.techinterviewhandbook.org/',
    provider: 'Tech Interview Handbook',
    kind: 'book',
    topics: ['interview', 'dsa', 'career', 'resume'],
    level: 'intermediate',
    minutes: 900,
    free: true,
    description:
      'End-to-end interview prep: resume, algorithms cheatsheets, behavioral, negotiation.',
    quality: 91,
  },
  // ── Python / data / ML ────────────────────────────────────────────
  {
    title: 'Python — Official Tutorial',
    url: 'https://docs.python.org/3/tutorial/',
    provider: 'Python.org',
    kind: 'docs',
    topics: ['python', 'fundamentals', 'backend'],
    level: 'beginner',
    minutes: 600,
    free: true,
    description:
      'The canonical Python walkthrough, from syntax to classes and the standard library.',
    quality: 90,
  },
  {
    title: 'Kaggle Learn — Intro to Machine Learning',
    url: 'https://www.kaggle.com/learn/intro-to-machine-learning',
    provider: 'Kaggle',
    kind: 'course',
    topics: ['machine-learning', 'python', 'data-science', 'ml'],
    level: 'beginner',
    minutes: 180,
    free: true,
    description:
      'Hands-on notebooks: train your first models on real data in an afternoon.',
    quality: 88,
  },
  {
    title: 'fast.ai — Practical Deep Learning for Coders',
    url: 'https://course.fast.ai/',
    provider: 'fast.ai',
    kind: 'course',
    topics: ['deep-learning', 'machine-learning', 'python', 'ml', 'ai'],
    level: 'intermediate',
    minutes: 3000,
    free: true,
    description:
      'Top-down deep learning: ship working models first, understand the math as you go.',
    quality: 93,
  },
  {
    title: 'Real Python — Learning Paths',
    url: 'https://realpython.com/learning-paths/',
    provider: 'Real Python',
    kind: 'course',
    topics: ['python', 'backend', 'data-science'],
    level: 'intermediate',
    minutes: 0,
    free: false,
    description:
      'Deep, well-edited Python tutorials organized into skill paths (some free).',
    quality: 85,
  },
  // ── Tools & practices ─────────────────────────────────────────────
  {
    title: 'Pro Git (the Git book)',
    url: 'https://git-scm.com/book/en/v2',
    provider: 'git-scm',
    kind: 'book',
    topics: ['git', 'tools', 'collaboration'],
    level: 'beginner',
    minutes: 900,
    free: true,
    description:
      'The complete Git reference — branching finally makes sense after chapter 3.',
    quality: 90,
  },
  {
    title: 'GitHub Skills',
    url: 'https://skills.github.com/',
    provider: 'GitHub',
    kind: 'practice',
    topics: ['git', 'github', 'collaboration', 'ci'],
    level: 'beginner',
    minutes: 300,
    free: true,
    description:
      'Interactive courses that run inside real repos: PRs, reviews, Actions.',
    quality: 86,
  },
  {
    title: 'Docker — Get Started Guide',
    url: 'https://docs.docker.com/get-started/',
    provider: 'Docker',
    kind: 'docs',
    topics: ['docker', 'devops', 'containers', 'deployment'],
    level: 'beginner',
    minutes: 240,
    free: true,
    description:
      'Official hands-on path: images, containers, volumes, compose.',
    quality: 87,
  },
  {
    title: 'Testing JavaScript apps (Jest docs)',
    url: 'https://jestjs.io/docs/getting-started',
    provider: 'Jest',
    kind: 'docs',
    topics: ['testing', 'javascript', 'jest', 'quality'],
    level: 'intermediate',
    minutes: 240,
    free: true,
    description:
      'Matchers, mocks, async tests and coverage — the default JS test stack.',
    quality: 84,
  },
  {
    title: 'roadmap.sh — Developer Roadmaps',
    url: 'https://roadmap.sh/',
    provider: 'roadmap.sh',
    kind: 'tool',
    topics: ['career', 'frontend', 'backend', 'fullstack', 'devops'],
    level: 'beginner',
    minutes: 0,
    free: true,
    description:
      'Community-maintained skill maps for every role — see the whole territory at once.',
    quality: 88,
  },
  {
    title: 'Regexr — learn & test regular expressions',
    url: 'https://regexr.com/',
    provider: 'Regexr',
    kind: 'tool',
    topics: ['regex', 'tools', 'javascript'],
    level: 'intermediate',
    minutes: 60,
    free: true,
    description:
      'Live regex playground with inline explanations of every token you type.',
    quality: 82,
  },
  {
    title: 'web.dev — Learn Performance',
    url: 'https://web.dev/learn/performance',
    provider: 'Google web.dev',
    kind: 'course',
    topics: ['performance', 'web', 'frontend', 'optimization'],
    level: 'advanced',
    minutes: 300,
    free: true,
    description:
      'Core Web Vitals, lazy loading, image strategy — measured, not guessed.',
    quality: 87,
  },
  {
    title: 'OWASP Top 10',
    url: 'https://owasp.org/www-project-top-ten/',
    provider: 'OWASP',
    kind: 'docs',
    topics: ['security', 'web', 'backend'],
    level: 'advanced',
    minutes: 180,
    free: true,
    description:
      'The ten web vulnerability classes every developer is expected to know.',
    quality: 89,
  },
  // ── Career ────────────────────────────────────────────────────────
  {
    title: 'How to write a developer résumé (FAANG-reviewed guide)',
    url: 'https://www.techinterviewhandbook.org/resume/',
    provider: 'Tech Interview Handbook',
    kind: 'article',
    topics: ['resume', 'career', 'interview'],
    level: 'beginner',
    minutes: 40,
    free: true,
    description:
      'Concrete resume structure and wording that passes both ATS and human screens.',
    quality: 86,
  },
  {
    title: 'first-timers-only — your first open-source PR',
    url: 'https://www.firsttimersonly.com/',
    provider: 'first-timers-only',
    kind: 'tool',
    topics: ['open-source', 'career', 'collaboration', 'github'],
    level: 'beginner',
    minutes: 120,
    free: true,
    description:
      'Curated beginner-friendly issues — ship a real open-source contribution this week.',
    quality: 80,
  },
  {
    title: 'Excalidraw — diagram your architecture',
    url: 'https://excalidraw.com/',
    provider: 'Excalidraw',
    kind: 'tool',
    topics: ['system-design', 'tools', 'communication'],
    level: 'beginner',
    minutes: 0,
    free: true,
    description:
      'The whiteboard for system-design practice and portfolio architecture diagrams.',
    quality: 83,
  },
];
