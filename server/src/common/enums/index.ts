/** Domain enums shared across modules. Stored as lowercase strings in MongoDB. */

export enum Role {
  Student = 'student',
  Admin = 'admin',
  Mentor = 'mentor',
}

/* ───────────────────── Multi-tenant RBAC (Phase 4 · B1) ─────────────────────
 * `Role` above is the platform ACCOUNT type (kept for backward compat + the app/admin
 * shells). `OrgRole` is the membership-level role inside an organization, and `Permission`
 * is the fine-grained capability the guards actually check. SUPER_ADMIN / PLATFORM_ADMIN
 * act across all orgs; the rest are scoped to their organization membership. */

export enum OrgType {
  College = 'college',
  Institute = 'institute',
  Company = 'company',
  Cohort = 'cohort',
  Platform = 'platform',
}

export enum OrgRole {
  SuperAdmin = 'super_admin',
  PlatformAdmin = 'platform_admin',
  OrgAdmin = 'org_admin',
  Mentor = 'mentor',
  Instructor = 'instructor',
  Student = 'student',
  Guest = 'guest',
}

export enum Permission {
  PlatformManage = 'platform.manage',
  OrgManage = 'organization.manage',
  OrgView = 'organization.view',
  MemberManage = 'member.manage',
  StudentView = 'student.view',
  StudentManage = 'student.manage',
  MentorAssign = 'mentor.assign',
  CohortCreate = 'cohort.create',
  CohortView = 'cohort.view',
  ContentUpload = 'content.upload',
  AiAnalyticsView = 'ai.analytics.view',
  BillingManage = 'billing.manage',
  CertificateIssue = 'certificate.issue',
  /** Revoking a credential is more destructive than issuing one — held separately so an
   *  issuer (e.g. an instructor) can grant but not unilaterally revoke. */
  CertificateRevoke = 'certificate.revoke',
  ProjectReview = 'project.review',
  ReportsView = 'admin.reports.view',
}

const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

const ORG_ADMIN_PERMS: Permission[] = [
  Permission.OrgManage,
  Permission.OrgView,
  Permission.MemberManage,
  Permission.StudentView,
  Permission.StudentManage,
  Permission.MentorAssign,
  Permission.CohortCreate,
  Permission.CohortView,
  Permission.ContentUpload,
  Permission.AiAnalyticsView,
  Permission.BillingManage,
  Permission.CertificateIssue,
  Permission.CertificateRevoke,
  Permission.ProjectReview,
  Permission.ReportsView,
];

/** Maps an OrgRole to the capabilities it grants. */
export const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  [OrgRole.SuperAdmin]: ALL_PERMISSIONS,
  [OrgRole.PlatformAdmin]: ALL_PERMISSIONS,
  [OrgRole.OrgAdmin]: ORG_ADMIN_PERMS,
  [OrgRole.Mentor]: [
    Permission.OrgView,
    Permission.StudentView,
    Permission.CohortView,
    Permission.ProjectReview,
    Permission.ContentUpload,
  ],
  [OrgRole.Instructor]: [
    Permission.OrgView,
    Permission.StudentView,
    Permission.CohortView,
    Permission.ContentUpload,
    Permission.CertificateIssue,
  ],
  [OrgRole.Student]: [Permission.OrgView, Permission.CohortView],
  [OrgRole.Guest]: [Permission.OrgView],
};

export const PLATFORM_ORG_ROLES: OrgRole[] = [
  OrgRole.SuperAdmin,
  OrgRole.PlatformAdmin,
];

export enum MembershipStatus {
  Active = 'active',
  Invited = 'invited',
  Removed = 'removed',
}

/** Lifecycle of a cohort (Phase 4 · B3). */
export enum CohortStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
  Archived = 'archived',
}

/** Lifecycle of a live session (Phase 4 · B4). */
export enum LiveSessionStatus {
  Scheduled = 'scheduled',
  Live = 'live',
  Ended = 'ended',
  Cancelled = 'cancelled',
}

export enum AgentType {
  Roadmap = 'roadmap',
  Tutor = 'tutor',
  Mentor = 'mentor',
  DoubtSolver = 'doubt_solver',
  Rag = 'rag',
  Assessment = 'assessment',
  ProjectBuilder = 'project_builder',
  Career = 'career',
  Voice = 'voice',
  ContentCreator = 'content_creator',
  AdminInsight = 'admin_insight',
}

export enum Intent {
  RoadmapGeneration = 'roadmap_generation',
  ConceptExplanation = 'concept_explanation',
  DoubtSolving = 'doubt_solving',
  QuizGeneration = 'quiz_generation',
  ProjectPlanning = 'project_planning',
  DocumentQuestion = 'document_question',
  CareerGuidance = 'career_guidance',
  MentorReview = 'mentor_review',
  VoicePractice = 'voice_practice',
  ContentGeneration = 'content_generation',
  GeneralChat = 'general_chat',
}

export enum TutorMode {
  Explain = 'explain',
  Hint = 'hint',
  Socratic = 'socratic',
  Practice = 'practice',
  Interview = 'interview',
  Revision = 'revision',
  Debugging = 'debugging',
  Visual = 'visual',
  Exam = 'exam',
  Project = 'project',
}

export enum LearningStyle {
  Video = 'video',
  Reading = 'reading',
  Project = 'project',
  Practice = 'practice',
  Mixed = 'mixed',
}

export enum EducationLevel {
  School = 'school',
  Diploma = 'diploma',
  BTech = 'btech',
  Degree = 'degree',
  WorkingProfessional = 'working_professional',
  Other = 'other',
}

export enum Branch {
  CSE = 'cse',
  IT = 'it',
  ECE = 'ece',
  EEE = 'eee',
  Mechanical = 'mechanical',
  Civil = 'civil',
  Other = 'other',
}

export enum SkillLevel {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
}

export enum TimePerDay {
  HalfHour = '30min',
  OneHour = '1hour',
  TwoHours = '2hours',
  ThreePlusHours = '3plus',
}

export enum TargetTimeline {
  OneMonth = '1month',
  ThreeMonths = '3months',
  SixMonths = '6months',
  TwelveMonths = '12months',
}

export enum CareerTarget {
  Internship = 'internship',
  FullTime = 'fulltime',
  Freelancing = 'freelancing',
  Startup = 'startup',
  HigherStudies = 'higher_studies',
  SkillImprovement = 'skill_improvement',
}

export enum RoadmapStatus {
  Active = 'active',
  Completed = 'completed',
  Archived = 'archived',
}

export enum AssessmentKind {
  Quiz = 'quiz',
  Project = 'project',
  Interview = 'interview',
  Assignment = 'assignment',
}

export enum DocStatus {
  Uploaded = 'uploaded',
  Processing = 'processing',
  Ready = 'ready',
  Failed = 'failed',
}

export enum ItemStatus {
  Todo = 'todo',
  InProgress = 'in_progress',
  Done = 'done',
}

export enum QuestionType {
  Mcq = 'mcq',
  ShortAnswer = 'short_answer',
  Coding = 'coding',
}

export enum Difficulty {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
}

export enum NotifChannel {
  InApp = 'in_app',
  Email = 'email',
  Whatsapp = 'whatsapp',
}

/** Maps a classified intent to the agent that should handle it. */
export const INTENT_AGENT_MAP: Record<Intent, AgentType> = {
  [Intent.RoadmapGeneration]: AgentType.Roadmap,
  [Intent.ConceptExplanation]: AgentType.Tutor,
  [Intent.DoubtSolving]: AgentType.DoubtSolver,
  [Intent.QuizGeneration]: AgentType.Assessment,
  [Intent.ProjectPlanning]: AgentType.ProjectBuilder,
  [Intent.DocumentQuestion]: AgentType.Rag,
  [Intent.CareerGuidance]: AgentType.Career,
  [Intent.MentorReview]: AgentType.Mentor,
  [Intent.VoicePractice]: AgentType.Voice,
  [Intent.ContentGeneration]: AgentType.ContentCreator,
  [Intent.GeneralChat]: AgentType.Tutor,
};
