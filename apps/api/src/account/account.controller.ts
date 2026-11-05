import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  deleteBusinessSchema,
  emailChangeSchema,
  passwordChangeSchema,
  type DeleteBusinessInput,
  type EmailChangeInput,
  type PasswordChangeInput,
} from '@slotwise/shared';
import type { AuthedRequest } from '../auth/auth-request.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { ZodPipe } from '../auth/zod.pipe.js';
import { AccountService } from './account.service.js';

// Order matters: SessionGuard sets the session that RolesGuard reads.
@Controller('account')
@UseGuards(SessionGuard, RolesGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Patch('password')
  @HttpCode(204)
  password(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(passwordChangeSchema)) input: PasswordChangeInput,
  ): Promise<void> {
    return this.account.changePassword(req.auth, req.sessionToken, input);
  }

  @Patch('email')
  @HttpCode(204)
  email(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(emailChangeSchema)) input: EmailChangeInput,
  ): Promise<void> {
    return this.account.changeEmail(req.auth, input);
  }

  @Delete('business')
  @HttpCode(204)
  @Roles('owner')
  deleteBusiness(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(deleteBusinessSchema)) input: DeleteBusinessInput,
  ): Promise<void> {
    return this.account.deleteBusiness(req.auth, input);
  }
}
