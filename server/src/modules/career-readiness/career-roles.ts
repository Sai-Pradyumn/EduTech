/**
 * Phase 9 · Career Readiness — the role catalog. A static, deterministic rubric so readiness is
 * explainable and works offline (no paid keys). Each role declares the skills, project, interview
 * and portfolio expectations Asta measures the learner against, plus a weighted readiness rubric.
 */

export type RoleLevel = 'intern' | 'fresher' | 'junior' | 'mid' | 'senior';

export interface RequiredSkill {
  /** Canonical skill name (matched loosely against the learner's mastery graph). */
  name: string;
  /** Target mastery 0–100 the role expects. */
  target: number;
  /** Relative weight inside the skills dimension. */
  weight: number;
}

export interface ReadinessRubric {
  skills: number;
  projects: number;
  interview: number;
  consistency: number;
  portfolio: number;
}

export interface CareerRole {
  id: string;
  title: string;
  level: RoleLevel;
  summary: string;
  requiredSkills: RequiredSkill[];
  optionalSkills: string[];
  projectExpectations: { minProjects: number; note: string };
  interviewExpectations: string[];
  portfolioExpectations: string[];
  /** Weights sum to 1.0 — how much each dimension counts toward readiness. */
  readinessRubric: ReadinessRubric;
}

const RUBRIC_BALANCED: ReadinessRubric = {
  skills: 0.4,
  projects: 0.25,
  interview: 0.15,
  consistency: 0.1,
  portfolio: 0.1,
};

export const CAREER_ROLES: CareerRole[] = [
  {
    id: 'full-stack-developer',
    title: 'Full Stack Developer',
    level: 'fresher',
    summary:
      'Build and ship end-to-end web apps across frontend, backend and database.',
    requiredSkills: [
      { name: 'JavaScript', target: 80, weight: 1.2 },
      { name: 'React', target: 78, weight: 1.1 },
      { name: 'Node', target: 75, weight: 1.1 },
      { name: 'Databases', target: 70, weight: 1 },
      { name: 'REST API design', target: 72, weight: 1 },
      { name: 'Git', target: 70, weight: 0.7 },
    ],
    optionalSkills: ['TypeScript', 'Docker', 'CI/CD', 'Testing'],
    projectExpectations: {
      minProjects: 2,
      note: 'At least one full-stack CRUD app with auth and a deployed demo.',
    },
    interviewExpectations: [
      'JS fundamentals',
      'A framework deep-dive',
      'API + DB design',
      'One behavioral round',
    ],
    portfolioExpectations: [
      '2+ deployed projects',
      'GitHub with READMEs',
      'A skills/proof profile',
    ],
    readinessRubric: RUBRIC_BALANCED,
  },
  {
    id: 'mern-developer',
    title: 'MERN Developer',
    level: 'fresher',
    summary: 'Specialise in the MongoDB · Express · React · Node stack.',
    requiredSkills: [
      { name: 'JavaScript', target: 80, weight: 1.2 },
      { name: 'React', target: 80, weight: 1.2 },
      { name: 'Node', target: 78, weight: 1.1 },
      { name: 'Express', target: 72, weight: 1 },
      { name: 'MongoDB', target: 72, weight: 1 },
      { name: 'REST API design', target: 72, weight: 0.9 },
    ],
    optionalSkills: ['Redux', 'JWT auth', 'Deployment', 'Mongoose'],
    projectExpectations: {
      minProjects: 2,
      note: 'A full MERN app with auth, CRUD and a hosted demo.',
    },
    interviewExpectations: [
      'React + hooks',
      'Node/Express internals',
      'MongoDB modeling',
      'Project deep-dive',
    ],
    portfolioExpectations: [
      'A flagship MERN project',
      'Live demo + repo',
      'Skill Passport published',
    ],
    readinessRubric: RUBRIC_BALANCED,
  },
  {
    id: 'java-full-stack-developer',
    title: 'Java Full Stack Developer',
    level: 'fresher',
    summary: 'Java/Spring backends with a modern JS frontend.',
    requiredSkills: [
      { name: 'Java', target: 80, weight: 1.2 },
      { name: 'Spring Boot', target: 75, weight: 1.1 },
      { name: 'SQL', target: 72, weight: 1 },
      { name: 'REST API design', target: 72, weight: 1 },
      { name: 'JavaScript', target: 65, weight: 0.8 },
      { name: 'Data structures', target: 70, weight: 0.9 },
    ],
    optionalSkills: ['Hibernate', 'Microservices', 'Docker', 'Angular'],
    projectExpectations: {
      minProjects: 2,
      note: 'A Spring Boot REST service with a JS frontend and a database.',
    },
    interviewExpectations: [
      'Core Java + OOP',
      'Spring fundamentals',
      'SQL + JPA',
      'DSA basics',
    ],
    portfolioExpectations: [
      'A Spring Boot project',
      'Clean repo + docs',
      'Deployed API',
    ],
    readinessRubric: RUBRIC_BALANCED,
  },
  {
    id: 'angular-frontend-developer',
    title: 'Angular Frontend Developer',
    level: 'fresher',
    summary: 'Build rich, accessible Angular SPAs.',
    requiredSkills: [
      { name: 'JavaScript', target: 78, weight: 1.1 },
      { name: 'TypeScript', target: 78, weight: 1.1 },
      { name: 'Angular', target: 80, weight: 1.3 },
      { name: 'CSS', target: 72, weight: 0.9 },
      { name: 'RxJS', target: 65, weight: 0.8 },
      { name: 'REST API design', target: 60, weight: 0.6 },
    ],
    optionalSkills: ['Accessibility', 'Testing', 'NgRx', 'Responsive design'],
    projectExpectations: {
      minProjects: 2,
      note: 'A polished Angular app consuming a real API, deployed.',
    },
    interviewExpectations: [
      'Angular internals',
      'RxJS + state',
      'CSS/layout',
      'Component design',
    ],
    portfolioExpectations: [
      'A flagship Angular app',
      'Live demo',
      'Accessible, responsive UI',
    ],
    readinessRubric: {
      skills: 0.45,
      projects: 0.25,
      interview: 0.12,
      consistency: 0.08,
      portfolio: 0.1,
    },
  },
  {
    id: 'backend-developer',
    title: 'Backend Developer',
    level: 'fresher',
    summary: 'Design APIs, data models and reliable services.',
    requiredSkills: [
      { name: 'Node', target: 78, weight: 1.1 },
      { name: 'Databases', target: 78, weight: 1.1 },
      { name: 'REST API design', target: 80, weight: 1.2 },
      { name: 'Data structures', target: 72, weight: 1 },
      { name: 'System design', target: 60, weight: 0.8 },
      { name: 'Git', target: 70, weight: 0.6 },
    ],
    optionalSkills: ['Caching', 'Message queues', 'Docker', 'Auth'],
    projectExpectations: {
      minProjects: 2,
      note: 'A production-shaped API with auth, validation and a database.',
    },
    interviewExpectations: [
      'API + DB design',
      'DSA',
      'System design basics',
      'Debugging',
    ],
    portfolioExpectations: [
      'A documented API',
      'Schema diagrams',
      'Deployed service',
    ],
    readinessRubric: {
      skills: 0.42,
      projects: 0.25,
      interview: 0.18,
      consistency: 0.07,
      portfolio: 0.08,
    },
  },
  {
    id: 'ai-engineer',
    title: 'AI Engineer',
    level: 'junior',
    summary: 'Build LLM-powered apps, RAG pipelines and ML features.',
    requiredSkills: [
      { name: 'Python', target: 80, weight: 1.2 },
      { name: 'Machine learning', target: 72, weight: 1.1 },
      { name: 'LLMs', target: 72, weight: 1.1 },
      { name: 'Data structures', target: 70, weight: 0.9 },
      { name: 'APIs', target: 68, weight: 0.8 },
      { name: 'Databases', target: 62, weight: 0.6 },
    ],
    optionalSkills: ['RAG', 'Vector DBs', 'PyTorch', 'Prompt engineering'],
    projectExpectations: {
      minProjects: 2,
      note: 'An LLM/RAG app with evaluation and a demo.',
    },
    interviewExpectations: [
      'ML fundamentals',
      'LLM/RAG design',
      'Python + DSA',
      'A project deep-dive',
    ],
    portfolioExpectations: [
      'An AI app with a demo',
      'A short write-up of approach',
      'Repo with evals',
    ],
    readinessRubric: RUBRIC_BALANCED,
  },
  {
    id: 'devops-engineer',
    title: 'DevOps Engineer',
    level: 'junior',
    summary: 'Automate build, deploy and run with reliable infrastructure.',
    requiredSkills: [
      { name: 'Linux', target: 75, weight: 1 },
      { name: 'Docker', target: 78, weight: 1.1 },
      { name: 'CI/CD', target: 78, weight: 1.2 },
      { name: 'Cloud', target: 70, weight: 1 },
      { name: 'Scripting', target: 70, weight: 0.8 },
      { name: 'Networking', target: 60, weight: 0.6 },
    ],
    optionalSkills: ['Kubernetes', 'Terraform', 'Monitoring', 'AWS'],
    projectExpectations: {
      minProjects: 1,
      note: 'A dockerised app with a CI/CD pipeline and deployment.',
    },
    interviewExpectations: [
      'CI/CD design',
      'Containers',
      'Cloud basics',
      'Troubleshooting',
    ],
    portfolioExpectations: [
      'A pipeline repo',
      'Infra-as-code sample',
      'A deployment write-up',
    ],
    readinessRubric: {
      skills: 0.45,
      projects: 0.2,
      interview: 0.15,
      consistency: 0.1,
      portfolio: 0.1,
    },
  },
  {
    id: 'data-analyst',
    title: 'Data Analyst',
    level: 'fresher',
    summary: 'Turn data into decisions with SQL, viz and storytelling.',
    requiredSkills: [
      { name: 'SQL', target: 80, weight: 1.3 },
      { name: 'Excel', target: 70, weight: 0.8 },
      { name: 'Python', target: 65, weight: 0.9 },
      { name: 'Statistics', target: 68, weight: 1 },
      { name: 'Data visualization', target: 72, weight: 1 },
      { name: 'Communication', target: 65, weight: 0.7 },
    ],
    optionalSkills: ['Power BI', 'Tableau', 'Pandas', 'A/B testing'],
    projectExpectations: {
      minProjects: 2,
      note: 'An end-to-end analysis with a dashboard and insights.',
    },
    interviewExpectations: [
      'SQL queries',
      'Stats reasoning',
      'A case study',
      'Communication',
    ],
    portfolioExpectations: [
      '2 analysis projects',
      'A dashboard',
      'Clear write-ups',
    ],
    readinessRubric: {
      skills: 0.42,
      projects: 0.28,
      interview: 0.12,
      consistency: 0.08,
      portfolio: 0.1,
    },
  },
  {
    id: 'cybersecurity-analyst',
    title: 'Cybersecurity Analyst',
    level: 'junior',
    summary: 'Defend systems — monitor, detect and respond to threats.',
    requiredSkills: [
      { name: 'Networking', target: 75, weight: 1.1 },
      { name: 'Linux', target: 72, weight: 1 },
      { name: 'Security fundamentals', target: 80, weight: 1.3 },
      { name: 'Scripting', target: 65, weight: 0.8 },
      { name: 'Cryptography', target: 60, weight: 0.7 },
      { name: 'Incident response', target: 62, weight: 0.9 },
    ],
    optionalSkills: ['SIEM', 'OWASP', 'Threat modeling', 'Forensics'],
    projectExpectations: {
      minProjects: 1,
      note: 'A lab write-up or CTF set demonstrating hands-on defense.',
    },
    interviewExpectations: [
      'Security fundamentals',
      'Networking',
      'Scenario response',
      'Tools',
    ],
    portfolioExpectations: [
      'Lab/CTF write-ups',
      'A tool or script',
      'Certs where relevant',
    ],
    readinessRubric: {
      skills: 0.5,
      projects: 0.18,
      interview: 0.15,
      consistency: 0.07,
      portfolio: 0.1,
    },
  },
  {
    id: 'mobile-app-developer',
    title: 'Mobile App Developer',
    level: 'fresher',
    summary: 'Ship cross-platform or native mobile apps.',
    requiredSkills: [
      { name: 'JavaScript', target: 72, weight: 1 },
      { name: 'React Native', target: 78, weight: 1.2 },
      { name: 'Mobile UI', target: 72, weight: 1 },
      { name: 'APIs', target: 68, weight: 0.9 },
      { name: 'State management', target: 65, weight: 0.8 },
      { name: 'Git', target: 65, weight: 0.5 },
    ],
    optionalSkills: [
      'Flutter',
      'App store deploy',
      'Push notifications',
      'Offline storage',
    ],
    projectExpectations: {
      minProjects: 2,
      note: 'A published or demo-able mobile app with API integration.',
    },
    interviewExpectations: [
      'Mobile fundamentals',
      'A framework deep-dive',
      'API integration',
      'A project deep-dive',
    ],
    portfolioExpectations: ['A demo-able app', 'Screens/recording', 'Repo'],
    readinessRubric: RUBRIC_BALANCED,
  },
  {
    id: 'product-engineer',
    title: 'Product Engineer',
    level: 'junior',
    summary: 'Full-stack generalist who ships product features end to end.',
    requiredSkills: [
      { name: 'JavaScript', target: 78, weight: 1.1 },
      { name: 'React', target: 75, weight: 1 },
      { name: 'Node', target: 72, weight: 1 },
      { name: 'Product thinking', target: 70, weight: 1 },
      { name: 'Databases', target: 68, weight: 0.9 },
      { name: 'Communication', target: 68, weight: 0.8 },
    ],
    optionalSkills: [
      'Design sense',
      'Analytics',
      'Experimentation',
      'Deployment',
    ],
    projectExpectations: {
      minProjects: 2,
      note: 'A shipped product with real users or a polished demo.',
    },
    interviewExpectations: [
      'Full-stack build',
      'Product sense',
      'A project deep-dive',
      'Behavioral',
    ],
    portfolioExpectations: [
      'A shipped product',
      'A case study',
      'Metrics/learnings',
    ],
    readinessRubric: {
      skills: 0.38,
      projects: 0.27,
      interview: 0.13,
      consistency: 0.1,
      portfolio: 0.12,
    },
  },
];

export function findRole(id: string): CareerRole | undefined {
  return CAREER_ROLES.find((r) => r.id === id);
}

/** Best-guess role id from a free-text goal/target-role string. */
export function matchRoleFromGoal(text: string): CareerRole {
  const t = (text || '').toLowerCase();
  const byKeyword: [RegExp, string][] = [
    [/mern/, 'mern-developer'],
    [/java/, 'java-full-stack-developer'],
    [/angular/, 'angular-frontend-developer'],
    [/front[- ]?end/, 'angular-frontend-developer'],
    [/back[- ]?end/, 'backend-developer'],
    [/\bai\b|machine learning|\bml\b|llm/, 'ai-engineer'],
    [/devops/, 'devops-engineer'],
    [/data analyst|analytics/, 'data-analyst'],
    [/security|cyber/, 'cybersecurity-analyst'],
    [/mobile|android|ios|flutter|react native/, 'mobile-app-developer'],
    [/product/, 'product-engineer'],
    [/full[- ]?stack/, 'full-stack-developer'],
  ];
  for (const [re, id] of byKeyword) {
    if (re.test(t)) return findRole(id) as CareerRole;
  }
  return findRole('full-stack-developer') as CareerRole;
}
