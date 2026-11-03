import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessesController } from './businesses/businesses.controller.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AppController, HealthController, BusinessesController],
})
export class AppModule {}
