/** Shared client-side models — mirror the server API contracts. */

export type Role = 'student' | 'admin' | 'mentor';

// AgentType (single source) + the Agent OS contract.
export * from './agent.model';

export type TutorMode =
  | 'explain'
  | 'hint'
  | 'socratic'
  | 'practice'
  | 'interview'
  | 'revision';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}
export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isOnboarded: boolean;
  platformRole?: string;
  primaryOrganization?: string;
  isPlatformAdmin?: boolean;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';
export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export * from './student-profile.model';
export * from './roadmap.model';
export * from './knowledge.model';
export * from './quiz.model';
export * from './intelligence.model';
export * from './project.model';
export * from './org.model';
export * from './mentor.model';
export * from './cohort.model';
export * from './billing.model';
export * from './certificate.model';
export * from './live-session.model';
export * from './community.model';
export * from './report.model';
export * from './founder.model';
export * from './admin.model';
export * from './lab.model';
