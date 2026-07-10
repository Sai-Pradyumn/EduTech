import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MFA_KEY = 'requireMfa';

/**
 * Marks a controller or handler as requiring the caller to have MFA enrolled
 * (SECURITY_IMPLEMENTATION.md §17 · AU-03). Enforced by MfaEnforcementGuard, and only
 * active when REQUIRE_ADMIN_MFA=true — so decorating admin surfaces is safe to ship before
 * the flag is flipped. Apply at class level on admin/founder controllers.
 */
export const RequireMfa = () => SetMetadata(REQUIRE_MFA_KEY, true);
