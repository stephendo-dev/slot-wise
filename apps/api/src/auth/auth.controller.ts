import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  loginSchema,
  signupSchema,
  type LoginInput,
  type SessionInfo,
  type SignupInput,
} from '@slotwise/shared';
import { AuthService } from './auth.service.js';
import type { AuthedRequest } from './auth-request.js';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  setSessionCookie,
} from './session-cookie.js';
import { SessionGuard } from './session.guard.js';
import { ZodPipe } from './zod.pipe.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  @Post('signup')
  async signup(
    @Body(new ZodPipe(signupSchema)) input: SignupInput,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<SessionInfo> {
    const { token, info } = await this.auth.signup(input);
    this.setSession(res, token);
    return info;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(loginSchema)) input: LoginInput,
    @Ip() address: string,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<SessionInfo> {
    const { token, info } = await this.auth.login(input, address);
    this.setSession(res, token);
    return info;
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(
    @Req() request: AuthedRequest,
    @Res({ passthrough: true }) res: unknown,
  ): Promise<void> {
    await this.auth.logout(request.sessionToken);
    this.adapterHost.httpAdapter.clearCookie(
      res,
      SESSION_COOKIE,
      sessionCookieOptions,
    );
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthedRequest): SessionInfo {
    return request.auth;
  }

  private setSession(res: unknown, token: string): void {
    setSessionCookie(this.adapterHost.httpAdapter, res, token);
  }
}
