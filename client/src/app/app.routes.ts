import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';
import { astaModeRedirectGuard } from './core/guards/asta-mode-redirect.guard';

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
    path: 'u/:username',
    loadComponent: () => import('./features/skill-passport/public-passport.component').then((m) => m.PublicPassportComponent),
  },
  {
    path: 'p/:username',
    loadComponent: () => import('./features/portfolio/public-portfolio.component').then((m) => m.PublicPortfolioComponent),
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

  // Asta OS — its own full-screen experience, deliberately NOT wrapped by the
  // classic ShellComponent (no legacy sidebar/topbar). Listed before `app` so it
  // matches first. Tools are native panels inside the cockpit — no jumps back out.
  {
    path: 'app/os',
    canActivate: [authGuard, onboardingGuard],
    children: [
      {
        path: '',
        title: 'Asta OS',
        loadComponent: () => import('./features/asta-os/asta-os.component').then((m) => m.AstaOsComponent),
      },
      {
        path: 'practice',
        title: 'Practice Studio',
        loadComponent: () =>
          import('./features/asta-os/practice/asta-os-practice-panel.component').then((m) => m.AstaOsPracticePanelComponent),
      },
      {
        path: 'notebook',
        title: 'ML Notebook',
        loadComponent: () =>
          import('./features/asta-os/notebook/asta-os-notebook.component').then((m) => m.AstaOsNotebookComponent),
      },
    ],
  },

  // Student app shell (Classic Mode)
  {
    path: 'app',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      // Land on the surface matching the chosen experience (Asta OS vs Classic).
      { path: '', pathMatch: 'full', canActivate: [astaModeRedirectGuard], children: [] },
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
        path: 'voice-room/session/:id',
        title: 'Voice Session',
        data: { title: 'Voice Session' },
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
        path: 'today',
        title: 'Today',
        data: { title: 'Today' },
        loadComponent: () => import('./features/today/today.component').then((m) => m.TodayComponent),
      },
      {
        path: 'spaces',
        title: 'Study Spaces',
        data: { title: 'Study Spaces' },
        loadComponent: () => import('./features/spaces/spaces-list.component').then((m) => m.SpacesListComponent),
      },
      {
        path: 'spaces/:id',
        title: 'Study Space',
        data: { title: 'Study Space' },
        loadComponent: () => import('./features/spaces/space-detail.component').then((m) => m.SpaceDetailComponent),
      },
      {
        path: 'simulations',
        title: 'Simulation Labs',
        data: { title: 'Simulation Labs' },
        loadComponent: () => import('./features/simulations/simulations-list.component').then((m) => m.SimulationsListComponent),
      },
      {
        path: 'simulations/:id',
        title: 'Simulation',
        data: { title: 'Simulation' },
        loadComponent: () => import('./features/simulations/simulation-detail.component').then((m) => m.SimulationDetailComponent),
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
        path: 'course-builder',
        title: 'Course Builder',
        data: { title: 'Course Builder' },
        loadComponent: () => import('./features/course-builder/course-list.component').then((m) => m.CourseListComponent),
      },
      {
        path: 'course-builder/:id',
        title: 'Course',
        data: { title: 'Course' },
        loadComponent: () => import('./features/course-builder/course-detail.component').then((m) => m.CourseDetailComponent),
      },
      {
        path: 'peer-rooms',
        title: 'Peer Rooms',
        data: { title: 'Peer Rooms' },
        loadComponent: () => import('./features/peer-rooms/peer-rooms-list.component').then((m) => m.PeerRoomsListComponent),
      },
      {
        path: 'peer-rooms/:id',
        title: 'Peer Room',
        data: { title: 'Peer Room' },
        loadComponent: () => import('./features/peer-rooms/peer-room-detail.component').then((m) => m.PeerRoomDetailComponent),
      },
      {
        path: 'knowledge',
        title: 'Knowledge Hub',
        data: { title: 'Knowledge Hub' },
        loadComponent: () => import('./features/knowledge-hub/knowledge-hub.component').then((m) => m.KnowledgeHubComponent),
      },
      {
        path: 'resources',
        title: 'Resources',
        data: { title: 'Resources' },
        loadComponent: () => import('./features/resources/resources.component').then((m) => m.ResourcesComponent),
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
        path: 'mentor-council',
        title: 'Mentor Council',
        data: { title: 'AI Mentor Council' },
        loadComponent: () => import('./features/mentor-council/mentor-council.component').then((m) => m.MentorCouncilComponent),
      },
      {
        path: 'ledger',
        title: 'Proof-of-Learning',
        data: { title: 'Proof-of-Learning' },
        loadComponent: () => import('./features/ledger/ledger.component').then((m) => m.LedgerComponent),
      },
      {
        path: 'skill-passport',
        title: 'Skill Passport',
        data: { title: 'Skill Passport' },
        loadComponent: () => import('./features/skill-passport/skill-passport.component').then((m) => m.SkillPassportComponent),
      },
      {
        path: 'skill-passport/public-preview',
        title: 'Public Preview',
        data: { title: 'Public Preview' },
        loadComponent: () => import('./features/skill-passport/public-passport.component').then((m) => m.PublicPassportComponent),
      },
      {
        path: 'career-readiness',
        title: 'Career Readiness',
        data: { title: 'Career Readiness' },
        loadComponent: () => import('./features/career-readiness/career-readiness.component').then((m) => m.CareerReadinessComponent),
      },
      {
        path: 'outcome-council',
        title: 'Outcome Council',
        data: { title: 'AI Outcome Council' },
        loadComponent: () => import('./features/outcome-council/outcome-council.component').then((m) => m.OutcomeCouncilComponent),
      },
      {
        path: 'portfolio',
        title: 'Portfolio',
        data: { title: 'Portfolio Builder' },
        loadComponent: () => import('./features/portfolio/portfolio.component').then((m) => m.PortfolioComponent),
      },
      {
        path: 'interview',
        title: 'Interview OS',
        data: { title: 'Interview OS' },
        loadComponent: () => import('./features/interview/interview.component').then((m) => m.InterviewComponent),
      },
      {
        path: 'interview/sessions/:id',
        title: 'Interview',
        data: { title: 'Interview Session' },
        loadComponent: () => import('./features/interview/interview.component').then((m) => m.InterviewComponent),
      },
      {
        path: 'resume',
        title: 'Resume',
        data: { title: 'Resume' },
        loadComponent: () => import('./features/resume/resume.component').then((m) => m.ResumeComponent),
      },
      {
        path: 'applications',
        title: 'Applications',
        data: { title: 'Applications' },
        loadComponent: () => import('./features/applications/applications.component').then((m) => m.ApplicationsComponent),
      },
      {
        path: 'mentors',
        title: 'Mentors',
        data: { title: 'Mentors' },
        loadComponent: () => import('./features/mentor-marketplace/mentors.component').then((m) => m.MentorsComponent),
      },
      {
        path: 'mentor-sessions',
        title: 'Mentor Sessions',
        data: { title: 'Mentor Sessions' },
        loadComponent: () => import('./features/mentor-marketplace/mentors.component').then((m) => m.MentorsComponent),
      },
      {
        path: 'marketplace',
        title: 'Marketplace',
        data: { title: 'Template Marketplace' },
        loadComponent: () => import('./features/marketplace/marketplace.component').then((m) => m.MarketplaceComponent),
      },
      {
        path: 'creator-studio',
        title: 'Creator Studio',
        data: { title: 'Creator Studio' },
        loadComponent: () => import('./features/creator-studio/creator-studio.component').then((m) => m.CreatorStudioComponent),
      },
      {
        path: 'institution',
        title: 'Institution',
        data: { title: 'Institution Outcomes' },
        loadComponent: () => import('./features/institution/institution.component').then((m) => m.InstitutionComponent),
      },
      {
        path: 'replay',
        title: 'Learning Replay',
        data: { title: 'Learning Replay' },
        loadComponent: () => import('./features/replay/replay.component').then((m) => m.ReplayComponent),
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
        path: 'offline',
        title: 'Offline & Sync',
        data: { title: 'Offline & Sync' },
        loadComponent: () => import('./features/platform/offline.component').then((m) => m.OfflineComponent),
      },
      {
        path: 'security',
        title: 'Security',
        data: { title: 'Security & Devices' },
        loadComponent: () => import('./features/platform/security.component').then((m) => m.SecurityComponent),
      },
      {
        path: 'data',
        title: 'Your Data',
        data: { title: 'Your Data' },
        loadComponent: () => import('./features/platform/data-governance.component').then((m) => m.DataGovernanceComponent),
      },
      {
        path: 'org/branding',
        title: 'Org Branding',
        data: { title: 'Org Branding' },
        loadComponent: () => import('./features/org/org-branding.component').then((m) => m.OrgBrandingComponent),
      },
      {
        path: 'developer',
        title: 'Developer',
        data: { title: 'Developer Platform' },
        loadComponent: () => import('./features/platform/developer.component').then((m) => m.DeveloperComponent),
      },
      {
        path: 'integrations',
        title: 'Integrations',
        data: { title: 'Integrations' },
        loadComponent: () => import('./features/platform/integrations.component').then((m) => m.IntegrationsComponent),
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
        path: 'privacy',
        title: 'Data & Privacy',
        data: { title: 'Data & Privacy' },
        loadComponent: () => import('./features/privacy/privacy.component').then((m) => m.PrivacyComponent),
      },
      {
        path: 'notifications',
        title: 'Notifications',
        data: { title: 'Notifications' },
        loadComponent: () => import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent),
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
      {
        path: 'billing',
        title: 'Billing Admin',
        data: { title: 'Billing Overview' },
        loadComponent: () => import('./features/admin/admin-billing.component').then((m) => m.AdminBillingComponent),
      },
      {
        path: 'feature-flags',
        title: 'Feature Flags',
        data: { title: 'Feature Flags' },
        loadComponent: () => import('./features/admin/feature-flags.component').then((m) => m.AdminFeatureFlagsComponent),
      },
      {
        path: 'ai-ops',
        title: 'AI Ops',
        data: { title: 'AI Ops' },
        loadComponent: () => import('./features/admin/ai-ops.component').then((m) => m.AdminAiOpsComponent),
      },
      {
        path: 'ops',
        title: 'Ops',
        data: { title: 'Ops Command Center' },
        loadComponent: () => import('./features/admin/ops.component').then((m) => m.AdminOpsComponent),
      },
      {
        path: 'product-analytics',
        title: 'Product Analytics',
        data: { title: 'Product Analytics' },
        loadComponent: () => import('./features/admin/product-analytics.component').then((m) => m.AdminProductAnalyticsComponent),
      },
      {
        path: 'audit-logs',
        title: 'Audit Logs',
        data: { title: 'Audit Logs' },
        loadComponent: () => import('./features/admin/audit-logs.component').then((m) => m.AdminAuditLogsComponent),
      },
    ],
  },

  // Real 404 (no silent redirect): broken/stale links land on a page that says so.
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
