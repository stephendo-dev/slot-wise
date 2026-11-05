import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  bookingCreateSchema,
  type BookingCreateInput,
  type BookingCreated,
  type BookingSummary,
  type PublicBusiness,
} from '@slotwise/shared';
import { ZodPipe } from '../auth/zod.pipe.js';
import { UuidPipe } from '../common/uuid.pipe.js';
import { BookingService } from './booking.service.js';

// No session here: this is what a customer sees. It never lists other
// customers' bookings; the only booking a caller can read is the one whose
// private token they hold.
@Controller('public')
export class PublicController {
  constructor(private readonly booking: BookingService) {}

  @Get('b/:slug')
  business(@Param('slug') slug: string): Promise<PublicBusiness> {
    return this.booking.business(slug);
  }

  @Get('b/:slug/slots')
  async slots(
    @Param('slug') slug: string,
    @Query('serviceId', UuidPipe) serviceId: string,
    @Query('staffId') staffId?: string,
  ): Promise<{ slots: string[] }> {
    const staff = staffId ? new UuidPipe().transform(staffId) : undefined;
    return { slots: await this.booking.slots(slug, serviceId, staff) };
  }

  @Post('b/:slug/bookings')
  create(
    @Param('slug') slug: string,
    @Body(new ZodPipe(bookingCreateSchema)) input: BookingCreateInput,
  ): Promise<BookingCreated> {
    return this.booking.create(slug, input);
  }

  @Get('bookings/:token')
  view(@Param('token') token: string): Promise<BookingSummary> {
    return this.booking.view(token);
  }

  @Post('bookings/:token/cancel')
  @HttpCode(200)
  cancel(@Param('token') token: string): Promise<BookingSummary> {
    return this.booking.cancel(token);
  }
}
