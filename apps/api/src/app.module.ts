import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController, HealthController],
})
export class AppModule {}
