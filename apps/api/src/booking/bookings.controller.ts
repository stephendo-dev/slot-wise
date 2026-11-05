import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { DayBookings } from '@slotwise/shared';
import type { AuthedRequest } from '../auth/auth-request.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { UuidPipe } from '../common/uuid.pipe.js';
import { localDay } from '../slots/slots.js';
import { BookingsAdminService } from './bookings-admin.service.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Order matters: SessionGuard sets the session that RolesGuard reads.
@Controller('bookings')
@UseGuards(SessionGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly admin: BookingsAdminService) {}

  /** Owner and staff both read here; what they see differs (see the service). */
  @Get()
  day(
    @Req() req: AuthedRequest,
    @Query('date') date?: string,
  ): Promise<DayBookings> {
    const chosen = date ?? localDay(Date.now(), req.auth.business.timeZone);
    if (!DATE.test(chosen) || Number.isNaN(Date.parse(`${chosen}T00:00:00Z`))) {
      throw new BadRequestException('Use a date like 2026-11-02');
    }
    return this.admin.day(req.auth, chosen);
  }

  @Post(':id/cancel')
  @HttpCode(204)
  @Roles('owner')
  cancel(
    @Req() req: AuthedRequest,
    @Param('id', UuidPipe) id: string,
  ): Promise<void> {
    return this.admin.cancel(req.auth, id);
  }
}
