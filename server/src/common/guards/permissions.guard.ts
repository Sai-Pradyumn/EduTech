import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../enums';
import { AuthUser } from '../interfaces';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ORG_HEADER, OrgContext } from '../../modules/tenancy/rbac.types';
import { TenantService } from '../../modules/tenancy/services/tenant.service';

/**
 * Enforces @Permissions(...) by resolving the caller's effective org context (platform
 * role or active-org membership) and checking every required capability. No-ops on routes
 * without @Permissions. Also attaches the resolved context to request.orgContext so
 * @CurrentOrg() can read it.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenant: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | undefined>;
      orgContext?: OrgContext;
    }>();
    if (!request.user) throw new ForbiddenException('Authentication required');

    const orgId = request.headers[ORG_HEADER];
    const ctx = await this.tenant.resolve(request.user, orgId);
    request.orgContext = ctx;

    const missing = required.filter((p) => !ctx.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission(s): ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
