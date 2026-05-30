import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrgRole, PLATFORM_ORG_ROLES, Permission, ROLE_PERMISSIONS, Role, MembershipStatus } from '../../../common/enums';
import { AuthUser } from '../../../common/interfaces';
import { UsersService } from '../../users/users.service';
import { Membership, MembershipDocument } from '../schemas/membership.schema';
import { EMPTY_CONTEXT, OrgContext } from '../rbac.types';

/**
 * Resolves the effective tenant + permission context for a request. Platform admins
 * (account Role.Admin or a platformRole of super/platform_admin) act across every org;
 * everyone else is scoped to their active organization membership (selected via the
 * x-org-id header, else their primary/first org).
 */
@Injectable()
export class TenantService {
  constructor(
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    private readonly users: UsersService,
  ) {}

  async resolve(authUser: AuthUser, requestedOrgId?: string): Promise<OrgContext> {
    const user = await this.users.findById(authUser.id);
    if (!user) return EMPTY_CONTEXT;

    const isPlatform =
      user.role === Role.Admin || (!!user.platformRole && PLATFORM_ORG_ROLES.includes(user.platformRole));

    if (isPlatform) {
      return {
        organizationId: requestedOrgId ?? (user.primaryOrganization ? String(user.primaryOrganization) : null),
        orgRole: user.platformRole ?? OrgRole.PlatformAdmin,
        permissions: ROLE_PERMISSIONS[user.platformRole ?? OrgRole.PlatformAdmin],
        isPlatform: true,
      };
    }

    // Pick the active membership: requested org → primary org → first active.
    const orgId = requestedOrgId ?? (user.primaryOrganization ? String(user.primaryOrganization) : undefined);
    const membership = orgId
      ? await this.findMembership(authUser.id, orgId)
      : await this.memberships.findOne({ user: new Types.ObjectId(authUser.id), status: MembershipStatus.Active });

    if (!membership || membership.status !== MembershipStatus.Active) return EMPTY_CONTEXT;

    return {
      organizationId: String(membership.organization),
      orgRole: membership.orgRole,
      permissions: this.permissionsFor(membership.orgRole, membership.extraPermissions),
      isPlatform: false,
    };
  }

  permissionsFor(role: OrgRole, extra: Permission[] = []): Permission[] {
    return Array.from(new Set([...ROLE_PERMISSIONS[role], ...extra]));
  }

  findMembership(userId: string, orgId: string): Promise<MembershipDocument | null> {
    if (!Types.ObjectId.isValid(orgId)) return Promise.resolve(null);
    return this.memberships
      .findOne({ user: new Types.ObjectId(userId), organization: new Types.ObjectId(orgId) })
      .exec();
  }
}
