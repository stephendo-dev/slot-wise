import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@slotwise/shared';
import type { AuthedRequest } from './auth-request.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed || allowed.length === 0) return true;
    const { auth } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!auth || !allowed.includes(auth.user.role)) {
      throw new ForbiddenException('Your role cannot do this');
    }
    return true;
  }
}
