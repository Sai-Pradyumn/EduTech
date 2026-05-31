/**
 * Phase 9 · A compact tech-skill vocabulary used to detect skills inside a pasted JD (no scraping,
 * fully deterministic). Each entry maps a canonical skill to the aliases we look for in the text.
 */
export const SKILL_VOCAB: { skill: string; aliases: string[] }[] = [
  { skill: 'JavaScript', aliases: ['javascript', 'js', 'es6', 'es2023'] },
  { skill: 'TypeScript', aliases: ['typescript', ' ts ', 'ts,'] },
  { skill: 'React', aliases: ['react', 'reactjs', 'react.js'] },
  { skill: 'Angular', aliases: ['angular'] },
  { skill: 'Vue', aliases: ['vue', 'vuejs'] },
  { skill: 'Node', aliases: ['node', 'nodejs', 'node.js'] },
  { skill: 'Express', aliases: ['express', 'expressjs'] },
  { skill: 'NestJS', aliases: ['nestjs', 'nest.js'] },
  { skill: 'MongoDB', aliases: ['mongodb', 'mongo', 'mongoose'] },
  { skill: 'SQL', aliases: ['sql', 'postgres', 'postgresql', 'mysql', 'rdbms'] },
  { skill: 'Databases', aliases: ['database', 'databases', 'nosql'] },
  { skill: 'REST API design', aliases: ['rest', 'restful', 'api design', 'apis'] },
  { skill: 'GraphQL', aliases: ['graphql'] },
  { skill: 'Java', aliases: ['java ', 'java,', 'core java'] },
  { skill: 'Spring Boot', aliases: ['spring boot', 'spring'] },
  { skill: 'Python', aliases: ['python'] },
  { skill: 'Django', aliases: ['django', 'flask', 'fastapi'] },
  { skill: 'Machine learning', aliases: ['machine learning', ' ml ', 'ml,'] },
  { skill: 'LLMs', aliases: ['llm', 'llms', 'genai', 'generative ai', 'rag'] },
  { skill: 'Docker', aliases: ['docker', 'container'] },
  { skill: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
  { skill: 'CI/CD', aliases: ['ci/cd', 'cicd', 'continuous integration', 'github actions', 'jenkins'] },
  { skill: 'Cloud', aliases: ['aws', 'azure', 'gcp', 'cloud'] },
  { skill: 'Git', aliases: ['git', 'github', 'gitlab', 'version control'] },
  { skill: 'Data structures', aliases: ['data structures', 'dsa', 'algorithms'] },
  { skill: 'System design', aliases: ['system design', 'scalability', 'distributed'] },
  { skill: 'Testing', aliases: ['testing', 'unit test', 'jest', 'cypress', 'tdd'] },
  { skill: 'CSS', aliases: ['css', 'tailwind', 'scss', 'sass'] },
  { skill: 'RxJS', aliases: ['rxjs', 'observable'] },
  { skill: 'Redux', aliases: ['redux', 'ngrx', 'state management'] },
  { skill: 'React Native', aliases: ['react native', 'expo'] },
  { skill: 'Flutter', aliases: ['flutter', 'dart'] },
  { skill: 'Communication', aliases: ['communication', 'stakeholder', 'collaborat'] },
];

/** Detect the canonical skills mentioned in a free-text job description. */
export function detectSkills(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  const hits = new Set<string>();
  for (const { skill, aliases } of SKILL_VOCAB) {
    if (aliases.some((a) => t.includes(a))) hits.add(skill);
  }
  return [...hits];
}
