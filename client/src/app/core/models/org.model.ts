/** Multi-tenant / RBAC models — mirror the server tenancy contract (B1). */

export type OrgType = 'college' | 'institute' | 'company' | 'cohort' | 'platform';
export type OrgRole = 'super_admin' | 'platform_admin' | 'org_admin' | 'mentor' | 'instructor' | 'student' | 'guest';
export type MembershipStatus = 'active' | 'invited' | 'removed';

export interface OrgBranding {
  logoUrl?: string;
  primaryColor: string;
  tagline: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  description: string;
  plan: string;
  status: string;
  memberCount: number;
  branding: OrgBranding;
  createdAt: string;
}

export interface MyOrg extends Organization {
  orgRole: OrgRole;
}

export interface OrgMember {
  userId: string;
  name: string;
  email: string;
  orgRole: OrgRole;
  status: MembershipStatus;
  joinedAt: string;
}

export interface OrgContext {
  organizationId: string | null;
  orgRole: OrgRole | null;
  permissions: string[];
  isPlatform: boolean;
}

/** Permission keys (must match server `Permission` enum values). */
export const PERM = {
  PlatformManage: 'platform.manage',
  OrgManage: 'organization.manage',
  OrgView: 'organization.view',
  MemberManage: 'member.manage',
  StudentView: 'student.view',
  StudentManage: 'student.manage',
  AiAnalyticsView: 'ai.analytics.view',
  ReportsView: 'admin.reports.view',
} as const;

/** Org roles an admin may assign in the UI (platform roles excluded). */
export const ASSIGNABLE_ORG_ROLES: OrgRole[] = ['org_admin', 'mentor', 'instructor', 'student', 'guest'];
