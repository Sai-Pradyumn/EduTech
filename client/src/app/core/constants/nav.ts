export interface NavItem {
  label: string;
  route: string;
  icon: string; // inline SVG path data (Lucide-style, 24x24)
}
export interface NavGroup {
  heading: string;
  items: NavItem[];
}

// Lucide-style 1.5–2px stroke icon path data (viewBox 0 0 24 24).
const I = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  tutor: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z',
  roadmap: 'M4 19c0-8 7-14 16-14M4 19h.01M20 5h.01',
  flow: 'M5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0v5a2 2 0 0 0 2 2h6m6 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-9 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm9-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  visuals: 'M3 3h18v18H3zM3 9h18M9 21V9M7 6h.01',
  mistakes: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  twin: 'M12 2a5 5 0 0 0-5 5c0 1.5.5 2.5 1.5 3.5M12 2a5 5 0 0 1 5 5c0 1.5-.5 2.5-1.5 3.5M9 22h6M10 22v-4a2 2 0 0 1 4 0v4M12 11v3',
  council: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM5 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm14 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM7 20v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1',
  ledger: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11M7 8h6M7 12h3',
  replay: 'M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7 3.3M3 4v4h4M10 9l5 3-5 3V9Z',
  today: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 16l2 2 4-4',
  spaces: 'M2 7l10-5 10 5-10 5L2 7Zm0 5l10 5 10-5M2 17l10 5 10-5',
  sim: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2ZM14 2v6h6M9 13l2 2 4-4',
  course: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15ZM9 7h6M9 11h4',
  peers: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  knowledge: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z',
  quiz: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  projects: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  progress: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  students: 'M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  docs: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6',
  analytics: 'M3 3v18h18M18 17V9M13 17V5M8 17v-3',
  mentor: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5ZM19 8l1.5 1.5L22 8',
  voice: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',
  career: 'M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z',
  notes: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
  org: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h.01M9 12h.01M9 15h.01',
  platform: 'M2 3h20v14H2zM8 21h8M12 17v4',
  cohort: 'M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87M7 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM17 11a3 3 0 1 0 0-6M21 21v-2a4 4 0 0 0-3-3.87',
  certificate: 'M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM9 14l-2 7 5-3 5 3-2-7',
  billing: 'M2 7h20v12H2zM2 11h20M6 15h4',
  live: 'M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
  community: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  passport: 'M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-3 11h6',
  portfolioIcon: 'M2 7h20v13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7Zm6 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12h20',
  interview: 'M3 5h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm5 5h.01M12 10h.01M16 10h.01',
  resume: 'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6M9 17h6M9 9h2',
  applications: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  privacy: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4',
};

/** Org/platform nav appended for members + operators (permission-aware, built at runtime). */
export function workspaceNav(opts: { hasOrg: boolean; isPlatformAdmin: boolean; canMentor: boolean; canReports?: boolean }): NavGroup[] {
  const items: NavItem[] = [];
  if (opts.canMentor || opts.isPlatformAdmin) items.push({ label: 'Mentoring', route: '/app/mentor', icon: I.mentor });
  if (opts.hasOrg || opts.isPlatformAdmin) items.push({ label: 'Organization', route: '/app/org', icon: I.org });
  if (opts.hasOrg || opts.isPlatformAdmin) items.push({ label: 'Branding', route: '/app/org/branding', icon: I.certificate });
  if (opts.canReports || opts.isPlatformAdmin) items.push({ label: 'Reports', route: '/app/reports', icon: I.analytics });
  if (opts.isPlatformAdmin) items.push({ label: 'Platform', route: '/app/platform', icon: I.platform });
  if (opts.isPlatformAdmin) items.push({ label: 'Founder', route: '/app/founder', icon: I.dashboard });
  return items.length ? [{ heading: 'Workspace', items }] : [];
}

export const STUDENT_NAV: NavGroup[] = [
  {
    heading: 'Learn',
    items: [
      { label: 'Dashboard', route: '/app/dashboard', icon: I.dashboard },
      { label: 'Today', route: '/app/today', icon: I.today },
      { label: 'AI Tutor', route: '/app/tutor', icon: I.tutor },
      { label: 'Mentor Room', route: '/app/mentor-room', icon: I.mentor },
      { label: 'Roadmap', route: '/app/roadmap', icon: I.roadmap },
      { label: 'Flow Studio', route: '/app/flows', icon: I.flow },
      { label: 'Visual Studio', route: '/app/visuals', icon: I.visuals },
      { label: 'Study Spaces', route: '/app/spaces', icon: I.spaces },
      { label: 'Simulations', route: '/app/simulations', icon: I.sim },
      { label: 'Knowledge', route: '/app/knowledge', icon: I.knowledge },
      { label: 'Quizzes', route: '/app/quizzes', icon: I.quiz },
      { label: 'Projects', route: '/app/projects', icon: I.projects },
      { label: 'Course Builder', route: '/app/course-builder', icon: I.course },
      { label: 'Cohorts', route: '/app/cohorts', icon: I.cohort },
      { label: 'Live Sessions', route: '/app/live-sessions', icon: I.live },
      { label: 'Peer Rooms', route: '/app/peer-rooms', icon: I.peers },
      { label: 'Community', route: '/app/community', icon: I.community },
      { label: 'Voice Room', route: '/app/voice-room', icon: I.voice },
      { label: 'Workflows', route: '/app/workflows', icon: I.roadmap },
      { label: 'Career Coach', route: '/app/career-coach', icon: I.career },
      { label: 'Study Notes', route: '/app/content-studio', icon: I.notes },
      { label: 'Progress', route: '/app/progress', icon: I.progress },
      { label: 'Skill Twin', route: '/app/skill-twin', icon: I.twin },
      { label: 'Mistakes', route: '/app/mistakes', icon: I.mistakes },
      { label: 'Mentor Council', route: '/app/mentor-council', icon: I.council },
      { label: 'Learning Replay', route: '/app/replay', icon: I.replay },
    ],
  },
  {
    heading: 'Outcome',
    items: [
      { label: 'Skill Passport', route: '/app/skill-passport', icon: I.passport },
      { label: 'Career Readiness', route: '/app/career-readiness', icon: I.career },
      { label: 'Outcome Council', route: '/app/outcome-council', icon: I.council },
      { label: 'Portfolio', route: '/app/portfolio', icon: I.portfolioIcon },
      { label: 'Interview OS', route: '/app/interview', icon: I.interview },
      { label: 'Resume', route: '/app/resume', icon: I.resume },
      { label: 'Applications', route: '/app/applications', icon: I.applications },
      { label: 'Proof-of-Learning', route: '/app/ledger', icon: I.ledger },
    ],
  },
  {
    heading: 'Ecosystem',
    items: [
      { label: 'Mentors', route: '/app/mentors', icon: I.mentor },
      { label: 'Marketplace', route: '/app/marketplace', icon: I.spaces },
      { label: 'Creator Studio', route: '/app/creator-studio', icon: I.course },
      { label: 'Institution', route: '/app/institution', icon: I.org },
    ],
  },
  {
    heading: 'Account',
    items: [
      { label: 'Certificates', route: '/app/certificates', icon: I.certificate },
      { label: 'Billing', route: '/app/billing', icon: I.billing },
      { label: 'Offline & Sync', route: '/app/offline', icon: I.flow },
      { label: 'Security', route: '/app/security', icon: I.privacy },
      { label: 'Your Data', route: '/app/data', icon: I.docs },
      { label: 'Data & Privacy', route: '/app/privacy', icon: I.privacy },
      { label: 'Profile', route: '/app/profile', icon: I.profile },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    heading: 'Manage',
    items: [
      { label: 'Dashboard', route: '/admin', icon: I.dashboard },
      { label: 'Students', route: '/admin/students', icon: I.students },
      { label: 'Documents', route: '/admin/documents', icon: I.docs },
      { label: 'Roadmaps', route: '/admin/roadmaps', icon: I.roadmap },
      { label: 'Assessments', route: '/admin/assessments', icon: I.quiz },
      { label: 'AI Analytics', route: '/admin/analytics', icon: I.analytics },
      { label: 'Fine-Tuning', route: '/admin/fine-tuning', icon: I.voice },
    ],
  },
  {
    heading: 'Platform',
    items: [
      { label: 'Billing Admin', route: '/admin/billing', icon: I.billing },
      { label: 'AI Ops', route: '/admin/ai-ops', icon: I.analytics },
      { label: 'Ops', route: '/admin/ops', icon: I.progress },
      { label: 'Product Analytics', route: '/admin/product-analytics', icon: I.analytics },
      { label: 'Audit Logs', route: '/admin/audit-logs', icon: I.ledger },
      { label: 'Feature Flags', route: '/admin/feature-flags', icon: I.platform },
    ],
  },
];
