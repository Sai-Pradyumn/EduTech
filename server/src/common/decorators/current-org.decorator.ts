import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EMPTY_CONTEXT, OrgContext } from '../../modules/tenancy/rbac.types';

/** Injects the resolved OrgContext (set by PermissionsGuard on permissioned routes). */
export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext): OrgContext => {
  const request = ctx.switchToHttp().getRequest<{ orgContext?: OrgContext }>();
  return request.orgContext ?? EMPTY_CONTEXT;
});
