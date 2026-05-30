/** Project archetypes + stack inference for the deterministic blueprint generator. */

export interface Archetype {
  match: string[];
  title: (goal: string) => string;
  features: string[];
  coreTasks: { title: string; description: string }[];
  learningGoals: string[];
}

export const ARCHETYPES: Archetype[] = [
  {
    match: ['todo', 'task', 'to-do', 'checklist'],
    title: () => 'Task Manager App',
    features: ['Create / edit / delete tasks', 'Mark complete & filter', 'Due dates & priority', 'Persisted storage', 'Responsive UI'],
    coreTasks: [
      { title: 'Task list UI with add/edit/delete', description: 'Build the core CRUD UI for tasks.' },
      { title: 'Complete toggle + filters (all/active/done)', description: 'State + derived views.' },
      { title: 'Due dates & priority sorting', description: 'Add metadata and sort/filter by it.' },
      { title: 'Persist tasks to the API + DB', description: 'Wire create/update/delete to the backend.' },
    ],
    learningGoals: ['CRUD data flow', 'Client state management', 'REST API design'],
  },
  {
    match: ['chat', 'messaging', 'messenger'],
    title: () => 'Realtime Chat App',
    features: ['Auth & profiles', 'Rooms / channels', 'Realtime messages (WebSocket)', 'Typing indicators', 'Message history'],
    coreTasks: [
      { title: 'Auth & user profiles', description: 'Sign up / log in and store profiles.' },
      { title: 'Channel list + create channel', description: 'Model and render rooms.' },
      { title: 'WebSocket message send/receive', description: 'Realtime transport with a gateway.' },
      { title: 'Persist & paginate message history', description: 'Store messages and load older ones.' },
    ],
    learningGoals: ['WebSockets / realtime', 'Auth & sessions', 'Pagination'],
  },
  {
    match: ['ecommerce', 'e-commerce', 'shop', 'store', 'cart'],
    title: () => 'E-commerce Storefront',
    features: ['Product catalog & search', 'Cart & checkout', 'Auth & orders', 'Admin product CRUD', 'Payment (mock)'],
    coreTasks: [
      { title: 'Product catalog + detail pages', description: 'List, search and view products.' },
      { title: 'Cart state + quantities', description: 'Add/remove, persist the cart.' },
      { title: 'Checkout flow (mock payment)', description: 'Collect details and place an order.' },
      { title: 'Orders & order history', description: 'Persist orders per user.' },
    ],
    learningGoals: ['Complex state', 'Payments flow', 'Relational data modeling'],
  },
  {
    match: ['blog', 'cms', 'article', 'content'],
    title: () => 'Blog / CMS Platform',
    features: ['Markdown posts', 'Auth & authoring', 'Comments', 'Tags & search', 'SEO-friendly pages'],
    coreTasks: [
      { title: 'Post model + markdown rendering', description: 'Author and render posts.' },
      { title: 'Auth-gated author dashboard', description: 'Create/edit/delete your posts.' },
      { title: 'Comments + tags', description: 'Engagement and taxonomy.' },
      { title: 'Search & pagination', description: 'Find and browse content.' },
    ],
    learningGoals: ['Content modeling', 'Markdown rendering', 'Auth roles'],
  },
  {
    match: ['api', 'backend', 'rest', 'service', 'microservice'],
    title: () => 'REST API Service',
    features: ['Resource CRUD endpoints', 'Validation & error handling', 'Auth (JWT)', 'Pagination & filtering', 'API docs (OpenAPI)'],
    coreTasks: [
      { title: 'Define resources + CRUD endpoints', description: 'Model the domain and routes.' },
      { title: 'Request validation + error envelope', description: 'DTO validation and consistent errors.' },
      { title: 'JWT auth + guards', description: 'Protect endpoints by role.' },
      { title: 'Pagination, filtering & OpenAPI docs', description: 'Production-quality querying + docs.' },
    ],
    learningGoals: ['API design', 'Auth & guards', 'Validation & docs'],
  },
  {
    match: ['dashboard', 'analytics', 'admin'],
    title: () => 'Analytics Dashboard',
    features: ['Data ingestion', 'Charts & KPIs', 'Filters & date ranges', 'Auth & roles', 'Export (CSV)'],
    coreTasks: [
      { title: 'Data model + seed/ingest', description: 'Get data into the system.' },
      { title: 'KPI cards + charts', description: 'Visualize the key metrics.' },
      { title: 'Filters & date ranges', description: 'Slice the data interactively.' },
      { title: 'CSV export', description: 'Let users take the data with them.' },
    ],
    learningGoals: ['Data viz', 'Aggregation queries', 'Filtering UX'],
  },
];

export const GENERIC: Archetype = {
  match: [],
  title: (goal) => `${goal.replace(/\b\w/g, (c) => c.toUpperCase())} App`,
  features: ['Core feature set', 'Persisted data', 'Auth', 'Responsive UI', 'Deployed build'],
  coreTasks: [
    { title: 'Define the core user flow', description: 'Nail the one thing this app must do well.' },
    { title: 'Build the primary feature end-to-end', description: 'UI → API → DB for the core flow.' },
    { title: 'Add data persistence', description: 'Wire the backend and database.' },
    { title: 'Handle edge cases & empty states', description: 'Make it robust and friendly.' },
  ],
  learningGoals: ['End-to-end app architecture', 'API + data modeling', 'Shipping a real build'],
};

export interface StackProfile {
  stack: string[];
  language: string;
}

/** Infer a tech stack from the goal text + the student's known skills. */
export function inferStack(goal: string, skills: string[]): StackProfile {
  const hay = `${goal} ${skills.join(' ')}`.toLowerCase();
  if (/python|django|flask|fastapi/.test(hay)) return { stack: ['Python', 'FastAPI', 'PostgreSQL'], language: 'Python' };
  if (/\bjava\b|spring/.test(hay)) return { stack: ['Java', 'Spring Boot', 'MySQL'], language: 'Java' };
  if (/angular|nest/.test(hay)) return { stack: ['Angular', 'NestJS', 'MongoDB'], language: 'TypeScript' };
  if (/vue|nuxt/.test(hay)) return { stack: ['Vue', 'Node + Express', 'MongoDB'], language: 'JavaScript' };
  if (/next|react|mern|node|javascript|typescript/.test(hay)) return { stack: ['React', 'Node + Express', 'MongoDB'], language: 'TypeScript' };
  return { stack: ['React', 'Node + Express', 'MongoDB'], language: 'TypeScript' };
}

export function matchArchetype(goal: string): Archetype {
  const g = goal.toLowerCase();
  return ARCHETYPES.find((a) => a.match.some((m) => g.includes(m))) ?? GENERIC;
}
