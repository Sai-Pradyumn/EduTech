import { OrgRole, Permission } from '../../common/enums';

/** Header clients send to select their active organization. */
export const ORG_HEADER = 'x-org-id';

/** Resolved tenant + capability context for the current request. */
export interface OrgContext {
  organizationId: string | null;
  orgRole: OrgRole | null;
  permissions: Permission[];
  /** True for super/platform admins — act across every organization. */
  isPlatform: boolean;
}

export const EMPTY_CONTEXT: OrgContext = {
  organizationId: null,
  orgRole: null,
  permissions: [],
  isPlatform: false,
};
