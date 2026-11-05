import { Module } from '@nestjs/common';
import { BookingService } from './booking.service.js';
import { PublicController } from './public.controller.js';

@Module({
  controllers: [PublicController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
