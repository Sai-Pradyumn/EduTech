import { AstaTurn } from './asta-os.types';

/**
 * A contextual tool = a capability Asta surfaces when it's relevant. In the
 * standalone Asta OS these are **native** — `panel` tools open as in-cockpit
 * drawers built fresh on the data services (never the legacy screens); `route`
 * tools are full Asta OS pages. No tool ever navigates back to the classic app.
 */
export interface AstaTool {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly blurb: string;
  /** Intent substrings that make this tool relevant (matched loosely). */
  readonly intents: readonly string[];
  /** `panel` → native drawer · `route` → Asta OS page. */
  readonly kind: 'panel' | 'route';
  /** Target for `route` tools (Asta OS routes only). */
  readonly route?: string;
  /** Legacy routes this native tool replaces — so an agent `open_route` maps here. */
  readonly legacyRoutes?: readonly string[];
}

export const ASTA_TOOLS: readonly AstaTool[] = [
  { id: 'roadmap', label: 'Roadmap', kind: 'panel', blurb: 'Your learning path', intents: ['roadmap', 'plan'], legacyRoutes: ['/app/roadmap', '/app/roadmaps'], icon: 'M4 19c0-8 7-14 16-14M4 19h.01M20 5h.01' },
  { id: 'practice', label: 'Practice', kind: 'route', route: '/app/os/practice', blurb: 'Code with real execution', intents: ['practice', 'code', 'debug'], icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
  { id: 'notebook', label: 'ML Notebook', kind: 'route', route: '/app/os/notebook', blurb: 'Guided ML notebook', intents: ['ml', 'data', 'notebook', 'model', 'dataset', 'machine learning'], icon: 'M4 4h16v12H4zM2 20h20M9 9l2 2 4-4' },
  { id: 'quiz', label: 'Quizzes', kind: 'panel', blurb: 'Test what you know', intents: ['quiz', 'assess'], legacyRoutes: ['/app/quizzes'], icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { id: 'mistakes', label: 'Mistakes', kind: 'panel', blurb: 'Repair weak spots', intents: ['mistake', 'repair', 'weak'], legacyRoutes: ['/app/mistakes'], icon: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' },
  { id: 'skill-twin', label: 'Skill Twin', kind: 'panel', blurb: 'Your skill model', intents: ['skill', 'twin', 'progress'], legacyRoutes: ['/app/skill-twin'], icon: 'M12 2a5 5 0 0 0-5 5c0 1.5.5 2.5 1.5 3.5M12 2a5 5 0 0 1 5 5c0 1.5-.5 2.5-1.5 3.5M9 22h6M10 22v-4a2 2 0 0 1 4 0v4M12 11v3' },
  { id: 'flow', label: 'Flows', kind: 'panel', blurb: 'Visual learning paths', intents: ['flow', 'path', 'pipeline'], legacyRoutes: ['/app/flows'], icon: 'M5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0v5a2 2 0 0 0 2 2h6m6 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-9 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm9-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z' },
  { id: 'visual', label: 'Visuals', kind: 'panel', blurb: 'Diagrams & concept maps', intents: ['visual', 'diagram', 'concept map'], legacyRoutes: ['/app/visuals'], icon: 'M3 3h18v18H3zM3 9h18M9 21V9' },
  { id: 'project', label: 'Projects', kind: 'panel', blurb: 'Build real projects', intents: ['project', 'build'], legacyRoutes: ['/app/projects'], icon: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5' },
  { id: 'knowledge', label: 'Knowledge', kind: 'panel', blurb: 'Your sources (RAG)', intents: ['rag', 'source', 'grounded', 'knowledge', 'notes', 'docs'], legacyRoutes: ['/app/knowledge'], icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z' },
  { id: 'spaces', label: 'Study Spaces', kind: 'panel', blurb: 'Grouped study material', intents: ['space', 'study room'], legacyRoutes: ['/app/spaces'], icon: 'M2 7l10-5 10 5-10 5L2 7Zm0 5l10 5 10-5M2 17l10 5 10-5' },
  { id: 'interview', label: 'Interview', kind: 'panel', blurb: 'Mock interviews', intents: ['interview', 'mock'], legacyRoutes: ['/app/interview'], icon: 'M3 5h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z' },
  { id: 'resume', label: 'Resume', kind: 'panel', blurb: 'Resume & applications', intents: ['resume', 'cv', 'application'], legacyRoutes: ['/app/resume'], icon: 'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5' },
  { id: 'proof', label: 'Proof', kind: 'panel', blurb: 'Verified learning', intents: ['proof', 'passport', 'ledger', 'portfolio', 'career'], legacyRoutes: ['/app/skill-passport', '/app/proof-ledger', '/app/portfolio', '/app/career-readiness'], icon: 'M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-3 11h6' },
];

export function toolById(id: string): AstaTool | null {
  return ASTA_TOOLS.find((t) => t.id === id) ?? null;
}

/** Map any route (a native OS route or a legacy route an agent suggested) to a tool. */
export function toolForRoute(route: string): AstaTool | null {
  const path = route.split('?')[0];
  return (
    ASTA_TOOLS.find((t) => t.route === path) ??
    ASTA_TOOLS.find((t) => t.legacyRoutes?.some((r) => path === r || path.startsWith(`${r}/`))) ??
    null
  );
}

export function toolsForIntent(intent: string | undefined): AstaTool[] {
  if (!intent) return [];
  const i = intent.toLowerCase();
  return ASTA_TOOLS.filter((t) => t.intents.some((k) => i.includes(k)));
}

/**
 * Contextual tools for a completed turn: those the agent pointed to (open_route,
 * mapped to native tools) first, then intent-derived ones. Deduped, capped at 3.
 */
export function suggestTools(turn: AstaTurn): AstaTool[] {
  const out = new Map<string, AstaTool>();
  for (const a of turn.actions) {
    if (a.kind !== 'open_route') continue;
    const route = a.payload?.['route'];
    const tool = typeof route === 'string' ? toolForRoute(route) : null;
    if (tool) out.set(tool.id, tool);
  }
  for (const t of toolsForIntent(turn.intent)) {
    if (!out.has(t.id)) out.set(t.id, t);
  }
  return [...out.values()].slice(0, 3);
}
