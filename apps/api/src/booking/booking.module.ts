import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingService } from './booking.service.js';
import { BookingsAdminService } from './bookings-admin.service.js';
import { BookingsController } from './bookings.controller.js';
import { PublicController } from './public.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [PublicController, BookingsController],
  providers: [BookingService, BookingsAdminService],
  exports: [BookingService],
})
export class BookingModule {}
