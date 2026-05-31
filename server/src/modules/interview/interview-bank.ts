/**
 * Phase 9 · Interview OS — deterministic question bank so mock interviews work offline (no keys).
 * The InterviewCoachAgent may enrich/replace these when an LLM is live.
 */
export const INTERVIEW_TYPES = [
  'hr',
  'technical',
  'frontend',
  'backend',
  'system_design',
  'project_deep_dive',
  'behavioral',
  'dsa',
  'voice_viva',
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_TYPE_META: Record<
  InterviewType,
  { label: string; focus: string }
> = {
  hr: { label: 'HR / Screening', focus: 'motivation, fit, communication' },
  technical: { label: 'Technical', focus: 'fundamentals + problem solving' },
  frontend: { label: 'Frontend', focus: 'UI frameworks, state, CSS' },
  backend: { label: 'Backend', focus: 'APIs, data, reliability' },
  system_design: { label: 'System Design', focus: 'architecture & trade-offs' },
  project_deep_dive: {
    label: 'Project Deep-Dive',
    focus: 'your real project decisions',
  },
  behavioral: { label: 'Behavioral', focus: 'ownership, teamwork, conflict' },
  dsa: { label: 'DSA Oral', focus: 'data structures & complexity' },
  voice_viva: { label: 'Voice Viva', focus: 'explain concepts aloud' },
};

const BANK: Record<InterviewType, string[]> = {
  hr: [
    'Tell me about yourself and why you want this {role} role.',
    'What are you most proud of building so far?',
    'Where do you see yourself growing in the next year?',
    'Why should we pick you over other candidates?',
    'Tell me about a time you had to learn something hard, fast.',
  ],
  technical: [
    "Walk me through how you would approach debugging a bug you can't reproduce.",
    'Explain a core concept from your strongest skill as if to a junior.',
    "What's the difference between value and reference types in your main language?",
    'How do you decide when code is "good enough" to ship?',
    'Describe a technical trade-off you made recently and why.',
  ],
  frontend: [
    'How does component re-rendering work in your framework, and how do you avoid wasteful renders?',
    'How do you manage shared state across a large app?',
    'Walk me through making a layout responsive and accessible.',
    'How do you handle async data fetching and loading/error states?',
    'What causes layout shift and how do you prevent it?',
  ],
  backend: [
    'Design the REST endpoints for a simple resource (e.g. tasks) — verbs, status codes, pagination.',
    'How would you model this data and why (SQL vs NoSQL)?',
    'How do you handle authentication and authorization?',
    'What happens when a downstream call fails mid-request?',
    'How would you add caching without serving stale data?',
  ],
  system_design: [
    'Design a URL shortener. Start with requirements and scale assumptions.',
    'How would you handle 10x traffic on a read-heavy service?',
    'Where would you add a cache, a queue, and a database — and why?',
    'How do you keep the system available if one component fails?',
    'What metrics would you watch in production?',
  ],
  project_deep_dive: [
    'Walk me through your favourite project end to end.',
    'What was the hardest technical decision and what did you choose?',
    'If you rebuilt it today, what would you do differently?',
    'How did you test it and what would break it?',
    'What did you learn that changed how you build things?',
  ],
  behavioral: [
    'Tell me about a time you disagreed with a teammate. What happened?',
    'Describe a deadline you almost missed — what did you do?',
    'When did you take ownership of something nobody asked you to?',
    'Tell me about feedback that was hard to hear.',
    'How do you prioritise when everything feels urgent?',
  ],
  dsa: [
    "Explain when you'd use a hash map vs an array, with complexity.",
    'How would you detect a cycle in a linked list? Explain the idea aloud.',
    'Describe the trade-offs between BFS and DFS.',
    'What is the time/space complexity of your usual sorting approach?',
    "Explain dynamic programming to someone who's never heard of it.",
  ],
  voice_viva: [
    'In your own words, explain a concept you recently learned.',
    'Why does that concept matter in real projects?',
    "What's a common misconception about it?",
    "Give a concrete example where you'd apply it.",
    'What would you study next to go deeper?',
  ],
};

export function buildQuestions(type: InterviewType, role: string): string[] {
  return (BANK[type] ?? BANK.technical).map((q) =>
    q.replace('{role}', role || 'developer'),
  );
}
