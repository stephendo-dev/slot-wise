import { SetMetadata } from '@nestjs/common';
import type { Role } from '@slotwise/shared';

export const ROLES_KEY = 'roles';

/** The roles allowed on a route. Use with SessionGuard, then RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
