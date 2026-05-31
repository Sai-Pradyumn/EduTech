import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';

/** Phase-1 placeholder factory — keeps nav coherent until each feature ships. */
const placeholder = (title: string, heading: string, description: string, phase: number) => ({
  title,
  loadComponent: () =>
    import('./shared/components/placeholder-page.component').then((m) => m.PlaceholderPageComponent),
  data: { title, heading, description, phase },
});

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'pricing',
    loadComponent: () => import('./features/billing/pricing.component').then((m) => m.PricingComponent),
  },
  {
    path: 'certificate/verify/:id',
    loadComponent: () => import('./features/certificates/cert-verify.component').then((m) => m.CertVerifyComponent),
  },
  {
    path: '',
    loadComponent: () => import('./features/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent) },
    ],
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
  },

  // Student app shell
  {
    path: 'app',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        data: { title: 'Dashboard' },
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'tutor',
        title: 'AI Tutor',
        data: { title: 'AI Tutor Workspace' },
        loadComponent: () => import('./features/ai-tutor/tutor-workspace.component').then((m) => m.TutorWorkspaceComponent),
      },
      {
        path: 'mentor-room',
        title: 'Mentor Room',
        data: { title: 'AI Mentor Room', agentType: 'mentor', avatar: 'M', subtitle: 'Weekly review, learning-health score and a planned week', starters: ['Review my progress and plan my week', 'Am I on track for my goal?', 'What should I focus on this week?'] },
        loadComponent: () => import('./features/agent-workspace/agent-workspace.component').then((m) => m.AgentWorkspaceComponent),
      },
      {
        path: 'doubt-solver',
        title: 'Doubt Solver',
        data: { title: 'AI Doubt Solver', agentType: 'doubt_solver', avatar: 'D', subtitle: 'Hint-first help for errors, bugs and stuck moments', starters: ['My code throws "cannot read properties of undefined"', 'My API call returns a CORS error', 'Why isn’t my flexbox centering?'] },
        loadComponent: () => import('./features/agent-workspace/agent-workspace.component').then((m) => m.AgentWorkspaceComponent),
      },
      {
        path: 'career-coach',
        title: 'Career Coach',
        data: { title: 'AI Career Coach', agentType: 'career', avatar: 'C', subtitle: 'Skill-gap map, readiness score and an interview plan', starters: ['How ready am I for my goal?', 'What are my biggest skill gaps?', 'Mock interview me'] },
        loadComponent: () => import('./features/agent-workspace/agent-workspace.component').then((m) => m.AgentWorkspaceComponent),
      },
      {
        path: 'content-studio',
        title: 'Study Notes',
        data: { title: 'AI Study Notes', agentType: 'content_creator', avatar: 'N', subtitle: 'Generate notes, cheat-sheets, summaries and flashcards', starters: ['Make study notes on recursion', 'Create a cheat-sheet for SQL joins', 'Flashcards for React hooks'] },
        loadComponent: () => import('./features/agent-workspace/agent-workspace.component').then((m) => m.AgentWorkspaceComponent),
      },
      {
        path: 'voice-room',
        title: 'Voice Room',
        data: { title: 'Voice Room' },
        loadComponent: () => import('./features/voice/voice-room.component').then((m) => m.VoiceRoomComponent),
      },
      {
        path: 'workflows',
        title: 'Workflows',
        data: { title: 'Agent Workflows' },
        loadComponent: () => import('./features/workflows/workflows.component').then((m) => m.WorkflowsComponent),
      },
      {
        path: 'roadmap',
        title: 'My Roadmaps',
        data: { title: 'My Roadmaps' },
        loadComponent: () => import('./features/roadmap/roadmap-list.component').then((m) => m.RoadmapListComponent),
      },
      {
        path: 'roadmap/generate',
        title: 'Generate Roadmap',
        data: { title: 'Generate Roadmap' },
        loadComponent: () => import('./features/roadmap/roadmap-generate.component').then((m) => m.RoadmapGenerateComponent),
      },
      {
        path: 'roadmap/:id',
        title: 'Roadmap',
        data: { title: 'Roadmap' },
        loadComponent: () => import('./features/roadmap/roadmap-details.component').then((m) => m.RoadmapDetailsComponent),
      },
      {
        path: 'flows',
        title: 'Flow Studio',
        data: { title: 'Flow Studio' },
        loadComponent: () => import('./features/flows/flows-list.component').then((m) => m.FlowsListComponent),
      },
      {
        path: 'flows/new',
        title: 'New Flow',
        data: { title: 'New Flow' },
        loadComponent: () => import('./features/flows/flows-list.component').then((m) => m.FlowsListComponent),
      },
      {
        path: 'flows/:id',
        title: 'Flow',
        data: { title: 'Flow' },
        loadComponent: () => import('./features/flows/flow-detail.component').then((m) => m.FlowDetailComponent),
      },
      {
        path: 'visuals',
        title: 'Visual Studio',
        data: { title: 'Visual Studio' },
        loadComponent: () => import('./features/visuals/visuals-list.component').then((m) => m.VisualsListComponent),
      },
      {
        path: 'visuals/:id',
        title: 'Visual',
        data: { title: 'Visual' },
        loadComponent: () => import('./features/visuals/visual-detail.component').then((m) => m.VisualDetailComponent),
      },
      {
        path: 'knowledge',
        title: 'Knowledge Hub',
        data: { title: 'Knowledge Hub' },
        loadComponent: () => import('./features/knowledge-hub/knowledge-hub.component').then((m) => m.KnowledgeHubComponent),
      },
      {
        path: 'quizzes',
        title: 'Quiz Studio',
        data: { title: 'Quiz Studio' },
        loadComponent: () => import('./features/quiz-studio/quiz-studio.component').then((m) => m.QuizStudioComponent),
      },
      {
        path: 'projects',
        title: 'Project Studio',
        data: { title: 'Project Studio' },
        loadComponent: () => import('./features/project-studio/project-studio.component').then((m) => m.ProjectStudioComponent),
      },
      {
        path: 'progress',
        title: 'Learning Intelligence',
        data: { title: 'Learning Intelligence' },
        loadComponent: () => import('./features/intelligence/intelligence-cockpit.component').then((m) => m.IntelligenceCockpitComponent),
      },
      {
        path: 'mistakes',
        title: 'Mistake OS',
        data: { title: 'Mistake OS' },
        loadComponent: () => import('./features/mistakes/mistakes.component').then((m) => m.MistakesComponent),
      },
      {
        path: 'skill-twin',
        title: 'Skill Twin',
        data: { title: 'Skill Twin' },
        loadComponent: () => import('./features/skill-twin/skill-twin.component').then((m) => m.SkillTwinComponent),
      },
      {
        path: 'cohorts',
        title: 'Cohorts',
        data: { title: 'Cohorts' },
        loadComponent: () => import('./features/cohorts/cohorts.component').then((m) => m.CohortsComponent),
      },
      {
        path: 'live-sessions',
        title: 'Live Sessions',
        data: { title: 'Live Sessions' },
        loadComponent: () => import('./features/live-sessions/live-sessions.component').then((m) => m.LiveSessionsComponent),
      },
      {
        path: 'community',
        title: 'Community',
        data: { title: 'Community' },
        loadComponent: () => import('./features/community/community.component').then((m) => m.CommunityComponent),
      },
      {
        path: 'reports',
        title: 'Reports',
        data: { title: 'Enterprise Reports' },
        loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'founder',
        title: 'Founder',
        data: { title: 'Founder Dashboard' },
        loadComponent: () => import('./features/founder/founder-dashboard.component').then((m) => m.FounderDashboardComponent),
      },
      {
        path: 'certificates',
        title: 'Certificates',
        data: { title: 'Certificates' },
        loadComponent: () => import('./features/certificates/certificates.component').then((m) => m.CertificatesComponent),
      },
      {
        path: 'billing',
        title: 'Billing',
        data: { title: 'Billing & Usage' },
        loadComponent: () => import('./features/billing/billing.component').then((m) => m.BillingComponent),
      },
      {
        path: 'mentor',
        title: 'Mentor Room',
        data: { title: 'Mentor Room' },
        loadComponent: () => import('./features/mentor/mentor-workspace.component').then((m) => m.MentorWorkspaceComponent),
      },
      {
        path: 'org',
        title: 'Organization',
        data: { title: 'Organization' },
        loadComponent: () => import('./features/org/org-admin.component').then((m) => m.OrgAdminComponent),
      },
      {
        path: 'platform',
        title: 'Platform',
        data: { title: 'Platform' },
        loadComponent: () => import('./features/platform/platform-orgs.component').then((m) => m.PlatformOrgsComponent),
      },
      {
        path: 'profile',
        title: 'Profile',
        data: { title: 'Profile & Settings' },
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },

  // Admin app shell
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('admin')],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Admin Dashboard',
        data: { title: 'AI Analytics' },
        loadComponent: () => import('./features/admin/admin-analytics.component').then((m) => m.AdminAnalyticsComponent),
      },
      {
        path: 'students',
        title: 'Students',
        data: { title: 'Students' },
        loadComponent: () => import('./features/admin/admin-students.component').then((m) => m.AdminStudentsComponent),
      },
      {
        path: 'analytics',
        title: 'AI Analytics',
        data: { title: 'AI Analytics' },
        loadComponent: () => import('./features/admin/admin-analytics.component').then((m) => m.AdminAnalyticsComponent),
      },
      {
        path: 'fine-tuning',
        title: 'Fine-Tuning',
        data: { title: 'Fine-Tuning Lab' },
        loadComponent: () => import('./features/admin/fine-tuning.component').then((m) => m.FineTuningComponent),
      },
      {
        path: 'documents',
        title: 'Documents',
        data: { title: 'Knowledge Documents' },
        loadComponent: () => import('./features/admin/admin-documents.component').then((m) => m.AdminDocumentsComponent),
      },
      {
        path: 'roadmaps',
        title: 'Roadmaps',
        data: { title: 'Roadmaps Browser' },
        loadComponent: () => import('./features/admin/admin-roadmaps.component').then((m) => m.AdminRoadmapsComponent),
      },
      {
        path: 'assessments',
        title: 'Assessments',
        data: { title: 'Assessments Browser' },
        loadComponent: () => import('./features/admin/admin-assessments.component').then((m) => m.AdminAssessmentsComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
