import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthedRequest } from './auth-request.js';
import { readCookie, SESSION_COOKIE } from './session-cookie.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const info = token ? await this.auth.resolve(token) : undefined;
    if (!token || !info) throw new UnauthorizedException('Sign in to continue');
    request.auth = info;
    request.sessionToken = token;
    return true;
  }
}
