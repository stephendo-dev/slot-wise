import {
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { SessionInfo } from '@slotwise/shared';
import { setSessionCookie } from '../auth/session-cookie.js';
import { DemoService } from './demo.service.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

@Controller('demo')
export class DemoController {
  constructor(
    private readonly demo: DemoService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  /** "Try as business owner": a session as the demo owner, with no form. */
  @Post('login')
  @HttpCode(200)
  async login(@Res({ passthrough: true }) res: unknown): Promise<SessionInfo> {
    const { token, info } = await this.demo.login();
    setSessionCookie(this.adapterHost.httpAdapter, res, token);
    return info;
  }

  /** Called by a daily job. Closed (404) until DEMO_RESET_SECRET is set; then it needs that secret. */
  @Post('reset')
  @HttpCode(200)
  reset(
    @Headers('x-reset-secret') secret?: string,
  ): Promise<{ bookings: number }> {
    const expected = process.env.DEMO_RESET_SECRET;
    if (!expected) throw new NotFoundException();
    if (!secret || !timingSafeEqual(digest(secret), digest(expected))) {
      throw new ForbiddenException();
    }
    return this.demo.reset();
  }
}
