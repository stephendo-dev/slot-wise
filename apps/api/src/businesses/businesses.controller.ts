import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { SessionBusiness } from '@slotwise/shared';
import type { AuthedRequest } from '../auth/auth-request.js';
import { SessionGuard } from '../auth/session.guard.js';

@Controller('businesses')
@UseGuards(SessionGuard)
export class BusinessesController {
  // The business comes from the session. A request that names any other
  // business gets the same 404 as one that names none.
  @Get(':id')
  get(@Param('id') id: string, @Req() request: AuthedRequest): SessionBusiness {
    const { business } = request.auth;
    if (id !== business.id) throw new NotFoundException();
    return business;
  }
}
