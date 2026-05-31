/** Goal "track" templates. Each describes phased content the generator assembles
 *  into a week-by-week plan. Keep topics concrete so output never feels generic. */

export interface TrackPhase {
  focus: string;
  topics: string[];
  tasks: string[];
  practice: string[];
  outcome: string;
}

export interface ProjectTemplate {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  skillsCovered: string[];
}

export interface Track {
  id: string;
  label: string;
  /** Lowercase keywords matched against the student's goal text. */
  match: string[];
  overview: string;
  phases: TrackPhase[];
  projects: ProjectTemplate[];
  dailyPlan: string[];
  tips: string[];
}

const JAVA_FULLSTACK: Track = {
  id: 'java_fullstack',
  label: 'Java Full-Stack Developer',
  match: [
    'java full',
    'java fullstack',
    'java full-stack',
    'spring',
    'java full stack',
  ],
  overview:
    'A path from core Java to a deployable Spring Boot + React full-stack application, with DSA and interview readiness woven throughout.',
  phases: [
    {
      focus: 'Core Java foundations',
      topics: [
        'Java syntax & OOP',
        'Collections framework',
        'Exceptions & generics',
        'Streams & lambdas',
      ],
      tasks: [
        'Solve 20 core-Java exercises',
        'Build a CLI inventory app',
        'Write unit tests with JUnit',
      ],
      practice: ['10 collection problems', 'Refactor a class to use streams'],
      outcome:
        'Comfortable writing clean, idiomatic Java with collections and streams.',
    },
    {
      focus: 'Databases & SQL',
      topics: [
        'Relational modeling',
        'SQL joins & indexes',
        'JDBC',
        'Transactions',
      ],
      tasks: [
        'Design a normalized schema',
        'Write 15 SQL queries',
        'Connect Java to MySQL via JDBC',
      ],
      practice: ['Query optimization drill', 'Model an e-commerce schema'],
      outcome: 'Can design schemas and query relational data confidently.',
    },
    {
      focus: 'Spring Boot fundamentals',
      topics: [
        'Spring DI & beans',
        'REST controllers',
        'Spring Data JPA',
        'Validation & exception handling',
      ],
      tasks: [
        'Build a CRUD REST API',
        'Add JPA repositories',
        'Centralize error handling',
      ],
      practice: ['Add pagination to an endpoint', 'Write integration tests'],
      outcome: 'Can build a validated, persistent REST API with Spring Boot.',
    },
    {
      focus: 'Security & APIs',
      topics: [
        'Spring Security basics',
        'JWT authentication',
        'Role-based access',
        'API documentation',
      ],
      tasks: [
        'Add JWT auth to the API',
        'Protect routes by role',
        'Document with OpenAPI',
      ],
      practice: ['Implement refresh tokens', 'Add rate limiting'],
      outcome: 'Secured REST APIs with token auth and roles.',
    },
    {
      focus: 'React frontend',
      topics: [
        'Components & hooks',
        'State management',
        'Calling REST APIs',
        'Routing & forms',
      ],
      tasks: [
        'Build the app UI in React',
        'Wire auth + protected routes',
        'Handle loading/error states',
      ],
      practice: ['Build a reusable form', 'Add optimistic updates'],
      outcome: 'A connected React frontend talking to your Spring API.',
    },
    {
      focus: 'Deployment & polish',
      topics: [
        'Dockerizing the app',
        'Environment config',
        'CI basics',
        'Cloud deploy',
      ],
      tasks: [
        'Containerize backend + frontend',
        'Deploy to a cloud host',
        'Add a CI build',
      ],
      practice: ['Write a Dockerfile', 'Set up GitHub Actions'],
      outcome: 'A live, deployed full-stack app you can demo.',
    },
  ],
  projects: [
    {
      title: 'Full-Stack E-Commerce',
      description: 'Spring Boot + React store with auth, cart and orders.',
      difficulty: 'intermediate',
      skillsCovered: ['Spring Boot', 'JPA', 'React', 'JWT'],
    },
    {
      title: 'Job Board API',
      description: 'REST API with search, filtering and role-based posting.',
      difficulty: 'intermediate',
      skillsCovered: ['Spring', 'SQL', 'Security'],
    },
    {
      title: 'Deployed Portfolio App',
      description: 'Dockerized full-stack app deployed to the cloud with CI.',
      difficulty: 'advanced',
      skillsCovered: ['Docker', 'CI/CD', 'Cloud'],
    },
  ],
  dailyPlan: [
    '30–45 min concept learning',
    '45–60 min hands-on coding',
    '20 min DSA practice',
    'Short recap notes',
  ],
  tips: [
    'Build as you learn — every concept becomes a small feature.',
    'Keep one project growing across all phases.',
    'Commit daily to build a green GitHub graph.',
  ],
};

const MERN: Track = {
  id: 'mern',
  label: 'MERN Stack Developer',
  match: ['mern'],
  overview:
    'A practical MERN journey: deep JavaScript → React → Node/Express → MongoDB → a deployed full-stack product.',
  phases: [
    {
      focus: 'Modern JavaScript',
      topics: [
        'ES6+ features',
        'Async/await & promises',
        'Modules',
        'DOM & fetch',
      ],
      tasks: [
        'Build 3 vanilla JS mini-apps',
        'Consume a public API',
        'Refactor to modules',
      ],
      practice: ['Array method drills', 'Promise chaining exercise'],
      outcome: 'Fluent in modern JS and async patterns.',
    },
    {
      focus: 'React fundamentals',
      topics: [
        'Components & props',
        'Hooks (useState/useEffect)',
        'Lists & forms',
        'Routing',
      ],
      tasks: [
        'Build a todo + notes app',
        'Add routing',
        'Handle forms & validation',
      ],
      practice: ['Custom hook exercise', 'Lift state up drill'],
      outcome: 'Can build interactive React UIs.',
    },
    {
      focus: 'State & data fetching',
      topics: [
        'Context API',
        'Data fetching patterns',
        'Caching basics',
        'Error/loading UX',
      ],
      tasks: [
        'Add global auth state',
        'Centralize API calls',
        'Skeleton + error states',
      ],
      practice: ['Build a reusable fetch hook'],
      outcome: 'Robust client state and data flows.',
    },
    {
      focus: 'Node & Express',
      topics: ['Express routing', 'Middleware', 'REST design', 'Validation'],
      tasks: [
        'Build a REST API',
        'Add middleware & validation',
        'Structure controllers/services',
      ],
      practice: ['Write an auth middleware'],
      outcome: 'A clean Express REST API.',
    },
    {
      focus: 'MongoDB & auth',
      topics: ['Mongoose models', 'Relationships', 'JWT auth', 'Aggregations'],
      tasks: [
        'Model the domain in Mongoose',
        'Add JWT login/register',
        'Write an aggregation report',
      ],
      practice: ['Indexing exercise'],
      outcome: 'Persistent, authenticated MERN backend.',
    },
    {
      focus: 'Full-stack deploy',
      topics: [
        'Connecting FE+BE',
        'Env config',
        'Deploy frontend & backend',
        'Monitoring basics',
      ],
      tasks: [
        'Deploy the MERN app',
        'Add env-based config',
        'Set up basic logging',
      ],
      practice: ['Dockerize the API'],
      outcome: 'A live MERN product.',
    },
  ],
  projects: [
    {
      title: 'Social Feed App',
      description: 'Posts, likes, comments with auth and infinite scroll.',
      difficulty: 'intermediate',
      skillsCovered: ['React', 'Express', 'MongoDB', 'JWT'],
    },
    {
      title: 'Realtime Chat',
      description: 'MERN chat with Socket.IO rooms and presence.',
      difficulty: 'advanced',
      skillsCovered: ['Socket.IO', 'React', 'Node'],
    },
    {
      title: 'Expense Tracker',
      description: 'CRUD + charts + auth, fully deployed.',
      difficulty: 'beginner',
      skillsCovered: ['MERN', 'Charts'],
    },
  ],
  dailyPlan: [
    '40 min learn',
    '60 min build',
    '20 min JS/DSA practice',
    'Review & note',
  ],
  tips: [
    'Ship one growing app, not many throwaways.',
    'Read others’ React code on GitHub.',
    'Master async — it underpins all of MERN.',
  ],
};

const MEAN: Track = {
  id: 'mean',
  label: 'MEAN Stack Developer',
  match: ['mean stack', 'mean'],
  overview:
    'Angular-centric full-stack: TypeScript → Angular → Node/Express → MongoDB → deployment.',
  phases: [
    {
      focus: 'TypeScript & tooling',
      topics: [
        'TS types & generics',
        'Interfaces',
        'Decorators',
        'tsconfig & build',
      ],
      tasks: ['Convert a JS app to TS', 'Type an API client'],
      practice: ['Generics exercise'],
      outcome: 'Confident with strict TypeScript.',
    },
    {
      focus: 'Angular fundamentals',
      topics: [
        'Components & templates',
        'Signals & RxJS',
        'Services & DI',
        'Routing & guards',
      ],
      tasks: ['Build a multi-page Angular app', 'Add an auth guard'],
      practice: ['Reactive forms drill'],
      outcome: 'Can build structured Angular apps.',
    },
    {
      focus: 'Angular advanced',
      topics: [
        'HTTP interceptors',
        'State patterns',
        'Reusable components',
        'Forms & validation',
      ],
      tasks: ['Add an HTTP interceptor', 'Build a component library slice'],
      practice: ['Custom validator exercise'],
      outcome: 'Production-grade Angular patterns.',
    },
    {
      focus: 'Node & Express',
      topics: ['REST APIs', 'Middleware', 'Validation', 'Error handling'],
      tasks: ['Build the backend API', 'Add validation + errors'],
      practice: ['Auth middleware'],
      outcome: 'Solid Express backend.',
    },
    {
      focus: 'MongoDB & auth',
      topics: ['Mongoose', 'JWT', 'Roles', 'Aggregations'],
      tasks: ['Model data', 'Add JWT auth & roles'],
      practice: ['Aggregation report'],
      outcome: 'Authenticated MEAN backend.',
    },
    {
      focus: 'Deploy & polish',
      topics: ['Build & env config', 'Deploy', 'CI basics', 'Monitoring'],
      tasks: ['Deploy MEAN app', 'Add CI'],
      practice: ['Dockerize'],
      outcome: 'A live MEAN product.',
    },
  ],
  projects: [
    {
      title: 'Admin Dashboard',
      description:
        'Angular dashboard with charts, tables and role-based access.',
      difficulty: 'intermediate',
      skillsCovered: ['Angular', 'Express', 'MongoDB'],
    },
    {
      title: 'Booking System',
      description: 'Appointments with availability and notifications.',
      difficulty: 'advanced',
      skillsCovered: ['MEAN', 'Scheduling'],
    },
  ],
  dailyPlan: ['40 min learn', '60 min build', '20 min TS/DSA', 'Review'],
  tips: [
    'Lean into TypeScript strictness early.',
    'Use Angular signals for clean state.',
    'Reuse components aggressively.',
  ],
};

const FRONTEND: Track = {
  id: 'frontend',
  label: 'Frontend Developer',
  match: ['frontend', 'front end', 'front-end', 'ui developer'],
  overview:
    'From semantic HTML/CSS to a modern framework, accessibility, performance and a polished portfolio.',
  phases: [
    {
      focus: 'HTML & CSS mastery',
      topics: [
        'Semantic HTML',
        'Flexbox & Grid',
        'Responsive design',
        'CSS variables',
      ],
      tasks: ['Clone 3 landing pages', 'Build a responsive layout'],
      practice: ['Flexbox/Grid drills'],
      outcome: 'Pixel-accurate responsive layouts.',
    },
    {
      focus: 'JavaScript for UI',
      topics: ['DOM & events', 'Fetch & async', 'ES6+', 'State in vanilla JS'],
      tasks: ['Build interactive widgets', 'Consume an API'],
      practice: ['Event delegation exercise'],
      outcome: 'Dynamic, data-driven UIs.',
    },
    {
      focus: 'A modern framework',
      topics: ['Components & state', 'Hooks/signals', 'Routing', 'Forms'],
      tasks: ['Rebuild a project in React/Angular', 'Add routing & forms'],
      practice: ['Reusable component drill'],
      outcome: 'Component-based app skills.',
    },
    {
      focus: 'UX, a11y & performance',
      topics: [
        'Accessibility (ARIA)',
        'Core Web Vitals',
        'Lazy loading',
        'Animations',
      ],
      tasks: ['Audit a page with Lighthouse', 'Add a11y fixes'],
      practice: ['Keyboard-nav exercise'],
      outcome: 'Accessible, fast interfaces.',
    },
    {
      focus: 'Tooling & testing',
      topics: ['Vite/CLI', 'Component testing', 'Linting', 'Git workflow'],
      tasks: ['Add tests to a component', 'Set up linting'],
      practice: ['Write 5 component tests'],
      outcome: 'Professional frontend workflow.',
    },
    {
      focus: 'Portfolio & polish',
      topics: [
        'Design systems',
        'Deployment',
        'Case studies',
        'Interview prep',
      ],
      tasks: ['Ship a portfolio', 'Write 2 case studies'],
      practice: ['Refactor for design tokens'],
      outcome: 'A standout portfolio.',
    },
  ],
  projects: [
    {
      title: 'Component Library',
      description: 'Reusable, themed UI components with docs.',
      difficulty: 'intermediate',
      skillsCovered: ['CSS', 'Framework', 'A11y'],
    },
    {
      title: 'Dashboard UI',
      description: 'Responsive dashboard with charts and dark mode.',
      difficulty: 'intermediate',
      skillsCovered: ['Layout', 'State', 'Charts'],
    },
    {
      title: 'Animated Landing Page',
      description: 'High-polish marketing page with scroll animations.',
      difficulty: 'beginner',
      skillsCovered: ['CSS', 'Animation'],
    },
  ],
  dailyPlan: [
    '30 min learn',
    '60 min build/clone',
    '20 min CSS or JS practice',
    'Review',
  ],
  tips: [
    'Clone real sites to train your eye.',
    'Sweat accessibility — it sets you apart.',
    'Polish one portfolio relentlessly.',
  ],
};

const BACKEND: Track = {
  id: 'backend',
  label: 'Backend Developer',
  match: ['backend', 'back end', 'back-end', 'api developer'],
  overview:
    'APIs, databases, auth, caching, queues and deployment — the foundations of scalable backends.',
  phases: [
    {
      focus: 'Language & fundamentals',
      topics: ['Core language', 'Data structures', 'Error handling', 'Testing'],
      tasks: ['Build a CLI tool', 'Write unit tests'],
      practice: ['10 DS problems'],
      outcome: 'Solid programming base.',
    },
    {
      focus: 'REST API design',
      topics: [
        'HTTP & REST',
        'Routing & middleware',
        'Validation',
        'Versioning',
      ],
      tasks: ['Build a CRUD API', 'Add validation'],
      practice: ['Design an API spec'],
      outcome: 'Clean, validated REST APIs.',
    },
    {
      focus: 'Databases',
      topics: ['SQL & NoSQL', 'Modeling', 'Indexes', 'Transactions'],
      tasks: ['Model a domain', 'Optimize 5 queries'],
      practice: ['Indexing exercise'],
      outcome: 'Effective data modeling.',
    },
    {
      focus: 'Auth & security',
      topics: ['JWT/sessions', 'RBAC', 'Hashing', 'Common vulns (OWASP)'],
      tasks: ['Add auth & roles', 'Fix an OWASP issue'],
      practice: ['Threat-model an endpoint'],
      outcome: 'Secure backend services.',
    },
    {
      focus: 'Scale: cache & queues',
      topics: [
        'Redis caching',
        'Background jobs',
        'Rate limiting',
        'Pagination',
      ],
      tasks: ['Add caching', 'Add a job queue'],
      practice: ['Cache-invalidation drill'],
      outcome: 'Performant, resilient services.',
    },
    {
      focus: 'Deploy & observe',
      topics: ['Docker', 'CI/CD', 'Logging & metrics', 'Cloud deploy'],
      tasks: ['Dockerize & deploy', 'Add structured logs'],
      practice: ['Write a healthcheck'],
      outcome: 'A deployed, observable backend.',
    },
  ],
  projects: [
    {
      title: 'URL Shortener',
      description: 'API with analytics, rate limiting and caching.',
      difficulty: 'intermediate',
      skillsCovered: ['API', 'Redis', 'DB'],
    },
    {
      title: 'Job Queue Service',
      description: 'Background processing with retries and a dashboard.',
      difficulty: 'advanced',
      skillsCovered: ['Queues', 'Redis', 'Workers'],
    },
    {
      title: 'Auth Microservice',
      description: 'JWT auth service with roles and refresh tokens.',
      difficulty: 'intermediate',
      skillsCovered: ['Auth', 'Security'],
    },
  ],
  dailyPlan: ['40 min learn', '50 min build', '30 min DSA', 'Review'],
  tips: [
    'Always think about failure modes.',
    'Measure before optimizing.',
    'Write tests for every endpoint.',
  ],
};

const DEVOPS: Track = {
  id: 'devops',
  label: 'DevOps Engineer',
  match: ['devops', 'dev ops', 'sre', 'platform engineer'],
  overview:
    'Linux, Git, containers, CI/CD, IaC, Kubernetes and observability — the modern delivery pipeline.',
  phases: [
    {
      focus: 'Linux & scripting',
      topics: [
        'Linux fundamentals',
        'Bash scripting',
        'Networking basics',
        'Git workflows',
      ],
      tasks: ['Automate a task in Bash', 'Practice Git branching'],
      practice: ['20 Linux command drills'],
      outcome: 'Comfortable on the command line.',
    },
    {
      focus: 'Containers',
      topics: ['Docker images', 'Compose', 'Registries', 'Multi-stage builds'],
      tasks: ['Containerize an app', 'Write a compose stack'],
      practice: ['Optimize a Dockerfile'],
      outcome: 'Can containerize any app.',
    },
    {
      focus: 'CI/CD',
      topics: ['Pipelines', 'GitHub Actions', 'Artifacts', 'Secrets'],
      tasks: ['Build a CI pipeline', 'Automate deploys'],
      practice: ['Add a test+build gate'],
      outcome: 'Automated build/test/deploy.',
    },
    {
      focus: 'Infrastructure as Code',
      topics: [
        'Terraform basics',
        'Cloud primitives',
        'State management',
        'Modules',
      ],
      tasks: ['Provision infra with Terraform', 'Modularize config'],
      practice: ['Write a reusable module'],
      outcome: 'Reproducible infrastructure.',
    },
    {
      focus: 'Kubernetes',
      topics: [
        'Pods & deployments',
        'Services & ingress',
        'ConfigMaps/Secrets',
        'Scaling',
      ],
      tasks: ['Deploy to k8s', 'Add autoscaling'],
      practice: ['Write manifests'],
      outcome: 'Can run apps on Kubernetes.',
    },
    {
      focus: 'Observability & SRE',
      topics: [
        'Logging',
        'Metrics (Prometheus)',
        'Dashboards (Grafana)',
        'Alerting',
      ],
      tasks: ['Add metrics + dashboards', 'Set up alerts'],
      practice: ['Define SLOs'],
      outcome: 'Monitored, reliable systems.',
    },
  ],
  projects: [
    {
      title: 'CI/CD Pipeline',
      description: 'Full build-test-deploy pipeline for a sample app.',
      difficulty: 'intermediate',
      skillsCovered: ['CI/CD', 'Docker'],
    },
    {
      title: 'Monitoring Stack',
      description: 'Prometheus + Grafana dashboards with alerts.',
      difficulty: 'advanced',
      skillsCovered: ['Observability', 'k8s'],
    },
    {
      title: 'IaC Environment',
      description: 'Terraform-provisioned cloud environment.',
      difficulty: 'advanced',
      skillsCovered: ['Terraform', 'Cloud'],
    },
  ],
  dailyPlan: [
    '40 min learn',
    '60 min hands-on labs',
    '20 min review docs',
    'Note key commands',
  ],
  tips: [
    'Automate everything you do twice.',
    'Break things in a sandbox to learn.',
    'Read official docs — they’re excellent.',
  ],
};

const AI_APP: Track = {
  id: 'ai_app',
  label: 'AI Application Developer',
  match: [
    'ai project',
    'ai application',
    'ai app',
    'llm',
    'genai',
    'gen ai',
    'build ai',
    'machine learning app',
  ],
  overview:
    'Build real AI products: Python, APIs, LLMs, prompts, RAG, vector search and deployment.',
  phases: [
    {
      focus: 'Python & APIs',
      topics: [
        'Python essentials',
        'HTTP clients',
        'FastAPI basics',
        'Async I/O',
      ],
      tasks: ['Build a small FastAPI service', 'Call an external API'],
      practice: ['Python data drills'],
      outcome: 'Can build Python API services.',
    },
    {
      focus: 'LLM fundamentals',
      topics: [
        'Tokens & context',
        'Prompt design',
        'Function/tool calling',
        'Streaming',
      ],
      tasks: ['Build a chat endpoint', 'Design 5 prompts'],
      practice: ['Prompt iteration log'],
      outcome: 'Effective LLM integration.',
    },
    {
      focus: 'Embeddings & RAG',
      topics: ['Embeddings', 'Chunking', 'Vector search', 'Grounded answers'],
      tasks: ['Build a RAG pipeline', 'Add citations'],
      practice: ['Chunking strategy exercise'],
      outcome: 'A working RAG system.',
    },
    {
      focus: 'Agents & tools',
      topics: ['Agent loops', 'Tool use', 'Memory', 'Guardrails'],
      tasks: ['Build a tool-using agent', 'Add a safety check'],
      practice: ['Design an agent prompt'],
      outcome: 'Can orchestrate AI agents.',
    },
    {
      focus: 'Frontend for AI',
      topics: ['Chat UI', 'Streaming render', 'State', 'UX for latency'],
      tasks: ['Build a streaming chat UI', 'Show sources'],
      practice: ['Optimistic UI exercise'],
      outcome: 'Polished AI front-ends.',
    },
    {
      focus: 'Deploy & evaluate',
      topics: ['Deployment', 'Cost & caching', 'Evaluation', 'Monitoring'],
      tasks: ['Deploy an AI app', 'Add basic evals'],
      practice: ['Cache prompt results'],
      outcome: 'A deployed, evaluated AI product.',
    },
  ],
  projects: [
    {
      title: 'Docs Q&A (RAG)',
      description: 'Upload docs and chat with grounded, cited answers.',
      difficulty: 'intermediate',
      skillsCovered: ['RAG', 'Embeddings', 'LLM'],
    },
    {
      title: 'AI Agent Assistant',
      description: 'Tool-using agent that performs multi-step tasks.',
      difficulty: 'advanced',
      skillsCovered: ['Agents', 'Tools'],
    },
    {
      title: 'AI Writing App',
      description: 'Streaming generation UI with prompt presets.',
      difficulty: 'beginner',
      skillsCovered: ['LLM', 'Streaming UI'],
    },
  ],
  dailyPlan: [
    '40 min learn',
    '60 min build',
    '20 min read AI papers/blogs',
    'Log prompt experiments',
  ],
  tips: [
    'Start with a mock provider, then swap in a real one.',
    'Ground answers to avoid hallucinations.',
    'Measure cost and latency from day one.',
  ],
};

const DSA: Track = {
  id: 'dsa',
  label: 'Data Structures & Algorithms',
  match: ['dsa', 'data structures', 'algorithms', 'competitive'],
  overview:
    'A structured DSA climb: complexity → core structures → patterns → hard topics → mock contests.',
  phases: [
    {
      focus: 'Complexity & arrays',
      topics: ['Big-O', 'Arrays & strings', 'Two pointers', 'Sliding window'],
      tasks: ['Solve 25 array problems', 'Master two-pointer pattern'],
      practice: ['Daily 3 problems'],
      outcome: 'Strong on arrays/strings.',
    },
    {
      focus: 'Hashing & stacks',
      topics: [
        'Hash maps/sets',
        'Stacks & queues',
        'Prefix sums',
        'Monotonic stack',
      ],
      tasks: ['Solve 20 hashing problems', 'Implement a monotonic stack'],
      practice: ['Daily 3 problems'],
      outcome: 'Comfortable with linear structures.',
    },
    {
      focus: 'Recursion & trees',
      topics: ['Recursion', 'Binary trees', 'BST', 'Traversals'],
      tasks: ['Solve 20 tree problems', 'Implement traversals'],
      practice: ['Daily 3 problems'],
      outcome: 'Confident with trees & recursion.',
    },
    {
      focus: 'Graphs',
      topics: ['BFS/DFS', 'Topological sort', 'Union-Find', 'Shortest paths'],
      tasks: ['Solve 20 graph problems', 'Implement Dijkstra'],
      practice: ['Daily 3 problems'],
      outcome: 'Can model and solve graph problems.',
    },
    {
      focus: 'Dynamic programming',
      topics: ['1D/2D DP', 'Knapsack', 'LIS/LCS', 'DP on trees'],
      tasks: ['Solve 25 DP problems', 'Master knapsack patterns'],
      practice: ['Daily 3 problems'],
      outcome: 'Can recognize and solve DP.',
    },
    {
      focus: 'Mock contests',
      topics: [
        'Timed problem solving',
        'Pattern recognition',
        'Edge cases',
        'Optimization',
      ],
      tasks: ['Do 6 timed mock sets', 'Review every mistake'],
      practice: ['2 contests/week'],
      outcome: 'Interview-ready speed and accuracy.',
    },
  ],
  projects: [
    {
      title: 'Pattern Cheatsheet',
      description: 'Your own annotated DSA pattern notes with templates.',
      difficulty: 'beginner',
      skillsCovered: ['Patterns', 'Notes'],
    },
    {
      title: 'Problem Tracker',
      description: 'App to track solved problems, tags and revisits.',
      difficulty: 'intermediate',
      skillsCovered: ['CRUD', 'Spaced repetition'],
    },
  ],
  dailyPlan: [
    '15 min pattern review',
    '60–75 min problem solving',
    '15 min editorial review',
    'Log mistakes',
  ],
  tips: [
    'Solve by pattern, not by count.',
    'Revisit wrong problems after 3 days.',
    'Always restate the problem first.',
  ],
};

const PLACEMENT: Track = {
  id: 'placement',
  label: 'Placement Preparation',
  match: ['placement', 'placements', 'campus', 'on-campus'],
  overview:
    'A balanced placement plan: DSA, core CS subjects, one project, aptitude and mock interviews.',
  phases: [
    {
      focus: 'DSA core',
      topics: ['Arrays/strings', 'Hashing', 'Recursion', 'Sorting/searching'],
      tasks: ['Solve 40 problems', 'Track by topic'],
      practice: ['Daily 3 problems'],
      outcome: 'Solid DSA base.',
    },
    {
      focus: 'DSA advanced',
      topics: ['Trees', 'Graphs', 'DP', 'Greedy'],
      tasks: ['Solve 40 problems', 'Time yourself'],
      practice: ['2 timed sets/week'],
      outcome: 'Can crack medium problems.',
    },
    {
      focus: 'Core CS subjects',
      topics: ['OS', 'DBMS & SQL', 'Computer networks', 'OOP'],
      tasks: ['Make subject cheat-sheets', 'Answer 50 theory Qs'],
      practice: ['Flashcards'],
      outcome: 'Ready for theory rounds.',
    },
    {
      focus: 'Project & resume',
      topics: [
        'One strong project',
        'Resume bullets',
        'Git/GitHub',
        'STAR stories',
      ],
      tasks: ['Polish a project', 'Write a 1-page resume'],
      practice: ['3 STAR stories'],
      outcome: 'Interview-ready profile.',
    },
    {
      focus: 'Aptitude & HR',
      topics: ['Quant aptitude', 'Logical reasoning', 'Verbal', 'HR questions'],
      tasks: ['Daily aptitude sets', 'Prep 15 HR answers'],
      practice: ['1 aptitude test/day'],
      outcome: 'Clears aptitude + HR rounds.',
    },
    {
      focus: 'Mock interviews',
      topics: [
        'Technical mocks',
        'System basics',
        'Behavioral',
        'Feedback loops',
      ],
      tasks: ['6 mock interviews', 'Act on feedback'],
      practice: ['Peer mocks'],
      outcome: 'Confident across all rounds.',
    },
  ],
  projects: [
    {
      title: 'Resume Project',
      description: 'One end-to-end project you can defend in depth.',
      difficulty: 'intermediate',
      skillsCovered: ['Full-stack', 'Git'],
    },
  ],
  dailyPlan: [
    '60 min DSA',
    '30 min core CS',
    '20 min aptitude',
    '10 min revision',
  ],
  tips: [
    'Depth on one project beats five shallow ones.',
    'Practice explaining out loud.',
    'Track every company’s pattern.',
  ],
};

const INTERVIEW: Track = {
  id: 'interview',
  label: 'Interview Preparation',
  match: [
    'interview prep',
    'interview preparation',
    'interview',
    'crack interview',
  ],
  overview:
    'Focused interview readiness: DSA patterns, system design basics, project deep-dives and behavioral.',
  phases: [
    {
      focus: 'DSA patterns',
      topics: [
        'Top patterns',
        'Two pointers/sliding window',
        'Trees/graphs',
        'DP basics',
      ],
      tasks: ['Solve 30 tagged problems', 'Build a pattern map'],
      practice: ['Daily 3 problems'],
      outcome: 'Pattern-based problem solving.',
    },
    {
      focus: 'Timed practice',
      topics: ['Speed', 'Edge cases', 'Communication', 'Optimization'],
      tasks: ['4 timed sets', 'Narrate solutions'],
      practice: ['2 mocks/week'],
      outcome: 'Fast, clear solving.',
    },
    {
      focus: 'System design basics',
      topics: ['Scaling', 'Caching', 'Databases', 'API design'],
      tasks: ['Design 3 systems', 'Draw diagrams'],
      practice: ['Capacity estimation'],
      outcome: 'Can handle design rounds.',
    },
    {
      focus: 'Project deep-dives',
      topics: ['Architecture story', 'Trade-offs', 'Challenges', 'Metrics'],
      tasks: ['Prepare 2 deep-dives', 'Anticipate follow-ups'],
      practice: ['Whiteboard your project'],
      outcome: 'Confident project defense.',
    },
    {
      focus: 'Behavioral',
      topics: [
        'STAR method',
        'Leadership stories',
        'Conflict',
        'Questions to ask',
      ],
      tasks: ['Write 8 STAR stories', 'Prep questions for them'],
      practice: ['Mock HR round'],
      outcome: 'Strong behavioral answers.',
    },
  ],
  projects: [
    {
      title: 'System Design Notes',
      description: 'Your own design templates for common systems.',
      difficulty: 'intermediate',
      skillsCovered: ['System design'],
    },
  ],
  dailyPlan: [
    '60 min DSA',
    '30 min system design or behavioral',
    '15 min review',
    'Log learnings',
  ],
  tips: [
    'Communicate while you solve.',
    'Always discuss trade-offs.',
    'Know your own projects cold.',
  ],
};

const GENERIC: Track = {
  id: 'generic',
  label: 'Personalized Learning Path',
  match: [],
  overview:
    'A structured path tailored to your goal, with weekly focus, projects and assessments.',
  phases: [
    {
      focus: 'Foundations',
      topics: [
        'Core concepts',
        'Environment setup',
        'Fundamentals',
        'First exercises',
      ],
      tasks: ['Set up tooling', 'Complete intro exercises'],
      practice: ['Daily practice set'],
      outcome: 'Solid fundamentals.',
    },
    {
      focus: 'Core skills',
      topics: [
        'Key topic 1',
        'Key topic 2',
        'Hands-on basics',
        'Mini exercises',
      ],
      tasks: ['Build a small project', 'Practice core skills'],
      practice: ['Skill drills'],
      outcome: 'Confident with core skills.',
    },
    {
      focus: 'Applied practice',
      topics: ['Intermediate topics', 'Real examples', 'Patterns', 'Debugging'],
      tasks: ['Extend your project', 'Solve real tasks'],
      practice: ['Applied exercises'],
      outcome: 'Can apply skills to real problems.',
    },
    {
      focus: 'Advanced topics',
      topics: ['Advanced concepts', 'Best practices', 'Performance', 'Testing'],
      tasks: ['Add advanced features', 'Write tests'],
      practice: ['Advanced drills'],
      outcome: 'Production-quality work.',
    },
    {
      focus: 'Project & portfolio',
      topics: ['Capstone project', 'Polish', 'Documentation', 'Deployment'],
      tasks: ['Ship a capstone', 'Write docs'],
      practice: ['Refactor & polish'],
      outcome: 'A portfolio-ready project.',
    },
    {
      focus: 'Review & next steps',
      topics: ['Revision', 'Gaps', 'Interview basics', 'Roadmap ahead'],
      tasks: ['Review weak spots', 'Plan next goal'],
      practice: ['Mock assessment'],
      outcome: 'Consolidated, ready to advance.',
    },
  ],
  projects: [
    {
      title: 'Capstone Project',
      description: 'An end-to-end project showcasing your new skills.',
      difficulty: 'intermediate',
      skillsCovered: ['Applied skills'],
    },
  ],
  dailyPlan: [
    '40 min learn',
    '50 min practice',
    '20 min review',
    'Note progress',
  ],
  tips: [
    'Consistency beats intensity.',
    'Build projects, not just notes.',
    'Review weekly to retain.',
  ],
};

export const TRACKS: Track[] = [
  JAVA_FULLSTACK,
  MERN,
  MEAN,
  FRONTEND,
  BACKEND,
  DEVOPS,
  AI_APP,
  DSA,
  PLACEMENT,
  INTERVIEW,
];

/** Picks the best-matching track for a goal string; falls back to GENERIC. */
export function matchTrack(goal: string): Track {
  const g = goal.toLowerCase();
  for (const track of TRACKS) {
    if (track.match.some((kw) => g.includes(kw))) return track;
  }
  return GENERIC;
}
