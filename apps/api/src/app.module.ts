import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AccountModule } from './account/account.module.js';
import { DemoModule } from './demo/demo.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessesController } from './businesses/businesses.controller.js';
import { BookingModule } from './booking/booking.module.js';
import { ManagementModule } from './management/management.module.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ManagementModule,
    BookingModule,
    AccountModule,
    DemoModule,
  ],
  controllers: [AppController, HealthController, BusinessesController],
})
export class AppModule {}
