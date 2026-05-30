import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums';

export const PERMISSIONS_KEY = 'permissions';

/** Requires the caller to hold ALL listed permissions (enforced by PermissionsGuard). */
export const Permissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
