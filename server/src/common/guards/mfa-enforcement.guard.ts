import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { AuthUser } from '../interfaces';
import { UsersService } from '../../modules/users/users.service';
import { REQUIRE_MFA_KEY } from '../decorators/require-mfa.decorator';

/**
 * Enforces mandatory MFA on routes marked with @RequireMfa (SECURITY_IMPLEMENTATION.md
 * §17 · AU-03). Deliberately narrow:
 *   - No-ops entirely unless REQUIRE_ADMIN_MFA=true (safe rollout — enroll admins first).
 *   - No-ops on routes without @RequireMfa, so it costs nothing (no DB hit) for normal
 *     traffic; the lookup only happens on the handful of decorated admin routes.
 *   - Never blocks the enrollment path: /auth/mfa/* is not decorated, so an admin without
 *     MFA can always reach setup/activate to become compliant.
 *
 * Because the login flow already forces the second factor once MFA is enabled, "has MFA
 * enrolled" is equivalent to "logged in with MFA" — so checking mfaEnabled is sufficient.
 */
@Injectable()
export class MfaEnforcementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_MFA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;
    if (!this.config.get('security.requireAdminMfa', { infer: true }))
      return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    // Unauthenticated/public routes are handled by the auth guard; nothing to enforce here.
    if (!user) return true;

    const full = await this.users.findById(user.id);
    if (full?.mfaEnabled) return true;

    throw new ForbiddenException(
      'MFA_REQUIRED: enroll multi-factor authentication at /auth/mfa/setup before using admin functions.',
    );
  }
}
